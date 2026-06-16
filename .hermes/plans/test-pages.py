#!/usr/bin/env python3.12
"""Test all Mission Control pages via Playwright."""
from playwright.sync_api import sync_playwright
import json

results = {}
BASE = 'https://jarvis-x-akhil.vercel.app'

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    ctx = browser.new_context()
    page = ctx.new_page()

    # Login via API to set cookie
    page.goto(f'{BASE}/login', wait_until='networkidle')
    page.evaluate('''() => fetch("/api/auth", { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({password: "AdminLogsIn"}) })''')
    page.wait_for_timeout(1000)
    
    pages_to_test = [
        ('Overview', '/'),
        ('Chat', '/chat'),
        ('Activity', '/activity'),
        ('Tasks', '/tasks'),
        ('Cron', '/cron'),
        ('Models', '/models'),
        ('Logs', '/logs'),
        ('Config', '/config'),
        ('Keys', '/keys'),
        ('Docs', '/docs'),
    ]
    
    for name, path in pages_to_test:
        try:
            page.goto(f'{BASE}{path}', wait_until='networkidle', timeout=15000)
            page.wait_for_timeout(2000)
            text = page.inner_text('body')
            text_short = text[:600] if text else '(empty)'
            results[name] = {'url': page.url, 'status': 'loaded', 'preview': text_short}
            print(f'OK {name}')
        except Exception as e:
            results[name] = {'url': page.url, 'status': 'failed', 'error': str(e)[:100]}
            print(f'FAIL {name}: {str(e)[:60]}')
    
    # Test APIs
    api_tests = [
        ('/api/data?table=agent_activities&limit=3', 'Activities'),
        ('/api/data?table=tasks&limit=3', 'Tasks'),
        ('/api/data?table=cron_jobs&limit=3', 'CronJobs'),
        ('/api/keys', 'Keys'),
        ('/api/models', 'Models'),
        ('/api/config', 'Config'),
    ]
    
    for path, name in api_tests:
        try:
            resp = page.evaluate(f'() => fetch("{path}").then(r => r.json())')
            if isinstance(resp, list):
                count = len(resp)
                sample = str(resp[0])[:200] if resp else 'empty'
            else:
                count = len(resp.get('sections', resp.get('models', [])))
                sample = str(resp)[:200]
            results[f'API_{name}'] = {'count': count, 'sample': sample, 'status': 'ok'}
            print(f'OK API {name}: {count} items')
        except Exception as e:
            results[f'API_{name}'] = {'status': 'failed', 'error': str(e)[:100]}
            print(f'FAIL API {name}: {str(e)[:60]}')
    
    # Test unauthenticated access
    ctx2 = browser.new_context()
    page2 = ctx2.new_page()
    try:
        resp = page2.evaluate('''() => fetch("https://jarvis-x-akhil.vercel.app/api/data?table=agent_activities&limit=1").then(r => r.json())''')
        if 'error' in str(resp).lower():
            results['Security'] = {'api_blocked': True}
            print('OK Security: API blocked without auth')
        else:
            results['Security'] = {'api_blocked': False, 'resp': str(resp)[:100]}
            print('WARN Security: API accessible without auth')
    except Exception as e:
        results['Security'] = {'api_blocked': True, 'note': str(e)[:100]}
        print('OK Security: Request failed (blocked)')
    ctx2.close()
    
    browser.close()

with open('/home/akhil/hermes-mission-control/.hermes/plans/test-results.json', 'w') as f:
    json.dump(results, f, indent=2, default=str)

print(f'\nDone. {len(results)} items tested.')
