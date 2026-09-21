import json

import pandas as pd
import pytest
from fastapi.testclient import TestClient

import app as market_app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(market_app, "DATA_DIR", tmp_path)
    parquet = tmp_path / "parquet"
    parquet.mkdir()
    pd.DataFrame([
        {"Date": "2026-09-18", "StockCode": "BBCA", "StockName": "Bank Central Asia", "Previous": 8900, "OpenPrice": 8950, "High": 9100, "Low": 8900, "Close": 9000, "Volume": 100, "Value": 900000, "Frequency": 5, "ForeignBuy": 20, "ForeignSell": 10},
        {"Date": "2026-09-21", "StockCode": "BBCA", "StockName": "Bank Central Asia", "Previous": 9000, "OpenPrice": None, "High": None, "Low": None, "Close": 9100, "Volume": None, "Value": None, "Frequency": None, "ForeignBuy": None, "ForeignSell": None},
    ]).to_parquet(parquet / "stock_summary.parquet")
    pd.DataFrame([{"Date": "2026-09-21", "IndexCode": "IHSG", "IndexName": "Composite", "Close": 7231, "Previous": 7200}]).to_parquet(parquet / "index_summary.parquet")
    pd.DataFrame([{"code": "BBCA", "fsDate": "2026-06-30", "fsType": "QUARTERLY", "sales": 100, "roe": 20}]).to_parquet(parquet / "financial_ratios.parquet")
    pd.DataFrame([{"KodeEmiten": "BBCA", "TanggalPencatatan": "2026-04-01", "caType": "Dividen", "JenisTindakan": "Cash dividend"}]).to_parquet(parquet / "corporate_actions.parquet")
    (tmp_path / "allCompanies.json").write_text(json.dumps({"data": [{"KodeEmiten": "BBCA", "NamaEmiten": "Bank Central Asia", "Sektor": "Financials"}]}))
    (tmp_path / "companyDetailsByKodeEmiten.json").write_text(json.dumps({"BBCA": {"Profiles": [{"NamaEmiten": "Bank Central Asia"}], "Direksi": [{"Nama": "Director A"}]}}))
    return TestClient(market_app.app)


def test_stock_contract_preserves_missing_values(client):
    result = client.get("/v1/stocks/BBCA")
    assert result.status_code == 200
    body = result.json()
    assert body["data"]["quote"]["close"] == 9100
    assert body["data"]["quote"]["open"] is None
    assert body["data"]["quote"]["volume"] is None
    assert body["data"]["quote"]["changePercent"] == pytest.approx(100 / 9000)
    assert body["data"]["candles"][1]["high"] is None
    assert body["meta"]["source"] == "idx-bei/stock_summary.parquet"


def test_search_market_and_reference_contracts(client):
    assert client.get("/v1/securities?q=central").json()["data"][0]["symbol"] == "BBCA"
    market = client.get("/v1/market").json()["data"]
    assert market["indices"][0]["code"] == "IHSG"
    assert market["movers"][0]["changePercent"] == pytest.approx(100 / 9000)
    assert client.get("/v1/stocks/BBCA/fundamentals").json()["data"][0]["metrics"]["roe"] == 20
    assert client.get("/v1/stocks/BBCA/profile").json()["data"]["directors"][0]["Nama"] == "Director A"
    assert client.get("/v1/stocks/BBCA/actions").json()["data"][0]["type"] == "Dividen"


def test_invalid_symbol_and_unavailable_source(client, tmp_path):
    assert client.get("/v1/stocks/%27%3Bdrop%20table").status_code == 400
    (tmp_path / "parquet" / "stock_summary.parquet").unlink()
    assert client.get("/v1/stocks/BBCA").status_code == 503


def test_screener_keeps_null_distinct_from_zero(client):
    result = client.post("/v1/screener", json={"conditions": [{"field": "price", "operator": "GT", "value": 9000}, {"field": "roe", "operator": "GTE", "value": 20}], "limit": 100})
    assert result.status_code == 200
    rows = result.json()["data"]["rows"]
    assert len(rows) == 1 and rows[0]["symbol"] == "BBCA"
    assert rows[0]["volume"] is None
    assert rows[0]["roe"] == 20
    assert client.post("/v1/screener", json={"conditions": [{"field": "brokerNet", "operator": "GT", "value": 0}]}).status_code == 400
