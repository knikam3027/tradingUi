from typing import Any
from urllib.parse import urlencode

from fastapi import APIRouter, Body, Query
from fastapi.responses import JSONResponse, RedirectResponse

from app.config import FRONTEND_URL, HDFC_API_KEY, HDFC_BASE_URL
from app.models.auth_model import (
    authorize,
    exchange_token,
    get_token_id,
    get_token_id_value,
    is_connected,
    login_validate,
    set_access_token,
    validate_2fa,
    validate_otp,
)


router = APIRouter()


@router.get("/login")
async def login():
    login_url = f"{HDFC_BASE_URL}/login?{urlencode({'api_key': HDFC_API_KEY})}"
    return RedirectResponse(login_url)


@router.get("/callback")
async def callback(
    request_token: str | None = Query(default=None),
    requestToken: str | None = Query(default=None),
):
    final_request_token = request_token or requestToken
    if not final_request_token:
        return JSONResponse({"status": "error", "message": "Missing request_token"}, status_code=400)

    try:
        data = await exchange_token(final_request_token)
        if data.get("accessToken"):
            set_access_token(data["accessToken"])
            print("HDFC Sky access token obtained successfully")
            return RedirectResponse(FRONTEND_URL)

        print(f"Failed to get access token: {data}")
        return JSONResponse(
            {"status": "error", "message": "Failed to get access token", "data": data},
            status_code=401,
        )
    except Exception as err:
        print(f"Auth callback error: {err}")
        return JSONResponse({"status": "error", "message": str(err)}, status_code=500)


@router.get("/exchange")
async def exchange(token: str | None = Query(default=None)):
    if not token:
        return JSONResponse(
            {
                "status": "error",
                "message": "Usage: /auth/exchange?token=YOUR_REQUEST_TOKEN",
                "hint": "Copy the requestToken value from the cbamoon.com redirect URL",
            },
            status_code=400,
        )

    try:
        data = await exchange_token(token)
        if data.get("accessToken"):
            set_access_token(data["accessToken"])
            print("HDFC Sky access token obtained via manual exchange")
            return {"status": "success", "message": "Connected to HDFC Sky!", "connected": True}

        return JSONResponse({"status": "error", "message": "Token exchange failed", "data": data}, status_code=401)
    except Exception as err:
        return JSONResponse({"status": "error", "message": str(err)}, status_code=500)


@router.post("/api/init")
async def api_init():
    try:
        data = await get_token_id()
        return {"status": "success", "data": data}
    except Exception as err:
        return JSONResponse({"status": "error", "message": str(err)}, status_code=500)


@router.post("/api/login")
async def api_login(payload: dict[str, Any] | None = Body(default=None)):
    try:
        username = (payload or {}).get("username")
        if not username:
            return JSONResponse({"status": "error", "message": "username required"}, status_code=400)
        data = await login_validate(username)
        return {"status": "success", "data": data}
    except Exception as err:
        return JSONResponse({"status": "error", "message": str(err)}, status_code=500)


@router.post("/api/otp")
async def api_otp(payload: dict[str, Any] | None = Body(default=None)):
    try:
        otp = (payload or {}).get("otp")
        if not otp:
            return JSONResponse({"status": "error", "message": "otp required"}, status_code=400)
        data = await validate_otp(otp)
        return {"status": "success", "data": data}
    except Exception as err:
        return JSONResponse({"status": "error", "message": str(err)}, status_code=500)


@router.post("/api/pin")
async def api_pin(payload: dict[str, Any] | None = Body(default=None)):
    try:
        pin = (payload or {}).get("pin")
        if not pin:
            return JSONResponse({"status": "error", "message": "pin required"}, status_code=400)

        data = await validate_2fa(pin)
        if data.get("requestToken"):
            auth_data = await authorize(data["requestToken"])
            final_token = auth_data.get("requestToken") or data["requestToken"]
            token_data = await exchange_token(final_token)

            if token_data.get("accessToken"):
                set_access_token(token_data["accessToken"])
                print("HDFC Sky connected via API login flow")
                return {"status": "success", "connected": True, "message": "Connected to HDFC Sky!"}
            return {"status": "partial", "data": token_data, "message": "Token exchange step - check data"}

        return {"status": "success", "data": data}
    except Exception as err:
        return JSONResponse({"status": "error", "message": str(err)}, status_code=500)


async def status_payload():
    return {
        "status": "success",
        "connected": is_connected(),
        "broker": "HDFC Sky",
        "tokenId": "active" if get_token_id_value() else None,
    }


@router.get("/status")
async def status():
    return await status_payload()
