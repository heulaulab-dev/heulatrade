"""Read-only normalized API over datasets produced by nichsedge/idx-bei.

idx-bei remains the scraper, ingestion and analytical engine. This service
reads its persisted snapshots and exposes a narrow, validated product contract.
"""

from __future__ import annotations

import json
import math
import os
import re
import shutil
import tempfile
from difflib import SequenceMatcher
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Literal

import duckdb
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

app = FastAPI(title="HeulaTrade market adapter", version="1.0.0")
SYMBOL = re.compile(r"^[A-Z0-9]{1,12}$")
DATA_DIR = Path(os.environ.get("IDX_BEI_DATA_DIR", "./data")).resolve()
CACHE_DIR = Path(os.environ.get("IDX_BEI_CACHE_DIR", "/tmp/heulatrade-idx-cache")).resolve()
SUPABASE_BUCKET = os.environ.get("IDX_BEI_SUPABASE_BUCKET", "idx-bei")
SUPABASE_PREFIX = os.environ.get("IDX_BEI_SUPABASE_PREFIX", "data/timeseries").strip("/")
SNAPSHOT_TTL_SECONDS = int(os.environ.get("IDX_BEI_SNAPSHOT_TTL_SECONDS", "300"))
_SNAPSHOT_CACHE: dict[str, tuple[float, Any]] = {}


@app.middleware("http")
async def strip_prefix(request, call_next):
    """Strip /api/market-api prefix for Vercel Services routing."""
    path = request.url.path
    if path.startswith("/api/market-api"):
        from starlette.datastructures import URL
        request.scope["path"] = path[len("/api/market-api"):] or "/"
        request.scope["url"] = URL(str(request.url).replace(path, request.scope["path"]))
    return await call_next(request)


def source_file(name: str) -> Path:
    path = DATA_DIR / name
    if not path.is_file():
        raise HTTPException(503, detail="DATASET_UNAVAILABLE")
    return path


def optional_source_file(name: str) -> Path | None:
    path = DATA_DIR / name
    return path if path.is_file() else None


class SupabasePartitionStore:
    """Remote object store for idx-bei daily Parquet partitions.

    Canonical object key:
    data/timeseries/<dataset>/date=YYYY-MM-DD.parquet
    """

    def __init__(self):
        self.url = os.environ.get("SUPABASE_URL")
        self.key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_SECRET_KEY")
        self.bucket = SUPABASE_BUCKET
        self.prefix = SUPABASE_PREFIX

    @property
    def configured(self) -> bool:
        return bool(self.url and self.key and self.bucket)

    def _client(self):
        if not self.configured:
            raise HTTPException(503, detail="REMOTE_STORAGE_UNCONFIGURED")
        from supabase import create_client

        return create_client(self.url, self.key)

    def key_for(self, dataset: str, date_iso: str) -> str:
        return f"{self.prefix}/{dataset}/date={date_iso}.parquet"

    def list_dates(self, dataset: str) -> list[str]:
        if not self.configured:
            return []
        prefix = f"{self.prefix}/{dataset}"
        try:
            items = self._client().storage.from_(self.bucket).list(prefix)
        except Exception:
            return []
        dates = []
        for item in items or []:
            name = item.get("name") if isinstance(item, dict) else None
            if name and name.startswith("date=") and name.endswith(".parquet"):
                dates.append(name[len("date=") : -len(".parquet")])
        return sorted(dates)

    def latest_date(self, dataset: str) -> str | None:
        dates = self.list_dates(dataset)
        return dates[-1] if dates else None

    def download_partition(self, dataset: str, date_iso: str) -> Path | None:
        cached = CACHE_DIR / "timeseries" / dataset / f"date={date_iso}.parquet"
        if cached.is_file():
            return cached
        if not self.configured:
            return None
        try:
            content = self._client().storage.from_(self.bucket).download(self.key_for(dataset, date_iso))
        except Exception:
            return None
        cached.parent.mkdir(parents=True, exist_ok=True)
        cached.write_bytes(content)
        return cached

    def upload_partition(self, dataset: str, date_iso: str, path: Path) -> dict[str, Any]:
        if not path.is_file():
            raise HTTPException(404, detail="PARTITION_FILE_NOT_FOUND")
        key = self.key_for(dataset, date_iso)
        client = self._client().storage.from_(self.bucket)
        with path.open("rb") as handle:
            try:
                client.upload(key, handle, file_options={"content-type": "application/octet-stream", "upsert": "true"})
            except TypeError:
                client.upload(key, handle)
        return {"bucket": self.bucket, "key": key}


STORE = SupabasePartitionStore()


def parquet_rows(name: str, sql: str, params: list[Any] | None = None) -> list[dict[str, Any]]:
    path = source_file(f"parquet/{name}.parquet")
    con = duckdb.connect(database=":memory:", read_only=False)
    try:
        con.from_parquet(str(path)).create_view("dataset")
        frame = con.execute(sql, params or []).fetchdf()
        return frame.to_dict("records")
    except duckdb.Error as exc:
        raise HTTPException(503, detail="DATASET_SCHEMA_UNAVAILABLE") from exc
    finally:
        con.close()


def partition_files(dataset: str, start: str | None = None, end: str | None = None) -> list[Path]:
    root = DATA_DIR / "timeseries" / dataset
    local = sorted(root.glob("date=*.parquet")) if root.is_dir() else []
    remote_dates = STORE.list_dates(dataset)
    for date_iso in remote_dates:
        if start and date_iso < start:
            continue
        if end and date_iso > end:
            continue
        downloaded = STORE.download_partition(dataset, date_iso)
        if downloaded:
            local.append(downloaded)
    result = []
    seen = set()
    for path in sorted(local):
        name = path.name
        if not name.startswith("date="):
            continue
        date_iso = name[len("date=") : -len(".parquet")]
        if start and date_iso < start:
            continue
        if end and date_iso > end:
            continue
        key = f"{dataset}:{date_iso}"
        if key not in seen:
            seen.add(key)
            result.append(path)
    return result


def partition_rows(dataset: str, sql: str, params: list[Any] | None = None, start: str | None = None, end: str | None = None) -> list[dict[str, Any]]:
    files = partition_files(dataset, start, end)
    if not files:
        raise HTTPException(503, detail="DATASET_UNAVAILABLE")
    con = duckdb.connect(database=":memory:", read_only=False)
    try:
        con.read_parquet([str(path) for path in files]).create_view("dataset")
        return con.execute(sql, params or []).fetchdf().to_dict("records")
    except duckdb.Error as exc:
        raise HTTPException(503, detail="DATASET_SCHEMA_UNAVAILABLE") from exc
    finally:
        con.close()


def snapshot(name: str) -> Any:
    try:
        return json.loads(source_file(name).read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        raise HTTPException(503, detail="DATASET_SCHEMA_UNAVAILABLE") from exc


def number(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result if math.isfinite(result) else None


def text(value: Any) -> str | None:
    return str(value).strip() if value is not None and str(value).strip() else None


def day(value: Any) -> str | None:
    if isinstance(value, (date, datetime)):
        return value.date().isoformat() if isinstance(value, datetime) else value.isoformat()
    candidate = text(value)
    if not candidate:
        return None
    try:
        return date.fromisoformat(candidate[:10]).isoformat()
    except ValueError:
        return None


def response(data: Any, data_as_of: str | None, source: str):
    freshness = "UNAVAILABLE"
    if data_as_of:
        age = (datetime.now(timezone.utc).date() - date.fromisoformat(data_as_of)).days
        freshness = "STALE" if age > 7 else "EOD"
    return {"data": data, "meta": {"source": source, "fetchedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"), "dataAsOf": data_as_of, "freshness": freshness}}


def cached_direct(name: str, fn):
    now = datetime.now(timezone.utc).timestamp()
    cached = _SNAPSHOT_CACHE.get(name)
    if cached and now - cached[0] < SNAPSHOT_TTL_SECONDS:
        return cached[1]
    try:
        data = fn()
    except Exception as exc:
        raise HTTPException(503, detail="UPSTREAM_SCRAPER_UNAVAILABLE") from exc
    if not data:
        raise HTTPException(503, detail="UPSTREAM_SCRAPER_UNAVAILABLE")
    _SNAPSHOT_CACHE[name] = (now, data)
    return data


def scraper_company_profiles():
    from idx.scrapers.company import fetch_company_profiles

    return cached_direct("company_profiles", fetch_company_profiles)


def scraper_stock_summary(date_yyyymmdd: str | None = None):
    from idx.scrapers.trading import fetch_stock_summary

    key = f"stock_summary:{date_yyyymmdd or 'latest'}"
    return cached_direct(key, lambda: fetch_stock_summary(date=date_yyyymmdd))


def scraper_index_summary(date_yyyymmdd: str | None = None):
    from idx.scrapers.trading import fetch_index_summary

    key = f"index_summary:{date_yyyymmdd or 'latest'}"
    return cached_direct(key, lambda: fetch_index_summary(date=date_yyyymmdd))


def scraper_news(page: int, page_size: int):
    from idx.scrapers.news import fetch_news_search

    return cached_direct(f"news:{page}:{page_size}", lambda: fetch_news_search(page_number=page, page_size=page_size))


def scraper_announcements(keywords: str, page: int, page_size: int):
    from idx.scrapers.news import fetch_all_announcements

    return cached_direct(f"ann:{keywords}:{page}:{page_size}", lambda: fetch_all_announcements(keywords=keywords, page_number=page, page_size=page_size))


def records(raw: Any) -> list[dict[str, Any]]:
    data = raw.get("data", []) if isinstance(raw, dict) else raw
    return [row for row in data if isinstance(row, dict)] if isinstance(data, list) else []


def latest_partition_date(dataset: str) -> str | None:
    dates = []
    root = DATA_DIR / "timeseries" / dataset
    if root.is_dir():
        dates.extend(path.name[len("date=") : -len(".parquet")] for path in root.glob("date=*.parquet") if path.name.startswith("date="))
    dates.extend(STORE.list_dates(dataset))
    return max(dates) if dates else None


def parquet_latest_date(name: str) -> str | None:
    path = optional_source_file(f"parquet/{name}.parquet")
    if not path:
        return None
    try:
        rows = parquet_rows(name, "select max(Date) as Date from dataset")
    except HTTPException:
        return None
    return day(rows[0].get("Date")) if rows else None


def capability(dataset: str, direct: bool = False) -> dict[str, Any]:
    latest = latest_partition_date(dataset) or parquet_latest_date(dataset)
    if latest:
        age = (datetime.now(timezone.utc).date() - date.fromisoformat(latest)).days
        return {"status": "STALE" if age > 7 else "READY", "latestAvailableDate": latest}
    if direct:
        return {"status": "READY", "latestAvailableDate": None}
    return {"status": "UNAVAILABLE", "latestAvailableDate": None}


def validated_symbol(symbol: str) -> str:
    symbol = symbol.upper()
    if not SYMBOL.fullmatch(symbol):
        raise HTTPException(400, detail="INVALID_SYMBOL")
    return symbol


@app.get("/health")
def health():
    return {"status": "ok", "service": "heulatrade-market-api"}


@app.get("/ready")
def ready():
    caps = {
        "security_master": capability("security_master", direct=True),
        "latest_market": capability("stock_summary", direct=True),
        "historical_ohlcv": capability("stock_summary"),
        "index_summary": capability("index_summary", direct=True),
        "foreign_flow": capability("stock_summary"),
        "broker_market_flow": capability("broker_summary"),
        "news": capability("news", direct=True),
        "announcements": capability("announcements", direct=True),
    }
    latest = max((c["latestAvailableDate"] for c in caps.values() if c["latestAvailableDate"]), default=None)
    ready_now = caps["security_master"]["status"] == "READY" and caps["latest_market"]["status"] in ("READY", "STALE")
    return JSONResponse({"ready": ready_now, "capabilities": caps, "latestAvailableTradingDate": latest, "remoteStorage": {"provider": "supabase-storage", "bucket": SUPABASE_BUCKET, "prefix": SUPABASE_PREFIX, "configured": STORE.configured}}, status_code=200 if ready_now else 503)


@app.get("/v1/securities")
def securities(q: str = Query(default="", max_length=80)):
    raw_path = optional_source_file("allCompanies.json")
    raw = snapshot("allCompanies.json") if raw_path else scraper_company_profiles()
    rows = records(raw)
    result = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        symbol = text(row.get("KodeEmiten"))
        name = text(row.get("NamaEmiten"))
        if symbol and SYMBOL.fullmatch(symbol) and name:
            result.append({"symbol": symbol, "companyName": name, "sector": text(row.get("Sektor")), "subsector": text(row.get("SubSektor")), "board": text(row.get("PapanPencatatan"))})
    query = q.strip().casefold()
    filtered = [row for row in result if query in row["symbol"].casefold() or query in row["companyName"].casefold()]
    if query and len(filtered) < 20:
        fuzzy = [row for row in result if row not in filtered and max(SequenceMatcher(None, query, row["symbol"].casefold()).ratio(), SequenceMatcher(None, query, row["companyName"].casefold()[: max(len(query) + 4, 8)]).ratio()) >= 0.65]
        filtered.extend(fuzzy)
    return response(filtered[:100], None, "idx-bei/GetCompanyProfiles")


@app.get("/v1/stocks/{symbol}")
def stock(symbol: str, limit: int = Query(default=1600, ge=1, le=3000)):
    symbol = validated_symbol(symbol)
    try:
        rows = partition_rows("stock_summary", "select * from dataset where StockCode = ? order by Date desc limit ?", [symbol, limit])
    except HTTPException:
        try:
            rows = parquet_rows("stock_summary", "select * from dataset where StockCode = ? order by Date desc limit ?", [symbol, limit])
        except HTTPException:
            rows = [row for row in records(scraper_stock_summary()) if text(row.get("StockCode")) == symbol]
    if not rows:
        raise HTTPException(404, detail="SECURITY_NOT_FOUND")
    rows.reverse()
    candles = []
    for row in rows:
        session = day(row.get("Date"))
        close = number(row.get("Close"))
        if not session or close is None:
            continue
        candles.append({"time": session, "open": number(row.get("OpenPrice")), "high": number(row.get("High")), "low": number(row.get("Low")), "close": close, "volume": number(row.get("Volume")), "foreignBuy": number(row.get("ForeignBuy")), "foreignSell": number(row.get("ForeignSell"))})
    latest = rows[-1]
    latest_close = number(latest.get("Close"))
    previous = number(latest.get("Previous"))
    change = latest_close - previous if latest_close is not None and previous is not None else None
    quote = {"symbol": symbol, "timestamp": day(latest.get("Date")) or "", "open": number(latest.get("OpenPrice")), "high": number(latest.get("High")), "low": number(latest.get("Low")), "close": latest_close, "previousClose": previous, "change": change, "changePercent": change / previous if change is not None and previous else None, "volume": number(latest.get("Volume")), "value": number(latest.get("Value")), "frequency": number(latest.get("Frequency"))}
    return response({"quote": quote, "candles": candles}, quote["timestamp"] or None, "idx-bei/GetStockSummary + timeseries/stock_summary")


@app.get("/v1/market")
def market():
    try:
        stocks = partition_rows("stock_summary", "select StockCode, StockName, Date, Close, Previous, Volume, Value, Frequency from dataset where Date = (select max(Date) from dataset)")
    except HTTPException:
        try:
            stocks = parquet_rows("stock_summary", "select StockCode, StockName, Date, Close, Previous, Volume, Value, Frequency from dataset where Date = (select max(Date) from dataset)")
        except HTTPException:
            stocks = records(scraper_stock_summary())
    try:
        indices = partition_rows("index_summary", "select * from dataset where Date = (select max(Date) from dataset)")
    except HTTPException:
        try:
            indices = parquet_rows("index_summary", "select * from dataset where Date = (select max(Date) from dataset)")
        except HTTPException:
            indices = records(scraper_index_summary())
    trading_date = max((day(row.get("Date")) for row in stocks if day(row.get("Date"))), default=None)
    breadth = {"advancers": 0, "decliners": 0, "unchanged": 0, "value": 0.0, "volume": 0.0, "frequency": 0.0}
    movers = []
    for row in stocks:
        close, previous = number(row.get("Close")), number(row.get("Previous"))
        change = (close - previous) / previous if close is not None and previous else None
        if change is not None:
            breadth["advancers" if change > 0 else "decliners" if change < 0 else "unchanged"] += 1
        for key, field in [("value", "Value"), ("volume", "Volume"), ("frequency", "Frequency")]:
            amount = number(row.get(field))
            if amount is not None:
                breadth[key] += amount
        movers.append({"symbol": text(row.get("StockCode")), "name": text(row.get("StockName")), "close": close, "changePercent": change, "volume": number(row.get("Volume")), "value": number(row.get("Value")), "frequency": number(row.get("Frequency"))})
    mapped_indices = [{"code": text(row.get("IndexCode")), "name": text(row.get("IndexName")), "close": number(row.get("Close")), "previousClose": number(row.get("Previous")), "changePercent": (number(row.get("Close")) - number(row.get("Previous"))) / number(row.get("Previous")) if number(row.get("Close")) is not None and number(row.get("Previous")) else None} for row in indices]
    return response({"indices": mapped_indices, "breadth": breadth, "movers": movers}, trading_date, "idx-bei/GetStockSummary+GetIndexSummary")


@app.get("/v1/news")
def news(page: int = Query(default=1, ge=1, le=20), page_size: int = Query(default=50, ge=1, le=100)):
    rows = records(scraper_news(page, page_size))
    result = [{"date": day(row.get("PublishDate") or row.get("Date") or row.get("CreatedDate")), "title": text(row.get("Title") or row.get("Judul")), "summary": text(row.get("Summary") or row.get("Description") or row.get("Konten")), "url": text(row.get("Url") or row.get("Link")), "raw": row} for row in rows]
    latest = max((item["date"] for item in result if item["date"]), default=None)
    return response(result, latest, "idx-bei/GetNewsSearch")


@app.get("/v1/announcements")
def announcements(keywords: str = Query(default="", max_length=80), page: int = Query(default=1, ge=1, le=20), page_size: int = Query(default=50, ge=1, le=100)):
    rows = records(scraper_announcements(keywords, page, page_size))
    result = [{"date": day(row.get("TanggalPengumuman") or row.get("PublishDate") or row.get("Date")), "symbol": text(row.get("KodeEmiten") or row.get("StockCode")), "title": text(row.get("Judul") or row.get("Title") or row.get("Perihal")), "documentUrl": text(row.get("Url") or row.get("Attachment") or row.get("Link")), "raw": row} for row in rows]
    latest = max((item["date"] for item in result if item["date"]), default=None)
    return response(result, latest, "idx-bei/GetAllAnnouncement")


@app.get("/v1/stocks/{symbol}/fundamentals")
def fundamentals(symbol: str):
    symbol = validated_symbol(symbol)
    rows = parquet_rows("financial_ratios", "select * from dataset where code = ? order by fsDate desc limit 40", [symbol])
    result = []
    fields = ["assets", "liabilities", "equity", "sales", "operatingProfit", "netIncome", "eps", "per", "pbv", "roa", "roe", "npm", "opm", "der", "marketCap", "dividendYield"]
    for row in rows:
        result.append({"periodDate": day(row.get("fsDate")), "periodType": text(row.get("fsType")) or "UNKNOWN", "metrics": {field: number(row.get(field)) for field in fields}})
    return response(result, result[0]["periodDate"] if result else None, "idx-bei/financial_ratios.parquet")


@app.get("/v1/stocks/{symbol}/actions")
def actions(symbol: str):
    symbol = validated_symbol(symbol)
    rows = parquet_rows("corporate_actions", "select * from dataset where KodeEmiten = ? order by TanggalPencatatan desc limit 100", [symbol])
    result = [{"date": day(row.get("TanggalPencatatan")), "type": text(row.get("caType")) or text(row.get("JenisTindakan")), "description": text(row.get("JenisTindakan")), "documentUrl": text(row.get("Url"))} for row in rows]
    return response(result, result[0]["date"] if result else None, "idx-bei/corporate_actions.parquet")


@app.get("/v1/stocks/{symbol}/profile")
def profile(symbol: str):
    symbol = validated_symbol(symbol)
    raw = snapshot("companyDetailsByKodeEmiten.json")
    entry = raw.get(symbol) if isinstance(raw, dict) else None
    if not isinstance(entry, dict):
        raise HTTPException(404, detail="PROFILE_NOT_FOUND")
    profiles = entry.get("Profiles")
    head = profiles[0] if isinstance(profiles, list) and profiles and isinstance(profiles[0], dict) else {}
    result = {"symbol": symbol, "companyName": text(head.get("NamaEmiten")), "website": text(head.get("Website")), "description": text(head.get("KegiatanUsahaUtama")), "directors": entry.get("Direksi") if isinstance(entry.get("Direksi"), list) else [], "commissioners": entry.get("Komisaris") if isinstance(entry.get("Komisaris"), list) else [], "shareholders": entry.get("PemegangSaham") if isinstance(entry.get("PemegangSaham"), list) else [], "subsidiaries": entry.get("AnakPerusahaan") if isinstance(entry.get("AnakPerusahaan"), list) else []}
    return response(result, None, "idx-bei/companyDetailsByKodeEmiten.json")


@app.get("/v1/signals")
def signals():
    files = sorted((DATA_DIR / "briefings").glob("briefing_*.json"))
    if not files:
        raise HTTPException(503, detail="DATASET_UNAVAILABLE")
    raw = snapshot(f"briefings/{files[-1].name}")
    if not isinstance(raw, dict) or not isinstance(raw.get("foreign_flow_radar"), list):
        raise HTTPException(503, detail="DATASET_SCHEMA_UNAVAILABLE")
    rows = []
    for row in raw["foreign_flow_radar"]:
        if not isinstance(row, dict):
            continue
        symbol = text(row.get("StockCode"))
        signal = row.get("Signal")
        if symbol and SYMBOL.fullmatch(symbol) and signal in ("accumulate", "distribute"):
            rows.append({"symbol": symbol, "close": number(row.get("Close")), "sessions": number(row.get("Sessions")), "netForeignMillionShares": number(row.get("NFF_MSh")), "percentFloat": number(row.get("PctFloat")), "averageValueBillionIdr": number(row.get("AvgValueRpB")), "signal": signal})
    trading_date = day(raw.get("trade_date"))
    return response({"tradingDate": trading_date, "foreignFlow": rows}, trading_date, "idx-bei/briefings")


SCREEN_FIELDS = {"price", "volume", "value", "frequency", "foreignNetShares", "marketCap", "per", "pbv", "roe", "roa", "eps", "der", "dividendYield", "change1D"}


class ScreenCondition(BaseModel):
    field: str
    operator: Literal["GT", "GTE", "LT", "LTE", "EQ"]
    value: float
    connective: Literal["AND", "OR"] = "AND"


class ScreenRequest(BaseModel):
    conditions: list[ScreenCondition] = Field(default_factory=list, max_length=20)
    limit: int = Field(default=500, ge=1, le=1000)


def matches(actual: float | None, condition: ScreenCondition) -> bool:
    if actual is None:
        return False
    return {"GT": actual > condition.value, "GTE": actual >= condition.value, "LT": actual < condition.value, "LTE": actual <= condition.value, "EQ": actual == condition.value}[condition.operator]


@app.post("/v1/screener")
def screener(request: ScreenRequest):
    if any(condition.field not in SCREEN_FIELDS for condition in request.conditions):
        raise HTTPException(400, detail="UNSUPPORTED_SCREEN_FIELD")
    stocks = parquet_rows("stock_summary", "select * from dataset where Date = (select max(Date) from dataset)")
    ratios = parquet_rows("financial_ratios", "select * exclude (rn) from (select *, row_number() over (partition by code order by fsDate desc) rn from dataset) where rn = 1")
    ratios_by_code = {text(row.get("code")): row for row in ratios}
    rows = []
    for stock_row in stocks:
        symbol = text(stock_row.get("StockCode"))
        if not symbol or not SYMBOL.fullmatch(symbol):
            continue
        ratio_row = ratios_by_code.get(symbol, {})
        close, previous = number(stock_row.get("Close")), number(stock_row.get("Previous"))
        foreign_buy, foreign_sell = number(stock_row.get("ForeignBuy")), number(stock_row.get("ForeignSell"))
        values = {"price": close, "volume": number(stock_row.get("Volume")), "value": number(stock_row.get("Value")), "frequency": number(stock_row.get("Frequency")), "foreignNetShares": foreign_buy - foreign_sell if foreign_buy is not None and foreign_sell is not None else None, "change1D": (close - previous) / previous if close is not None and previous else None}
        values.update({field: number(ratio_row.get(field)) for field in ("marketCap", "per", "pbv", "roe", "roa", "eps", "der", "dividendYield")})
        accepted = True
        for index, condition in enumerate(request.conditions):
            matched = matches(values[condition.field], condition)
            accepted = matched if index == 0 else (accepted and matched if condition.connective == "AND" else accepted or matched)
        if accepted:
            rows.append({"symbol": symbol, "name": text(stock_row.get("StockName")), **values})
    rows.sort(key=lambda row: (row["value"] is None, -(row["value"] or 0)))
    trading_date = max((day(row.get("Date")) for row in stocks if day(row.get("Date"))), default=None)
    return response({"rows": rows[: request.limit], "total": len(rows), "supportedFields": sorted(SCREEN_FIELDS)}, trading_date, "idx-bei/stock_summary+financial_ratios.parquet")
