from datetime import date

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./dev.db"
    # Fixed "today" so the sample cohort always looks the same. None uses the real date.
    demo_today: date | None = date(2026, 10, 19)
    allow_reset: bool = True
    # Send the sign-in cookie over HTTPS only. Turn on wherever the site is hosted.
    cookie_secure: bool = False
    # Off: nobody signs in and every request acts as the program manager, so
    # the hosted demo opens straight on the dashboard. Turn on to require it.
    require_sign_in: bool = False

    def today(self) -> date:
        return self.demo_today or date.today()


settings = Settings()
