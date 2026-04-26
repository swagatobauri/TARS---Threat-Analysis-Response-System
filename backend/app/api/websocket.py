"""
TARS SSE Bridge — Redis pub/sub → Server-Sent Events stream.

Subscribes to the 'tars:events' Redis channel and streams all system events
to connected frontend clients in real-time.
"""

import asyncio
import json

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.core.event_bus import CHANNEL, get_redis_client

router = APIRouter()


@router.get("/events/stream")
async def sse_event_stream():
    """
    SSE endpoint that bridges Redis pub/sub events to the browser.

    Event types streamed:
      - threat_detected
      - action_executed
      - threshold_updated
      - ip_blocked
      - model_retrained
    """
    async def event_generator():
        client = get_redis_client()
        pubsub = client.pubsub()
        pubsub.subscribe(CHANNEL)

        try:
            while True:
                message = pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                if message and message["type"] == "message":
                    data = message["data"]
                    yield f"data: {data}\n\n"
                else:
                    # Keep-alive heartbeat every 2 seconds
                    yield f"data: {json.dumps({'event_type': 'heartbeat'})}\n\n"
                    await asyncio.sleep(2)
        finally:
            pubsub.unsubscribe(CHANNEL)
            pubsub.close()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
