from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.report import ReportResponse, ReportMetrics, ReportChartData, ModeratorPerformanceList
from app.services.report import get_report_metrics, get_report_charts, get_moderator_performance
from app.api.deps import get_current_user
from app.models.user import User
from app.core.logging import logger
import csv
import io

router = APIRouter(prefix="/reports", tags=["Reports"])


def _get_date_range(period: str):
    now = datetime.now(timezone.utc)
    if period == "daily":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end = now
    elif period == "weekly":
        start = now - timedelta(days=7)
        end = now
    elif period == "monthly":
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end = now
    else:
        start = now - timedelta(days=30)
        end = now
    return start, end


@router.get("", response_model=ReportResponse)
def get_report(
    period: str = Query("daily"),
    page_id: str = Query(None),
    start_date: str = Query(None),
    end_date: str = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if period == "custom" and start_date and end_date:
        start = datetime.fromisoformat(start_date)
        end = datetime.fromisoformat(end_date)
    else:
        start, end = _get_date_range(period)

    metrics = get_report_metrics(db, start, end, page_id)
    charts = get_report_charts(db, start, end, page_id)

    return ReportResponse(
        period=period,
        start_date=start,
        end_date=end,
        metrics=metrics,
        charts=charts,
    )


@router.get("/moderators", response_model=ModeratorPerformanceList)
def moderator_performance(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=days)
    performers = get_moderator_performance(db, start, end)
    return ModeratorPerformanceList(moderators=performers)


@router.get("/export/csv")
def export_csv(
    period: str = Query("daily"),
    page_id: str = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    start, end = _get_date_range(period)
    metrics = get_report_metrics(db, start, end, page_id)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Metric", "Value"])
    writer.writerow(["Total Messages", metrics.total_messages])
    writer.writerow(["Total Conversations", metrics.total_conversations])
    writer.writerow(["Average Response Time (s)", metrics.average_response_time_seconds or "N/A"])
    writer.writerow(["Delayed Conversations", metrics.delayed_conversations])
    writer.writerow(["SLA Compliance Rate (%)", metrics.sla_compliance_rate])
    writer.writerow(["Total Alerts Sent", metrics.total_alerts_sent])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=sla-report-{period}.csv"},
    )
