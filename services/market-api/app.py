"""Read-only normalized API over datasets produced by nichsedge/idx-bei.

idx-bei remains the scraper, ingestion and analytical engine. This service
reads its persisted snapshots and exposes a narrow, validated product contract.
"""

from __future__ import annotations

import json
import math
import os
import re
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


def source_file(name: str) -> Path:
    path = DATA_DIR / name
    if not path.is_file():
        raise HTTPException(503, detail="DATASET_UNAVAILABLE")
    return path


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
    required = ["parquet/stock_summary.parquet", "allCompanies.json"]
    missing = [name for name in required if not (DATA_DIR / name).is_file()]
    return JSONResponse({"ready": not missing, "missing": missing}, status_code=503 if missing else 200)


@app.get("/v1/securities")
def securities(q: str = Query(default="", max_length=80)):
    raw = snapshot("allCompanies.json")
    rows = raw.get("data", []) if isinstance(raw, dict) else raw
    if not isinstance(rows, list):
        raise HTTPException(503, detail="DATASET_SCHEMA_UNAVAILABLE")
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
    return response(filtered[:100], None, "idx-bei/allCompanies.json")


@app.get("/v1/stocks/{symbol}")
def stock(symbol: str, limit: int = Query(default=1600, ge=1, le=3000)):
    symbol = validated_symbol(symbol)
    rows = parquet_rows("stock_summary", "select * from dataset where StockCode = ? order by Date desc limit ?", [symbol, limit])
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
    return response({"quote": quote, "candles": candles}, quote["timestamp"] or None, "idx-bei/stock_summary.parquet")


@app.get("/v1/market")
def market():
    stocks = parquet_rows("stock_summary", "select StockCode, StockName, Date, Close, Previous, Volume, Value, Frequency from dataset where Date = (select max(Date) from dataset)")
    indices = parquet_rows("index_summary", "select * from dataset where Date = (select max(Date) from dataset)")
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
    return response({"indices": mapped_indices, "breadth": breadth, "movers": movers}, trading_date, "idx-bei/stock_summary+index_summary.parquet")


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
