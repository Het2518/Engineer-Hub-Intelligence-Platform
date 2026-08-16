"""Persistent conversation history — SQLite with async-safe access.

Design decisions:
- WAL journal mode: allows concurrent reads while a write is in progress.
- check_same_thread=False: required for SQLite in a multi-threaded async app.
- All DB calls run via asyncio.to_thread so they never block the event loop.
- Index on session_id prevents full-table scans on get_history.
- Messages older than MAX_MESSAGES per session are pruned automatically.
"""
import asyncio
import sqlite3
import os
from typing import List, Dict

from config import get_settings

settings = get_settings()

# Resolve DB path relative to this file's location (never depends on CWD)
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "uploads", "chat_history.db")
DB_PATH = os.path.normpath(DB_PATH)
MAX_MESSAGES_PER_SESSION = 40  # hard cap; get_history returns latest 20


# ---------------------------------------------------------------------------
# Connection factory
# ---------------------------------------------------------------------------

def _make_connection() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.execute("PRAGMA journal_mode=WAL")   # concurrent reads
    conn.execute("PRAGMA synchronous=NORMAL") # safe + fast
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


# ---------------------------------------------------------------------------
# Schema init (runs at import time — fast, idempotent)
# ---------------------------------------------------------------------------

def _init_db() -> None:
    with _make_connection() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS sessions (
                id         TEXT PRIMARY KEY,
                title      TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS messages (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                role       TEXT NOT NULL,
                content    TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES sessions (id)
            );

            -- Index prevents full table scan on get_history
            CREATE INDEX IF NOT EXISTS idx_messages_session_id
                ON messages (session_id, id);
        """)
        conn.commit()


_init_db()


# ---------------------------------------------------------------------------
# Public API — all async, all run in a thread pool
# ---------------------------------------------------------------------------

def _get_history_sync(session_id: str) -> List[Dict[str, str]]:
    with _make_connection() as conn:
        rows = conn.execute(
            """SELECT role, content FROM messages
               WHERE session_id = ?
               ORDER BY id DESC
               LIMIT 20""",
            (session_id,),
        ).fetchall()
    # Return in chronological order (DESC was used for the LIMIT)
    return [{"role": r[0], "content": r[1]} for r in reversed(rows)]


def _add_message_sync(session_id: str, role: str, content: str) -> None:
    with _make_connection() as conn:
        # Upsert session row
        existing = conn.execute(
            "SELECT id FROM sessions WHERE id = ?", (session_id,)
        ).fetchone()

        if not existing:
            title = (content[:50] + "…") if role == "user" else "New Chat"
            conn.execute(
                "INSERT INTO sessions (id, title) VALUES (?, ?)",
                (session_id, title),
            )
        else:
            conn.execute(
                "UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (session_id,),
            )

        conn.execute(
            "INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)",
            (session_id, role, content),
        )

        # Prune old messages: keep latest MAX_MESSAGES_PER_SESSION per session
        conn.execute(
            """DELETE FROM messages
               WHERE session_id = ? AND id NOT IN (
                   SELECT id FROM messages
                   WHERE session_id = ?
                   ORDER BY id DESC
                   LIMIT ?
               )""",
            (session_id, session_id, MAX_MESSAGES_PER_SESSION),
        )

        conn.commit()


def _get_all_sessions_sync() -> List[Dict[str, str]]:
    with _make_connection() as conn:
        rows = conn.execute(
            "SELECT id, title, updated_at FROM sessions ORDER BY updated_at DESC"
        ).fetchall()
    return [{"id": r[0], "title": r[1], "updated_at": r[2]} for r in rows]


# Async wrappers — never block the event loop
async def get_history(session_id: str) -> List[Dict[str, str]]:
    if not session_id:
        return []
    return await asyncio.to_thread(_get_history_sync, session_id)


async def add_message(session_id: str, role: str, content: str) -> None:
    if not session_id:
        return
    await asyncio.to_thread(_add_message_sync, session_id, role, content)


async def get_all_sessions() -> List[Dict[str, str]]:
    return await asyncio.to_thread(_get_all_sessions_sync)


async def delete_session(session_id: str) -> bool:
    """Delete a session and all its messages. Returns True if session existed."""
    def _delete_sync() -> bool:
        with _make_connection() as conn:
            # Check exists
            row = conn.execute("SELECT id FROM sessions WHERE id = ?", (session_id,)).fetchone()
            if not row:
                return False
            conn.execute("DELETE FROM messages WHERE session_id = ?", (session_id,))
            conn.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
            conn.commit()
            return True
    return await asyncio.to_thread(_delete_sync)


async def rename_session(session_id: str, new_title: str) -> bool:
    """Rename a session. Returns True if session existed."""
    def _rename_sync() -> bool:
        with _make_connection() as conn:
            row = conn.execute("SELECT id FROM sessions WHERE id = ?", (session_id,)).fetchone()
            if not row:
                return False
            conn.execute(
                "UPDATE sessions SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (new_title[:100], session_id),
            )
            conn.commit()
            return True
    return await asyncio.to_thread(_rename_sync)
