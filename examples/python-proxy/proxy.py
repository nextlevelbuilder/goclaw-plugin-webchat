"""
GoClaw WebChat Proxy Server — Python (aiohttp)

Lightweight WebSocket proxy that sits between the chat widget and GoClaw Gateway.
The proxy injects the auth token server-side so it never reaches the browser.

Usage:
  pip install -r requirements.txt
  cp .env.example .env   # fill in GOCLAW_URL and GOCLAW_TOKEN
  python proxy.py

Environment variables:
  GOCLAW_URL       — Gateway WebSocket URL (required, e.g. "ws://localhost:9090/ws")
  GOCLAW_TOKEN     — Gateway auth token (required, kept server-side)
  PORT             — Proxy listen port (default: 3100)
  ALLOWED_ORIGINS  — Comma-separated origin allowlist (empty = allow all)
  PROXY_API_KEY    — Optional API key for proxy authentication
  DEFAULT_AGENT_ID — Default agent ID injected into chat.send if client omits it
"""

import asyncio
import json
import os
import signal
import sys

import aiohttp
from aiohttp import web

# ── Config ──────────────────────────────────────────────────────────────────

GOCLAW_URL = os.environ.get("GOCLAW_URL", "")
GOCLAW_TOKEN = os.environ.get("GOCLAW_TOKEN", "")
PORT = int(os.environ.get("PORT", "3100"))
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get("ALLOWED_ORIGINS", "").split(",")
    if o.strip()
]
PROXY_API_KEY = os.environ.get("PROXY_API_KEY", "")
DEFAULT_AGENT_ID = os.environ.get("DEFAULT_AGENT_ID", "")

if not GOCLAW_URL:
    print("ERROR: GOCLAW_URL environment variable is required")
    sys.exit(1)

if not GOCLAW_TOKEN:
    print("WARNING: GOCLAW_TOKEN not set — proxy will connect without authentication")


# ── Helpers ─────────────────────────────────────────────────────────────────

def check_origin(request: web.Request) -> bool:
    """Validate request origin against allowlist. Empty list = allow all."""
    if not ALLOWED_ORIGINS:
        return True
    origin = request.headers.get("Origin", "")
    if not origin:
        return False  # reject missing origin when allowlist is active
    return "*" in ALLOWED_ORIGINS or origin in ALLOWED_ORIGINS


def check_api_key(request: web.Request) -> bool:
    """Validate API key from query param or header. No key configured = allow all."""
    if not PROXY_API_KEY:
        return True
    key = request.query.get("apiKey") or request.headers.get("X-API-Key", "")
    return key == PROXY_API_KEY


def intercept_frame(raw: str) -> str:
    """Intercept client frames: inject token into connect, default agentId into chat.send."""
    try:
        frame = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return raw

    if frame.get("type") != "req":
        return raw

    modified = False

    # Inject gateway token into connect frame
    if frame.get("method") == "connect" and GOCLAW_TOKEN:
        frame.setdefault("params", {})["token"] = GOCLAW_TOKEN
        modified = True

    # Inject default agentId into chat.send if not set by client
    if (
        frame.get("method") == "chat.send"
        and DEFAULT_AGENT_ID
        and not frame.get("params", {}).get("agentId")
    ):
        frame.setdefault("params", {})["agentId"] = DEFAULT_AGENT_ID
        modified = True

    return json.dumps(frame) if modified else raw


def sanitize_upstream_frame(raw: str) -> str:
    """Strip token fields from upstream responses (defense in depth)."""
    try:
        frame = json.loads(raw)
        if frame.get("type") == "res" and "token" in frame.get("payload", {}):
            del frame["payload"]["token"]
            return json.dumps(frame)
    except (json.JSONDecodeError, TypeError):
        pass
    return raw


# ── WebSocket proxy handler ────────────────────────────────────────────────

active_connections = 0


async def ws_proxy(request: web.Request) -> web.WebSocketResponse:
    """Handle a single WebSocket proxy session: client <-> upstream."""
    global active_connections

    if not check_origin(request):
        return web.Response(status=403, text="Origin not allowed")

    if not check_api_key(request):
        return web.Response(status=401, text="Unauthorized")

    client_ws = web.WebSocketResponse(max_msg_size=512 * 1024)
    await client_ws.prepare(request)

    active_connections += 1
    print(f"[proxy] client connected (active={active_connections})")

    # Connect to upstream GoClaw Gateway
    session = aiohttp.ClientSession()
    try:
        upstream_ws = await session.ws_connect(GOCLAW_URL, max_msg_size=512 * 1024)
    except Exception as exc:
        print(f"[proxy] upstream connection failed: {exc}")
        active_connections -= 1
        await session.close()
        await client_ws.close(code=1011, message=b"upstream connection failed")
        return client_ws

    print("[proxy] upstream connected")

    async def relay_upstream_to_client() -> None:
        """Forward upstream messages to client, stripping token fields."""
        try:
            async for msg in upstream_ws:
                if msg.type == aiohttp.WSMsgType.TEXT:
                    await client_ws.send_str(sanitize_upstream_frame(msg.data))
                elif msg.type in (aiohttp.WSMsgType.CLOSED, aiohttp.WSMsgType.ERROR):
                    break
        except Exception:
            pass
        finally:
            if not client_ws.closed:
                await client_ws.close()

    # Start upstream -> client relay in background
    relay_task = asyncio.create_task(relay_upstream_to_client())

    # Client -> upstream relay (main loop)
    try:
        async for msg in client_ws:
            if msg.type == aiohttp.WSMsgType.TEXT:
                modified = intercept_frame(msg.data)
                await upstream_ws.send_str(modified)
            elif msg.type in (aiohttp.WSMsgType.CLOSED, aiohttp.WSMsgType.ERROR):
                break
    except Exception:
        pass
    finally:
        active_connections -= 1
        print(f"[proxy] client disconnected (active={active_connections})")
        relay_task.cancel()
        if not upstream_ws.closed:
            await upstream_ws.close()
        await session.close()

    return client_ws


# ── Health check ────────────────────────────────────────────────────────────

async def health(_request: web.Request) -> web.Response:
    return web.json_response({"status": "ok", "connections": active_connections})


# ── App setup ───────────────────────────────────────────────────────────────

app = web.Application()
app.router.add_get("/ws", ws_proxy)
app.router.add_get("/health", health)

if __name__ == "__main__":
    # Load .env file if python-dotenv is available
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass

    print(f"[proxy] listening on :{PORT}")
    print(f"[proxy] upstream: {GOCLAW_URL}")
    print(f"[proxy] auth token: {'configured' if GOCLAW_TOKEN else 'NOT SET'}")
    print(f"[proxy] API key: {'required' if PROXY_API_KEY else 'disabled'}")
    if ALLOWED_ORIGINS:
        print(f"[proxy] allowed origins: {', '.join(ALLOWED_ORIGINS)}")
    else:
        print("[proxy] allowed origins: * (all)")

    web.run_app(app, port=PORT, print=None)
