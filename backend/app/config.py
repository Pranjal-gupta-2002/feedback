import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from the backend directory
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

class Settings:
    PROJECT_NAME: str = os.getenv("PROJECT_NAME", "PulseReview Enterprise Moderation System")
    API_V1_STR: str = os.getenv("API_V1_STR", "/api")
    MONGODB_URL: str = os.getenv("MONGODB_URL") or os.getenv("MONGODB_URI") or "mongodb://localhost:27017"
    DATABASE_NAME: str = os.getenv("DATABASE_NAME", "feedback_db")
    PORT: int = int(os.getenv("PORT", 8000))
    CLOUDINARY_CLOUD_NAME: str = os.getenv("CLOUDINARY_CLOUD_NAME", "")
    CLOUDINARY_API_KEY: str = os.getenv("CLOUDINARY_API_KEY", "")
    CLOUDINARY_API_SECRET: str = os.getenv("CLOUDINARY_API_SECRET", "")
    CLOUDINARY_URL: str = os.getenv("CLOUDINARY_URL", "")

    CORS_ORIGINS: list = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*"
    ]

settings = Settings()
