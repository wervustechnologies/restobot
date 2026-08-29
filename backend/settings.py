from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    jwt_secret_key: str
    firebase_credentials: str | None = None
    firebase_credentials_path: str | None = None
    firebase_database_url: str = ""
    allowed_origins: str = ""

    access_token_expires_minutes: int = 15
    refresh_token_expires_days: int = 30

    ratelimit_storage_uri: str = "memory://"
    ratelimit_default: str = "200 per minute"
    ratelimit_auth: str = "10 per minute"
    ratelimit_write: str = "30 per minute"
    ratelimit_ai: str = "20 per minute"
    ratelimit_read: str = "60 per minute"

    # Apiary mock for now — point at Petpooja's production URL when confirmed.
    petpooja_api_base: str = "https://private-anon-0d6061890b-onlineorderingapisv210.apiary-mock.com"
    petpooja_timeout_seconds: int = 15


settings = Settings()
