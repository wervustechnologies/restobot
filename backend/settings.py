from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    jwt_secret_key: str
    firebase_credentials: str | None = None
    firebase_credentials_path: str | None = None
    firebase_database_url: str = ""
    frontend_url: str = ""

    ratelimit_storage_uri: str = "memory://"
    ratelimit_default: str = "200 per minute"
    ratelimit_auth: str = "10 per minute"
    ratelimit_write: str = "30 per minute"
    ratelimit_ai: str = "20 per minute"
    ratelimit_read: str = "60 per minute"


settings = Settings()
