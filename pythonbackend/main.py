import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS, PORT
from app.models.auth_model import is_connected, load_persisted_token
from app.routes.api_routes import router as api_router
from app.routes.auth_routes import router as auth_router


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


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=int(PORT))

    