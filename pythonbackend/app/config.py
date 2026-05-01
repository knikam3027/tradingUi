import os
from pathlib import Path

from dotenv import load_dotenv


BACKEND_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = BACKEND_ROOT / "data"

load_dotenv(BACKEND_ROOT / ".env")

PORT = int(os.getenv("PORT", "8000"))
HDFC_BASE_URL = "https://developer.hdfcsky.com/oapi/v1"
HDFC_API_KEY = os.getenv("HDFC_API_KEY", "")
HDFC_API_SECRET = os.getenv("HDFC_API_SECRET", "")
HDFC_ACCESS_TOKEN = os.getenv("HDFC_ACCESS_TOKEN") or None
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)
CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://cbamoon.com",
    "https://www.cbamoon.com",
]
