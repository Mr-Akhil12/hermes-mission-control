#!/usr/bin/env python3
"""
Hermes OS — Activity Logger
Runs as a background service on the VPS, polls Hermes sessions/cron data,
and logs activities to Supabase in real-time.

Usage: python3 activity_logger.py
"""

import os
import sys
import time
import json
import subprocess
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

# ─── CONFIG ───
SUPABASE_URL = "https://bwlrhvmgychtgfwwgmhn.supabase.co"
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
HERMES_API = "http://127.0.0.1:9119"
POLL_INTERVAL = 30  # seconds
HOME = Path.home()

# ─── SUPABASE CLIENT ───
def supabase_insert(table: str, data: dict) -> bool:
    """Insert a row into Supabase using the REST API."""
    if not SUPABASE_SERVICE_KEY:
        print("[WARN] No SUPABASE_SERVICE_ROLE_KEY set")
        return False
    try:
        url = f"{SUPABASE_URL}/rest/v1/{table}"
        payload = json.dumps(data).encode()
        req = urllib.request.Request(url, data=payload, headers={
            "Content-Type": "application/json",
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Prefer": "return=minimal",
        }, method="POST")
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status in (200, 201)
    except Exception as e:
        print(f"[ERROR] Supabase insert failed: {e}")
        return False

def supabase_upsert(table: str, data: dict, conflict: str = "id") -> bool:
    """Upsert a row into Supabase."""
    if not SUPABASE_SERVICE_KEY:
        return False
    try:
        url = f"{SUPABASE_URL}/rest/v1/{table}"
        payload = json.dumps(data).encode()
        req = urllib.request.Request(url, data=payload, headers={
            "Content-Type": "application/json",
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        }, method="POST")
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status in (200, 201)
    except Exception as e:
        print(f"[ERROR] Supabase upsert failed: {e}")
        return False

# ─── HERMES DATA SOURCES ───
def hermes_fetch(path: str):
    """Fetch data from Hermes API."""
    try:
        with urllib.request.urlopen(f"{HERMES_API}{path}", timeout=5) as r:
            return json.loads(r.read())
    except Exception:
        return None

def sqlite_query(db_path: str, sql: str) -> list:
    """Run a SQLite query and return results."""
    try:
        r = subprocess.run(["sqlite3", db_path, sql], capture_output=True, text=True, timeout=5)
        if r.returncode != 0:
            return []
        results = []
        for line in r.stdout.strip().split("\n"):
            if line:
                results.append(line.split("|"))
        return results
    except Exception:
        return []

# ─── LOGGING FUNCTIONS ───
def log_activity(agent_name: str, action: str, details: str | None = None, status: str = "completed", metadata: dict | None = None):
    """Log an agent activity to Supabase."""
    supabase_insert("agent_activities", {
        "agent_name": agent_name,
        "action": action,
        "details": details,
        "status": status,
        "metadata": metadata if metadata is not None else {},
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

def sync_sessions():
    """Sync Hermes sessions to Supabase."""
    state_db = str(HOME / ".hermes" / "state.db")
    rows = sqlite_query(state_db, """
        SELECT id, title, source, model, message_count, 
               COALESCE(last_active, started_at) as last_active,
               started_at
        FROM sessions 
        ORDER BY last_active DESC 
        LIMIT 100
    """)
    for row in rows:
        if len(row) >= 6:
            supabase_upsert("sessions", {
                "id": row[0],
                "title": row[1] or None,
                "source": row[2] or "local",
                "model": row[3] or None,
                "message_count": int(row[4]) if row[4] else 0,
                "last_active": row[5] or datetime.now(timezone.utc).isoformat(),
                "created_at": row[6] if len(row) > 6 else datetime.now(timezone.utc).isoformat(),
            })

def sync_cron_jobs():
    """Sync Hermes cron jobs to Supabase."""
    jobs_file = HOME / ".hermes" / "cron" / "jobs.json"
    if not jobs_file.exists():
        return
    try:
        data = json.loads(jobs_file.read_text())
        for job in data.get("jobs", []):
            supabase_upsert("cron_jobs", {
                "id": job.get("id", ""),
                "name": job.get("name"),
                "schedule": job.get("schedule", {}).get("expr") if isinstance(job.get("schedule"), dict) else str(job.get("schedule", "")),
                "schedule_display": job.get("schedule_display"),
                "enabled": job.get("enabled", True),
                "state": job.get("state", "scheduled"),
                "last_run_at": job.get("last_run_at"),
                "next_run_at": job.get("next_run_at"),
                "last_status": job.get("last_status", "ok"),
                "last_error": job.get("last_error"),
                "deliver": job.get("deliver", "local"),
                "profile": job.get("profile", "default"),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })
    except Exception as e:
        print(f"[ERROR] Failed to sync cron jobs: {e}")

def detect_new_activities():
    """Detect new activities by comparing session states."""
    state_db = str(HOME / ".hermes" / "state.db")
    
    # Check for recently active sessions (last 5 minutes)
    rows = sqlite_query(state_db, """
        SELECT s.id, s.title, s.source, s.model, s.message_count,
               COALESCE(s.last_active, s.started_at) as last_active
        FROM sessions s
        WHERE s.last_active > datetime('now', '-5 minutes')
           OR s.started_at > datetime('now', '-5 minutes')
        ORDER BY s.last_active DESC
        LIMIT 20
    """)
    
    for row in rows:
        if len(row) >= 6:
            source = row[2] or "local"
            model = row[3] or "unknown"
            msg_count = int(row[4]) if row[4] else 0
            log_activity(
                agent_name=source,
                action="session_active",
                details=f"Session '{row[1] or row[0]}' — {msg_count} messages via {model}",
                status="running" if row[5] and (datetime.now(timezone.utc) - datetime.fromisoformat(row[5].replace('Z', '+00:00'))).seconds < 300 else "completed",
                metadata={"session_id": row[0], "model": model, "messages": msg_count}
            )

# ─── MAIN LOOP ───
def main():
    print(f"🚀 Hermes Activity Logger starting...")
    print(f"   Supabase: {SUPABASE_URL}")
    print(f"   Hermes API: {HERMES_API}")
    print(f"   Poll interval: {POLL_INTERVAL}s")
    
    # Initial sync
    print("📊 Initial sync...")
    sync_sessions()
    sync_cron_jobs()
    log_activity("system", "logger_started", "Activity logger initialized", "completed")
    
    cycle = 0
    while True:
        try:
            cycle += 1
            
            # Every cycle: detect new activities
            detect_new_activities()
            
            # Every 5 cycles: full sync
            if cycle % 5 == 0:
                sync_sessions()
                sync_cron_jobs()
            
            time.sleep(POLL_INTERVAL)
        except KeyboardInterrupt:
            log_activity("system", "logger_stopped", "Activity logger shut down", "completed")
            print("\n👋 Logger stopped")
            break
        except Exception as e:
            print(f"[ERROR] Main loop: {e}")
            time.sleep(POLL_INTERVAL)

if __name__ == "__main__":
    main()
