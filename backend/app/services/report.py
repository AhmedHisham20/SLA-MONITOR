from datetime import datetime, timezone, timedelta
from typing import List, Optional
from sqlalchemy import func, case
from sqlalchemy.orm import Session
from app.models.conversation import Conversation, SLAStatus
from app.models.alert import Alert
from app.models.page import FacebookPage
from app.schemas.report import ReportMetrics, ReportChartData, ModeratorPerformance


def _apply_monitored_filter(query, page_id=None):
    query = query.join(FacebookPage, Conversation.page_id == FacebookPage.page_id).filter(
        FacebookPage.monitoring_enabled == True
    )
    if page_id:
        query = query.filter(Conversation.page_id == page_id)
    return query


def get_report_metrics(
    db: Session,
    start_date: datetime,
    end_date: datetime,
    page_id: Optional[str] = None,
) -> ReportMetrics:
    query = db.query(Conversation).filter(
        Conversation.message_timestamp >= start_date,
        Conversation.message_timestamp <= end_date,
    )
    query = _apply_monitored_filter(query, page_id)
    conversations = query.all()

    total = len(conversations)
    total_messages = sum(c.message_count or 1 for c in conversations)
    delayed = sum(1 for c in conversations if c.sla_status == SLAStatus.DELAYED)
    responded = [c for c in conversations if c.has_human_reply and c.response_time_seconds is not None]

    avg_response = None
    if responded:
        avg_response = int(sum(r.response_time_seconds for r in responded) / len(responded))

    sla_rate = 100.0
    if total > 0:
        compliant = total - delayed
        sla_rate = round((compliant / total) * 100, 2)

    alert_query = db.query(Alert).filter(
        Alert.sent_at >= start_date,
        Alert.sent_at <= end_date,
    )
    alerts_count = alert_query.count()

    return ReportMetrics(
        total_messages=total_messages,
        total_conversations=total,
        average_response_time_seconds=avg_response,
        delayed_conversations=delayed,
        sla_compliance_rate=sla_rate,
        total_alerts_sent=alerts_count,
    )


def get_report_charts(
    db: Session,
    start_date: datetime,
    end_date: datetime,
    page_id: Optional[str] = None,
) -> ReportChartData:
    messages_per_day = _get_messages_per_day(db, start_date, end_date, page_id)
    response_trend = _get_response_trend(db, start_date, end_date, page_id)
    delayed_trend = _get_delayed_trend(db, start_date, end_date, page_id)
    sla_trend = _get_sla_trend(db, start_date, end_date, page_id)

    return ReportChartData(
        messages_per_day=messages_per_day,
        response_time_trend=response_trend,
        delayed_trend=delayed_trend,
        sla_trend=sla_trend,
    )


def _get_messages_per_day(db, start, end, page_id):
    query = db.query(
        func.date(Conversation.message_timestamp).label("date"),
        func.count(Conversation.id).label("count"),
    ).filter(
        Conversation.message_timestamp >= start,
        Conversation.message_timestamp <= end,
    )
    query = _apply_monitored_filter(query, page_id)
    query = query.group_by(func.date(Conversation.message_timestamp)).order_by("date")
    return [{"label": str(row.date), "value": row.count} for row in query.all()]


def _get_response_trend(db, start, end, page_id):
    query = db.query(
        func.date(Conversation.message_timestamp).label("date"),
        func.avg(Conversation.response_time_seconds).label("avg_time"),
    ).filter(
        Conversation.message_timestamp >= start,
        Conversation.message_timestamp <= end,
        Conversation.has_human_reply == True,
        Conversation.response_time_seconds.isnot(None),
    )
    query = _apply_monitored_filter(query, page_id)
    query = query.group_by(func.date(Conversation.message_timestamp)).order_by("date")
    return [{"label": str(row.date), "value": round(row.avg_time, 1)} for row in query.all()]


def _get_delayed_trend(db, start, end, page_id):
    query = db.query(
        func.date(Conversation.message_timestamp).label("date"),
        func.count(Conversation.id).label("count"),
    ).filter(
        Conversation.message_timestamp >= start,
        Conversation.message_timestamp <= end,
        Conversation.sla_status == SLAStatus.DELAYED,
    )
    query = _apply_monitored_filter(query, page_id)
    query = query.group_by(func.date(Conversation.message_timestamp)).order_by("date")
    return [{"label": str(row.date), "value": row.count} for row in query.all()]


def _get_sla_trend(db, start, end, page_id):
    results = []
    current = start
    while current <= end:
        day_end = current + timedelta(days=1)
        metrics = get_report_metrics(db, current, day_end, page_id)
        results.append({
            "label": current.strftime("%Y-%m-%d"),
            "value": metrics.sla_compliance_rate,
        })
        current = day_end
    return results


def get_moderator_performance(
    db: Session,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> List[ModeratorPerformance]:
    if not start_date:
        start_date = datetime.now(timezone.utc) - timedelta(days=30)
    if not end_date:
        end_date = datetime.now(timezone.utc)

    query = db.query(
        Conversation.moderator_name,
        func.count(Conversation.id).label("total_conversations"),
        func.avg(Conversation.response_time_seconds).label("avg_response"),
        func.sum(
            case((Conversation.sla_status == SLAStatus.DELAYED, 1), else_=0)
        ).label("delayed_count"),
    ).filter(
        Conversation.moderator_name.isnot(None),
        Conversation.moderator_name != "",
        Conversation.has_human_reply == True,
        Conversation.message_timestamp >= start_date,
        Conversation.message_timestamp <= end_date,
    ).group_by(Conversation.moderator_name).all()

    performers = []
    for row in query:
        total = row.total_conversations or 0
        delayed = row.delayed_count or 0
        sla_score = round(((total - delayed) / total) * 100, 2) if total > 0 else 100.0
        performers.append(ModeratorPerformance(
            moderator_name=row.moderator_name,
            total_replies=total,
            average_response_time_seconds=round(row.avg_response or 0, 2),
            delayed_replies=delayed,
            sla_score=sla_score,
            total_conversations=total,
        ))

    performers.sort(key=lambda p: p.sla_score, reverse=True)
    return performers


def format_duration(seconds: int) -> str:
    minutes, secs = divmod(seconds, 60)
    hours, minutes = divmod(minutes, 60)
    if hours > 0:
        return f"{hours}h {minutes}m {secs}s"
    elif minutes > 0:
        return f"{minutes}m {secs}s"
    return f"{secs}s"
