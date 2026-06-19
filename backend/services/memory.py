"""Persistent conversation history storage using SQLite."""
from typing import List, Dict
import sqlite3
import os
from config import get_settings

settings = get_settings()
db_path = os.path.join(settings.upload_dir, "chat_history.db")
os.makedirs(settings.upload_dir, exist_ok=True)

def _get_connection():
    return sqlite3.connect(db_path)

def _init_db():
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                title TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT,
                role TEXT,
                content TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES sessions (id)
            )
        ''')
        conn.commit()

_init_db()

def get_history(session_id: str) -> List[Dict[str, str]]:
    if not session_id:
        return []
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT role, content FROM messages WHERE session_id = ? ORDER BY id ASC LIMIT 20", 
            (session_id,)
        )
        rows = cursor.fetchall()
        return [{"role": r[0], "content": r[1]} for r in rows]

def add_message(session_id: str, role: str, content: str):
    if not session_id:
        return
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM sessions WHERE id = ?", (session_id,))
        if not cursor.fetchone():
            title = content[:30] + "..." if role == "user" else "New Chat"
            cursor.execute("INSERT INTO sessions (id, title) VALUES (?, ?)", (session_id, title))
        else:
            cursor.execute("UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", (session_id,))
            
        cursor.execute(
            "INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)",
            (session_id, role, content)
        )
        conn.commit()

def get_all_sessions() -> List[Dict[str, str]]:
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, title, updated_at FROM sessions ORDER BY updated_at DESC")
        rows = cursor.fetchall()
        return [{"id": r[0], "title": r[1], "updated_at": r[2]} for r in rows]
