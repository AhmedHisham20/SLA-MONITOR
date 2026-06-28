from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

EGYPT_TZ = ZoneInfo("Africa/Cairo")


def now_egypt() -> datetime:
    return datetime.now(EGYPT_TZ)


def today_start_utc() -> datetime:
    """Midnight today Egypt time, converted to UTC for DB queries."""
    egypt_now = datetime.now(EGYPT_TZ)
    egypt_midnight = egypt_now.replace(hour=0, minute=0, second=0, microsecond=0)
    return egypt_midnight.astimezone(timezone.utc)


def yesterday_range_utc() -> tuple[datetime, datetime]:
    """(start, end) of yesterday in Egypt time as UTC."""
    egypt_now = datetime.now(EGYPT_TZ)
    egypt_today_midnight = egypt_now.replace(hour=0, minute=0, second=0, microsecond=0)
    egypt_yesterday_midnight = egypt_today_midnight - timedelta(days=1)
    return (
        egypt_yesterday_midnight.astimezone(timezone.utc),
        egypt_today_midnight.astimezone(timezone.utc),
    )


def days_ago_start_utc(days: int) -> datetime:
    """N days ago midnight Egypt time as UTC."""
    egypt_now = datetime.now(EGYPT_TZ)
    egypt_midnight = egypt_now.replace(hour=0, minute=0, second=0, microsecond=0)
    target = egypt_midnight - timedelta(days=days)
    return target.astimezone(timezone.utc)


def month_start_utc() -> datetime:
    """First day of current month midnight Egypt time as UTC."""
    egypt_now = datetime.now(EGYPT_TZ)
    egypt_month_start = egypt_now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return egypt_month_start.astimezone(timezone.utc)


def egypt_date_to_utc(date_str: str) -> datetime:
    """Convert 'YYYY-MM-DD' date string (Egypt calendar day) to UTC midnight of that day."""
    parts = date_str.split("-")
    year, month, day = int(parts[0]), int(parts[1]), int(parts[2])
    egypt_dt = datetime(year, month, day, tzinfo=EGYPT_TZ)
    return egypt_dt.astimezone(timezone.utc)
