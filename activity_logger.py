#!/usr/bin/env python3
"""
Hermes OS — Activity Logger
Runs as a background service on the VPS, polls Hermes sessions/cron data,
and logs activities to Supabase in real-time.
"""

import os
import sys
import time
import json
import subprocess
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path

# ─── CONFIG ───
SUPABASE_URL = "https://bwlrhvmgychtgfwwgmhn.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
HERMES_API = "http://127.0.0.1:9119"
POLL_INTERVAL = 30  # seconds
HOME = Path.home()
STATE_DB = str(HOME / ".hermes" / "state.db")
CRON_JOBS_FILE = HOME / ".hermes" / "cron" / "jobs.json"

# Track last sync state
last_session_count = 0
last_cron_count = 0
last_run_times = {}


def supabase_insert(table: str, data: dict) -> bool:
    if not SUPABASE_KEY:
        return False
    try:
        url = f"{SUPABASE_URL}/rest/v1/{table}"
        payload = json.dumps(data).encode()
        req = urllib.request.Request(url, data=payload, headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        }, method="POST")
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status in (200, 201)
    except Exception as e:
        print(f"[ERROR] Supabase insert: {e}")
        return False


def sqlite_query(db_path: str, sql: str) -> list:
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


def sync_sessions():
    """Sync Hermes sessions to Supabase."""
    global last_session_count
    
    rows = sqlite_query(STATE_DB, """
        SELECT id, title, source, model, message_count, 
               COALESCE(last_active, started_at) as last_active,
               started_at
        FROM sessions 
        ORDER BY last_active DESC 
        LIMIT 100
    """)
    
    current_count = len(rows)
    if current_count != last_session_count:
        print(f"[SYNC] Sessions: {last_session_count} -> {current_count}")
        
        for row in rows:
            if len(row) >= 6:
                supabase_insert("sessions", {
                    "id": row[0],
                    "title": row[1] or None,
                    "source": row[2] or "local",
                    "model": row[3] or None,
                    "message_count": int(row[4]) if row[4] else 0,
                    "last_active": row[5] or datetime.now(timezone.utc).isoformat(),
                    "created_at": row[6] if len(row) > 6 else datetime.now(timezone.utc).isoformat(),
                })
        
        last_session_count = current_count
    
    # Log new active sessions as activities
    recent = sqlite_query(STATE_DB, """
        SELECT id, title, source, model, message_count,
               COALESCE(last_active, started_at) as last_active
        FROM sessions 
        WHERE last_active > datetime('now', '-5 minutes')
        ORDER BY last_active DESC
        LIMIT 10
    """)
    
    for row in recent:
        if len(row) >= 6:
            session_id = row[0]
            if session_id not in last_run_times:
                supabase_insert("agent_activities", {
                    "agent_name": row[2] or "local",
                    "action": "session_active",
                    "details": f"Session '{row[1] or session_id}' — {row[4]} messages via {row[3]}",
                    "status": "running",
                    "metadata": {"session_id": session_id, "model": row[3], "messages": int(row[4]) if row[4] else 0},
                })
                last_run_times[session_id] = row[5]


def sync_cron_jobs():
    """Sync Hermes cron jobs to Supabase."""
    global last_cron_count
    
    if not CRON_JOBS_FILE.exists():
        return
    
    try:
        data = json.loads(CRON_JOBS_FILE.read_text())
        jobs = data.get("jobs", [])
        
        current_count = len(jobs)
        if current_count != last_cron_count:
            print(f"[SYNC] Cron jobs: {last_cron_count} -> {current_count}")
            
            for job in jobs:
                job_id = job.get("id", "")
                last_run = job.get("last_run_at")
                
                supabase_insert("cron_jobs", {
                    "id": job_id,
                    "name": job.get("name"),
                    "schedule": str(job.get("schedule", "")),
                    "schedule_display": job.get("schedule_display"),
                    "enabled": job.get("enabled", True),
                    "state": job.get("state", "scheduled"),
                    "last_run_at": last_run,
                    "next_run_at": job.get("next_run_at"),
                    "last_status": job.get("last_status", "ok"),
                    "last_error": job.get("last_error"),
                    "deliver": job.get("deliver", "local"),
                    "profile": job.get("profile", "default"),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                })
                
                # Log cron runs as activities
                if last_run and job_id not in last_run_times:
                    supabase_insert("agent_activities", {
                        "agent_name": "cron",
                        "action": "job_executed",
                        "details": f"Cron job '{job.get('name', job_id)}' ran — status: {job.get('last_status', 'ok')}",
                        "status": "completed" if job.get("last_status") == "ok" else "error",
                        "metadata": {"job_id": job_id, "job_name": job.get("name")},
                    })
                    last_run_times[job_id] = last_run
                elif last_run and last_run_times.get(job_id) != last_run:
                    supabase_insert("agent_activities", {
                        "agent_name": "cron",
                        "action": "job_executed",
                        "details": f"Cron job '{job.get('name', job_id)}' ran — status: {job.get('last_status', 'ok')}",
                        "status": "completed" if job.get("last_status") == "ok" else "error",
                        "metadata": {"job_id": job_id, "job_name": job.get("name")},
                    })
                    last_run_times[job_id] = last_run
            
            last_cron_count = current_count
    except Exception as e:
        print(f"[ERROR] Cron sync: {e}")


def main():
    print(f"🚀 Hermes Activity Logger starting...")
    print(f"   Supabase: {SUPABASE_URL}")
    print(f"   Hermes API: {HERMES_API}")
    print(f"   Poll interval: {POLL_INTERVAL}s")
    
    # Initial sync
    print("📊 Initial sync...")
    sync_sessions()
    sync_cron_jobs()
    supabase_insert("agent_activities", {
        "agent_name": "system",
        "action": "logger_started",
        "details": "Activity logger initialized and syncing",
        "status": "completed",
    })
    
    cycle = 0
    while True:
        try:
            cycle += 1
            sync_sessions()
            sync_cron_jobs()
            
            # Heartbeat every 10 cycles
            if cycle % 10 == 0:
                supabase_insert("agent_activities", {
                    "agent_name": "system",
                    "action": "logger_heartbeat",
                    "details": f"Logger running — cycle {cycle}",
                    "status": "completed",
                    "metadata": {"cycle": cycle, "sessions": last_session_count, "cron_jobs": last_cron_count},
                })
                print(f"[HEARTBEAT] Cycle {cycle} — sessions: {last_session_count}, cron: {last_cron_count}")
            
            time.sleep(POLL_INTERVAL)
        except KeyboardInterrupt:
            supabase_insert("agent_activities", {
                "agent_name": "system",
                "action": "logger_stopped",
                "details": "Activity logger shut down",
                "status": "completed",
            })
            print("\n👋 Logger stopped")
            break
        except Exception as e:
            print(f"[ERROR] Main loop: {e}")
            time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
