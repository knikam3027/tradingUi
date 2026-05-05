import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd

from app.config import CORS_ORIGINS, PORT
from app.models.auth_model import is_connected, load_persisted_token
from app.routes.api_routes import router as api_router
from app.routes.auth_routes import router as auth_router
from app.models.indicator_model import calc_rsi, calc_roc, calc_dmi_adx, calc_chop


load_persisted_token()

app = FastAPI(title="Trading Platform Python Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/auth")
app.include_router(api_router, prefix="/api/v1")


@app.get("/")
async def health_check():
    return {
        "message": "Python backend running",
        "status": "active",
        "broker": "HDFC Sky",
        "connected": is_connected(),
    }


@app.get("/indicators")
async def get_indicators():
    # Example data structure for market prices
    data = {
        "close": [357.65, 358.00, 357.75, 358.50, 359.00, 358.75, 358.25, 357.50, 357.00, 356.50],
        "high": [358.00, 358.50, 358.25, 359.00, 359.50, 359.25, 358.75, 358.00, 357.50, 357.00],
        "low": [357.00, 357.50, 357.25, 358.00, 358.50, 358.25, 357.75, 357.00, 356.50, 356.00],
        "volume": [1000, 1200, 1100, 1300, 1250, 1150, 1050, 1000, 950, 900]
    }

    df = pd.DataFrame(data)

    rsi = calc_rsi(df)
    roc = calc_roc(df)
    plus_di, minus_di, adx = calc_dmi_adx(df)
    chop = calc_chop(df)

    dx = 100 * (plus_di - minus_di).abs() / (plus_di + minus_di)

    return {
        "RSI": rsi.iloc[-1],
        "ROC": roc.iloc[-1],
        "+DI": plus_di.iloc[-1],
        "-DI": minus_di.iloc[-1],
        "DX": dx.iloc[-1],
        "ADX": adx.iloc[-1],
        "CHOP": chop.iloc[-1]
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=int(PORT))

