import re
import json
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.lead import Lead
from app.models.conversation import Conversation
from app.models.message_event import MessageEvent
from app.models.page import FacebookPage
from app.core.logging import logger

PHONE_REGEX = re.compile(r'(?<!\d)(?:\+?20)?(?:1[0125]\d{8})(?!\d)')

NAME_PATTERNS = [
    (re.compile(r'\u0627\u0633\u0645\u064a\s+(\S+)', re.UNICODE),),
    (re.compile(r'\u0627\u0633\u0645\u0649\s+(\S+)', re.UNICODE),),
    (re.compile(r'\u0623\u0646\u0627\s+(\S+)', re.UNICODE),),
    (re.compile(r'\u0627\u0646\u0627\s+(\S+)', re.UNICODE),),
    (re.compile(r'\u0645\u0639\u0627\u0643\s+(\S+)', re.UNICODE),),
    (re.compile(r'\u0627\u0644\u0627\u0633\u0645\s+(\S+)', re.UNICODE),),
    (re.compile(r'\u0627\u0644\u0627\u0633\u0645\s+(\S+)', re.UNICODE),),
    (re.compile(r'my name is\s+(\S+)', re.IGNORECASE),),
    (re.compile(r"i'm\s+(\S+)", re.IGNORECASE),),
    (re.compile(r"i am\s+(\S+)", re.IGNORECASE),),
    (re.compile(r'this is\s+(\S+)', re.IGNORECASE),),
]


def _extract_name_from_text(text: str) -> str | None:
    if not text:
        return None
    text_lower = text.lower()
    for pattern, in NAME_PATTERNS:
        m = pattern.search(text_lower)
        if m:
            name = m.group(1)
            name = re.sub(r'[^\w\u0600-\u06FF\s]', '', name).strip()
            if len(name) >= 2:
                return name[:50]
    return None


def _normalize_phone(raw: str) -> str | None:
    digits = re.sub(r'\D', '', raw)
    if len(digits) == 11 and digits.startswith('01'):
        return '+20' + digits[1:]
    if len(digits) == 12 and digits.startswith('201'):
        return '+' + digits
    if len(digits) == 13 and digits.startswith('+201'):
        return digits
    if len(digits) == 10 and digits.startswith('1'):
        return '+20' + digits
    return None


def extract_phones(text: str) -> set[str]:
    if not text:
        return set()
    cleaned = text.replace('-', '').replace(' ', '').replace('(', '').replace(')', '')
    matches = PHONE_REGEX.findall(cleaned)
    result = set()
    for m in matches:
        normalized = _normalize_phone(m)
        if normalized and normalized.startswith('+201') and len(normalized) == 13:
            result.add(normalized)
    return result


def _get_name_priority(conv: Conversation, event_texts: list[str]) -> str:
    for text in event_texts:
        name = _extract_name_from_text(text)
        if name:
            return name
    if conv.customer_name and conv.customer_name != 'Unknown Customer':
        return conv.customer_name
    return 'Unknown Customer'


def scan_and_create_leads(db: Session, since: datetime | None = None) -> int:
    query = db.query(Conversation, FacebookPage).join(
        FacebookPage, Conversation.page_id == FacebookPage.page_id
    )
    if since:
        query = query.filter(Conversation.message_timestamp >= since)

    convs = query.all()
    created = 0

    for conv, page in convs:
        texts = []
        if conv.message_content:
            texts.append(conv.message_content)
        if conv.unanswered_texts:
            try:
                texts.extend(json.loads(conv.unanswered_texts))
            except (json.JSONDecodeError, TypeError):
                pass
        texts_text = ' '.join(t for t in texts if t)

        phones = extract_phones(texts_text)
        if not phones:
            continue

        events = db.query(MessageEvent).filter(
            MessageEvent.conversation_id == conv.id
        ).order_by(MessageEvent.received_at.desc()).all()
        event_texts = [e.message_text for e in events if e.message_text]

        customer_name = _get_name_priority(conv, event_texts)

        last_message = conv.message_content or (event_texts[0] if event_texts else None)

        for phone in phones:
            existing = db.query(Lead).filter(Lead.phone_number == phone).first()
            if existing:
                existing.detection_count += 1
                existing.last_seen = datetime.now(timezone.utc)
                existing.last_message = last_message or existing.last_message
                existing.conversation_id = conv.id
                if customer_name != 'Unknown Customer':
                    existing.customer_name = customer_name
                if existing.customer_name == 'Unknown Customer' and customer_name != 'Unknown Customer':
                    existing.customer_name = customer_name
            else:
                lead = Lead(
                    phone_number=phone,
                    customer_name=customer_name,
                    messenger_name=conv.customer_name,
                    facebook_psid=conv.customer_id,
                    conversation_id=conv.id,
                    page_name=page.page_name,
                    first_detected_at=conv.message_timestamp or datetime.now(timezone.utc),
                    last_seen=datetime.now(timezone.utc),
                    last_message=last_message,
                    detection_count=1,
                )
                db.add(lead)
                created += 1

    if created > 0:
        db.commit()
    return created


def run_lead_scan():
    db = SessionLocal()
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(days=30)
        count = scan_and_create_leads(db, since=cutoff)
        if count:
            logger.info(f"Lead scanner: created {count} new leads")
    except Exception:
        logger.exception("Lead scanner error")
    finally:
        db.close()
