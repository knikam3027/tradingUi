import asyncio
import json
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse

from app.routes.api_routes import nifty_strikes

router = APIRouter()


def _parse_selected_strike(value: str | None) -> float | None:
    if not value:
        return None
    try:
        return float(value)
    except ValueError:
        return None


@router.websocket("/market/strikes")
async def websocket_market_strikes(websocket: WebSocket):
    await websocket.accept()
    selected_strike = _parse_selected_strike(websocket.query_params.get("selectedStrike"))

    try:
        while True:
            try:
                payload = await nifty_strikes(selected_strike=str(selected_strike) if selected_strike is not None else None)
                if isinstance(payload, JSONResponse):
                    body = json.loads(payload.body.decode("utf-8") if isinstance(payload.body, (bytes, bytearray)) else str(payload.body))
                else:
                    body = payload
            except Exception as err:
                body = {
                    "status": "error",
                    "connected": False,
                    "message": str(err),
                }

            await websocket.send_text(json.dumps(body))
            await asyncio.sleep(5)
    except WebSocketDisconnect:
        return
    except Exception:
        return
