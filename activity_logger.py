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
import urllib.parse
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


def supabase_upsert(table: str, data: dict, on_conflict: str = "id") -> bool:
    """Upsert a row into Supabase using the REST API."""
    if not SUPABASE_KEY:
        return False
    try:
        url = f"{SUPABASE_URL}/rest/v1/{table}"
        payload = json.dumps(data).encode()
        req = urllib.request.Request(url, data=payload, headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        }, method="POST")
        # Add upsert query parameter
        full_url = url + f"?on_conflict={on_conflict}"
        req = urllib.request.Request(full_url, data=payload, headers=req.headers, method=req.method)
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status in (200, 201)
    except urllib.error.HTTPError as e:
        if e.code == 409:
            # Conflict - try UPDATE instead
            return supabase_update(table, data, on_conflict)
        print(f"[ERROR] Supabase upsert HTTP {e.code}: {e.read().decode()[:200]}")
        return False
    except Exception as e:
        print(f"[ERROR] Supabase upsert: {e}")
        return False


def supabase_update(table: str, data: dict, on_conflict: str = "id") -> bool:
    """Update a row in Supabase (fallback for conflicts)."""
    if not SUPABASE_KEY:
        return False
    try:
        # Find the conflict column value
        conflict_val = data.get(on_conflict)
        if not conflict_val:
            return False
            
        url = f"{SUPABASE_URL}/rest/v1/{table}?{on_conflict}=eq.{urllib.parse.quote(str(conflict_val))}"
        payload = json.dumps(data).encode()
        req = urllib.request.Request(url, data=payload, headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        }, method="PATCH")
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status in (200, 204)
    except Exception as e:
        print(f"[ERROR] Supabase update: {e}")
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
               started_at,
               COALESCE(ended_at, started_at) as last_active
        FROM sessions 
        ORDER BY started_at DESC 
        LIMIT 100
    """)
    
    current_count = len(rows)
    if current_count != last_session_count:
        print(f"[SYNC] Sessions: {last_session_count} -> {current_count}")
        
        for row in rows:
            if len(row) >= 6:
                supabase_upsert("sessions", {
                    "id": row[0],
                    "title": row[1] or None,
                    "source": row[2] or "local",
                    "model": row[3] or None,
                    "message_count": int(row[4]) if row[4] else 0,
                    "last_active": datetime.fromtimestamp(float(row[5]), tz=timezone.utc).isoformat() if row[5] else datetime.now(timezone.utc).isoformat(),
                    "created_at": datetime.fromtimestamp(float(row[5]), tz=timezone.utc).isoformat() if row[5] else datetime.now(timezone.utc).isoformat(),
                })
        
        last_session_count = current_count
    
    # Log new active sessions as activities (sessions started in last 5 minutes)
    recent = sqlite_query(STATE_DB, f"""
        SELECT id, title, source, model, message_count, started_at
        FROM sessions 
        WHERE started_at > {time.time() - 300}
        ORDER BY started_at DESC
        LIMIT 10
    """)
    
    for row in recent:
        if len(row) >= 6:
            session_id = row[0]
            started_at = row[5]
            if session_id not in last_run_times:
                supabase_upsert("agent_activities", {
                    "agent_name": row[2] or "local",
                    "action": "session_active",
                    "details": f"Session '{row[1] or session_id}' — {row[4]} messages via {row[3]}",
                    "status": "running",
                    "metadata": {"session_id": session_id, "model": row[3], "messages": int(row[4]) if row[4] else 0},
                })
                last_run_times[session_id] = started_at


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
                
                supabase_upsert("cron_jobs", {
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
                    supabase_upsert("agent_activities", {
                        "agent_name": "cron",
                        "action": "job_executed",
                        "details": f"Cron job '{job.get('name', job_id)}' ran — status: {job.get('last_status', 'ok')}",
                        "status": "completed" if job.get("last_status") == "ok" else "error",
                        "metadata": {"job_id": job_id, "job_name": job.get("name")},
                    })
                    last_run_times[job_id] = last_run
                elif last_run and last_run_times.get(job_id) != last_run:
                    supabase_upsert("agent_activities", {
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
    supabase_upsert("agent_activities", {
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
                supabase_upsert("agent_activities", {
                    "agent_name": "system",
                    "action": "logger_heartbeat",
                    "details": f"Logger running — cycle {cycle}",
                    "status": "completed",
                    "metadata": {"cycle": cycle, "sessions": last_session_count, "cron_jobs": last_cron_count},
                })
                print(f"[HEARTBEAT] Cycle {cycle} — sessions: {last_session_count}, cron: {last_cron_count}")
            
            time.sleep(POLL_INTERVAL)
        except KeyboardInterrupt:
            supabase_upsert("agent_activities", {
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
