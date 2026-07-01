from pydantic_settings import BaseSettings
from typing import List, Optional
from datetime import time


class Settings(BaseSettings):
    APP_NAME: str = "Messenger SLA Monitor"
    DEBUG: bool = False

    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/messenger_sla"
    REDIS_URL: str = "redis://localhost:6379/0"

    JWT_SECRET_KEY: str = "change-this-secret-key-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 1440

    FACEBOOK_APP_ID: Optional[str] = None
    FACEBOOK_APP_SECRET: Optional[str] = None
    FACEBOOK_VERIFY_TOKEN: str = "messenger-sla-verify-token"
    FACEBOOK_ACCESS_TOKEN: Optional[str] = None
    FACEBOOK_GRAPH_API_VERSION: str = "v22.0"
    FACEBOOK_GRAPH_API_URL: str = "https://graph.facebook.com/v22.0"

    WHATSAPP_PHONE_NUMBER_ID: Optional[str] = None
    WHATSAPP_ACCESS_TOKEN: Optional[str] = None
    WHATSAPP_API_VERSION: str = "v22.0"
    WHATSAPP_API_URL: str = "https://graph.facebook.com/v22.0"

    SLA_DELAY_THRESHOLD_MINUTES: int = 5
    WORKING_HOURS_START: str = "10:00"
    WORKING_HOURS_END: str = "22:00"
    WORKING_TIMEZONE: str = "Africa/Cairo"

    DAILY_SUMMARY_TIME: str = "23:00"
    DAILY_SUMMARY_ENABLED: bool = True
    WEEKLY_SUMMARY_ENABLED: bool = True

    COMPANY_NAME: str = "SLA Monitor"
    DEMO_MODE: bool = False
    FRONTEND_URL: str = "https://dashboard.ahmedhisham.site"

    UPLOAD_DIR: str = "/app/uploads"

    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173", "https://dashboard.ahmedhisham.site"]

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
