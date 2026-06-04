import json
from typing import Optional, Any
from app.core.config import settings

redis_client: Optional[Any] = None


async def get_redis():
    global redis_client
    if redis_client is None:
        if not settings.REDIS_URL:
            return None
        import redis.asyncio as aioredis
        redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return redis_client


async def cache_get(key: str) -> Optional[str]:
    r = await get_redis()
    if r is None:
        return None
    return await r.get(key)


async def cache_set(key: str, value: str, ttl: int = 300):
    r = await get_redis()
    if r is None:
        return
    await r.setex(key, ttl, value)


async def cache_delete(key: str):
    r = await get_redis()
    if r is None:
        return
    await r.delete(key)


async def cache_get_json(key: str) -> Optional[Any]:
    data = await cache_get(key)
    if data:
        return json.loads(data)
    return None


async def cache_set_json(key: str, value: Any, ttl: int = 300):
    await cache_set(key, json.dumps(value, default=str), ttl)
