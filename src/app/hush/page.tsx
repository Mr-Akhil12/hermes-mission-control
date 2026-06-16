'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Shield, ShieldCheck, ShieldAlert, ShieldX,
  Network, Radar, Scan, Bug, Lock,
  AlertTriangle, AlertOctagon, Eye, Server,
  RefreshCw, Loader2, CheckCircle2, XCircle,
  Clock, Globe, Wifi, Database, FileWarning,
  Terminal, Cpu, Activity, Zap, ArrowUpRight,
  Search, Bell, Filter
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useSupabaseQuery } from '@/lib/useSupabaseQuery'

/* ────────────────────────────────────────────────────────────
 * Types
 * ──────────────────────────────────────────────────────────── */

interface HushAlert {
  id: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  title: string
  description: string | null
  source: string | null
  status: 'open' | 'investigating' | 'resolved' | 'dismissed'
  created_at: string
}

interface ScanResult {
  id: string
  name: string
  target: string
  status: 'running' | 'completed' | 'failed' | 'queued'
  vulnerabilities: { critical: number; high: number; medium: number; low: number }
  started_at: string
  completed_at: string | null
}

interface NetworkNode {
  id: string
  ip: string
  hostname: string
  status: 'online' | 'offline' | 'warning' | 'compromised'
  type: 'server' | 'workstation' | 'firewall' | 'router'
  lastSeen: string
  openPorts: number
  riskScore: number
}

interface ThreatFeed {
  id: string
  title: string
  source: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  timestamp: string
  ioc: string | null
  tags: string[]
}

interface HushApiResponse {
  alerts: HushAlert[]
  scans: ScanResult[]
  network: NetworkNode[]
  threats: ThreatFeed[]
  stats: {
    totalAlerts: number
    criticalAlerts: number
    openAlerts: number
    scansRunning: number
    threatsToday: number
    networkNodes: number
    nodesOnline: number
  }
  tableExists: boolean
}

/* ────────────────────────────────────────────────────────────
 * Mock Data
 * ──────────────────────────────────────────────────────────── */

const MOCK_ALERTS: HushAlert[] = [
  { id: '1', severity: 'critical', title: 'Ransomware signature detected', description: 'LockBit 3.0 variant identified in outbound traffic from 192.168.1.45. Immediate containment recommended.', source: 'EDR / CrowdStrike', status: 'open', created_at: new Date(Date.now() - 300000).toISOString() },
  { id: '2', severity: 'high', title: 'Brute force attack on SSH', description: '4,287 failed login attempts from 203.0.113.42 targeting root@prod-db-01 in the last 15 minutes.', source: 'Fail2ban / Suricata', status: 'investigating', created_at: new Date(Date.now() - 900000).toISOString() },
  { id: '3', severity: 'high', title: 'Privilege escalation attempt', description: 'Suspicious sudo binary modification detected on web-server-03. Binary hash does not match baseline.', source: 'OSSEC / Wazuh', status: 'open', created_at: new Date(Date.now() - 1800000).toISOString() },
  { id: '4', severity: 'medium', title: 'SSL certificate expiring soon', description: 'Wildcard cert *.hush.security expires in 14 days. Auto-renewal may have failed — check certbot logs.', source: 'Cert Monitor', status: 'open', created_at: new Date(Date.now() - 3600000).toISOString() },
  { id: '5', severity: 'medium', title: 'Unusual DNS query pattern', description: 'High volume of NXDOMAIN queries from 10.0.2.18. Possible DNS tunneling or C2 communication.', source: 'Pi-hole / Zeek', status: 'investigating', created_at: new Date(Date.now() - 5400000).toISOString() },
  { id: '6', severity: 'low', title: 'New device on network', description: 'Unknown MAC address detected on VLAN 10. Device hostname: DESKTOP-A3F7K2. No Nmap scan triggered.', source: 'ARP Monitor', status: 'open', created_at: new Date(Date.now() - 7200000).toISOString() },
  { id: '7', severity: 'info', title: 'Firewall rule updated', description: 'Rule #4821 added: BLOCK inbound TCP 4444 from 185.220.101.0/24. Applied to all perimeter interfaces.', source: 'pfSense / OPNsense', status: 'resolved', created_at: new Date(Date.now() - 10800000).toISOString() },
]

const MOCK_SCANS: ScanResult[] = [
  { id: '1', name: 'Full Network Vulnerability Scan', target: '10.0.0.0/16', status: 'running', vulnerabilities: { critical: 0, high: 0, medium: 0, low: 0 }, started_at: new Date(Date.now() - 600000).toISOString(), completed_at: null },
  { id: '2', name: 'Web App Pentest — api.hush.security', target: 'api.hush.security', status: 'completed', vulnerabilities: { critical: 2, high: 7, medium: 14, low: 23 }, started_at: new Date(Date.now() - 86400000).toISOString(), completed_at: new Date(Date.now() - 72000000).toISOString() },
  { id: '3', name: 'Internal AD Audit', target: 'dc-01.hush.internal', status: 'completed', vulnerabilities: { critical: 0, high: 3, medium: 8, low: 12 }, started_at: new Date(Date.now() - 172800000).toISOString(), completed_at: new Date(Date.now() - 150000000).toISOString() },
  { id: '4', name: 'Container Image Scan', target: 'registry.hush.security/*', status: 'failed', vulnerabilities: { critical: 0, high: 0, medium: 0, low: 0 }, started_at: new Date(Date.now() - 43200000).toISOString(), completed_at: null },
  { id: '5', name: 'Cloud IAM Review', target: 'AWS Account 8472-XXXX-XXXX', status: 'queued', vulnerabilities: { critical: 0, high: 0, medium: 0, low: 0 }, started_at: new Date().toISOString(), completed_at: null },
]

const MOCK_NETWORK: NetworkNode[] = [
  { id: '1', ip: '10.0.1.1', hostname: 'fw-edge-01', status: 'online', type: 'firewall', lastSeen: new Date().toISOString(), openPorts: 4, riskScore: 12 },
  { id: '2', ip: '10.0.1.10', hostname: 'srv-web-01', status: 'online', type: 'server', lastSeen: new Date().toISOString(), openPorts: 6, riskScore: 34 },
  { id: '3', ip: '10.0.1.11', hostname: 'srv-web-02', status: 'warning', type: 'server', lastSeen: new Date(Date.now() - 120000).toISOString(), openPorts: 8, riskScore: 67 },
  { id: '4', ip: '10.0.1.20', hostname: 'srv-db-01', status: 'online', type: 'server', lastSeen: new Date().toISOString(), openPorts: 2, riskScore: 18 },
  { id: '5', ip: '10.0.1.21', hostname: 'srv-db-02', status: 'compromised', type: 'server', lastSeen: new Date(Date.now() - 300000).toISOString(), openPorts: 12, riskScore: 95 },
  { id: '6', ip: '10.0.1.2', hostname: 'rtr-core-01', status: 'online', type: 'router', lastSeen: new Date().toISOString(), openPorts: 3, riskScore: 8 },
  { id: '7', ip: '10.0.2.50', hostname: 'ws-admin-01', status: 'offline', type: 'workstation', lastSeen: new Date(Date.now() - 7200000).toISOString(), openPorts: 0, riskScore: 5 },
  { id: '8', ip: '10.0.2.51', hostname: 'ws-dev-03', status: 'online', type: 'workstation', lastSeen: new Date().toISOString(), openPorts: 1, riskScore: 22 },
]

const MOCK_THREATS: ThreatFeed[] = [
  { id: '1', title: 'CVE-2026-3821: Critical RCE in OpenSSL 3.4.1', source: 'NVD', severity: 'critical', timestamp: new Date(Date.now() - 1800000).toISOString(), ioc: 'openssl-3.4.1-*', tags: ['CVE', 'RCE', 'OpenSSL'] },
  { id: '2', title: 'Volt Typhoon APT targeting infrastructure', source: 'CISA', severity: 'critical', timestamp: new Date(Date.now() - 3600000).toISOString(), ioc: '185.220.101.0/24', tags: ['APT', 'China', 'Critical Infrastructure'] },
  { id: '3', title: 'New Mirai botnet variant spreading via CVE-2026-2018', source: 'CrowdStrike', severity: 'high', timestamp: new Date(Date.now() - 7200000).toISOString(), ioc: null, tags: ['Botnet', 'IoT', 'Mirai'] },
  { id: '4', title: 'Phishing campaign impersonating Microsoft 365', source: 'PhishTank', severity: 'medium', timestamp: new Date(Date.now() - 10800000).toISOString(), ioc: 'login-microsoft365[.]xyz', tags: ['Phishing', 'Microsoft', 'Credential Theft'] },
  { id: '5', title: 'Ransomware gang "BlackStorm" leak site active', source: 'Flashpoint', severity: 'high', timestamp: new Date(Date.now() - 14400000).toISOString(), ioc: null, tags: ['Ransomware', 'Dark Web', 'Extortion'] },
  { id: '6', title: 'MITRE ATT&CK framework updated — 12 new techniques', source: 'MITRE', severity: 'low', timestamp: new Date(Date.now() - 21600000).toISOString(), ioc: null, tags: ['Framework', 'MITRE', 'Update'] },
]

const MOCK_STATS = {
  totalAlerts: 847,
  criticalAlerts: 3,
  openAlerts: 23,
  scansRunning: 1,
  threatsToday: 12,
  networkNodes: 8,
  nodesOnline: 6,
}

/* ────────────────────────────────────────────────────────────
 * Live Threat Counter Component
 * ──────────────────────────────────────────────────────────── */

function ThreatCounter() {
  const [count, setCount] = useState(MOCK_STATS.threatsToday)

  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        setCount((c) => c + 1)
      }
    }, 8000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="animate-slide-up relative overflow-hidden rounded-2xl glass-panel border border-[var(--border)] p-6 card-hover group">
      <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-gradient-to-br from-[var(--danger)]/20 to-transparent opacity-30 blur-2xl group-hover:opacity-50 transition-opacity" />
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--danger)]/20 to-transparent flex items-center justify-center">
              <Radar className="w-5 h-5 text-[var(--danger)]" />
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-widest text-[var(--text-muted)] font-medium">Threats Detected</span>
              <span className="ml-2"><Badge variant="danger" size="sm">LIVE</Badge></span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-[var(--danger)] pulse-dot text-[var(--danger)]" />
            <span className="text-[10px] text-[var(--text-muted)]">Monitoring</span>
          </div>
        </div>

        <div className="flex items-end gap-4 mt-4">
          <p className="text-5xl font-bold gradient-text font-mono">{count}</p>
          <div className="flex items-center gap-1.5 pb-1">
            <ArrowUpRight className="w-4 h-4 text-[var(--danger)]" />
            <span className="text-sm font-semibold text-[var(--danger)]">+{Math.floor(Math.random() * 3) + 1} / hr</span>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2">
          <Eye className="w-3 h-3 text-[var(--text-muted)]" />
          <span className="text-xs text-[var(--text-muted)]">Across all monitored endpoints</span>
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────
 * Network Topology Component
 * ──────────────────────────────────────────────────────────── */

function NetworkTopology({ nodes }: { nodes: NetworkNode[] }) {
  const statusColors: Record<string, string> = {
    online: 'bg-[var(--success)]',
    warning: 'bg-[var(--warning)]',
    compromised: 'bg-[var(--danger)]',
    offline: 'bg-[var(--text-muted)]',
  }

  const statusBadge: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
    online: 'success',
    warning: 'warning',
    compromised: 'danger',
    offline: 'neutral',
  }

  const typeIcons: Record<string, React.ElementType> = {
    server: Server,
    workstation: Terminal,
    firewall: Shield,
    router: Wifi,
  }

  return (
    <div className="animate-slide-up rounded-2xl glass-panel border border-[var(--border)] overflow-hidden card-hover" style={{ animationDelay: '180ms' }}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-[var(--cyan)]" />
          <h3 className="text-sm font-semibold">Network Topology</h3>
        </div>
        <Badge variant="accent" size="sm">{nodes.length} nodes</Badge>
      </div>

      <div className="p-5 space-y-2">
        {nodes.map((node) => {
          const Icon = typeIcons[node.type] || Server
          return (
            <div
              key={node.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--bg-card-hover)] transition-colors"
            >
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColors[node.status]} ${node.status === 'compromised' ? 'pulse-dot text-[var(--danger)]' : ''}`} />
              <Icon className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[var(--text-primary)] truncate">{node.hostname}</span>
                  <Badge variant={statusBadge[node.status]} size="sm">{node.status}</Badge>
                </div>
                <span className="text-[10px] text-[var(--text-muted)] font-mono">{node.ip}</span>
              </div>
              <div className="text-right flex-shrink-0">
                <span className={`text-[10px] font-mono font-medium ${node.riskScore > 80 ? 'text-[var(--danger)]' : node.riskScore > 50 ? 'text-[var(--warning)]' : 'text-[var(--text-muted)]'}`}>
                  Risk: {node.riskScore}
                </span>
                <span className="text-[9px] text-[var(--text-muted)] block">{node.openPorts} ports</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────
 * Security Alerts Feed
 * ──────────────────────────────────────────────────────────── */

function AlertsFeed({ alerts }: { alerts: HushAlert[] }) {
  const severityBadge: Record<string, 'danger' | 'warning' | 'accent' | 'neutral' | 'purple'> = {
    critical: 'danger',
    high: 'warning',
    medium: 'accent',
    low: 'neutral',
    info: 'purple',
  }

  const statusBadge: Record<string, 'danger' | 'warning' | 'success' | 'neutral'> = {
    open: 'danger',
    investigating: 'warning',
    resolved: 'success',
    dismissed: 'neutral',
  }

  const severityIcons: Record<string, React.ElementType> = {
    critical: ShieldX,
    high: AlertOctagon,
    medium: AlertTriangle,
    low: FileWarning,
    info: ShieldCheck,
  }

  return (
    <div className="animate-slide-up rounded-2xl glass-panel border border-[var(--border)] overflow-hidden card-hover" style={{ animationDelay: '240ms' }}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-[var(--danger)]" />
          <h3 className="text-sm font-semibold">Security Alerts</h3>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="danger" size="sm">{alerts.filter(a => a.status === 'open').length} open</Badge>
          <Badge variant="neutral" size="sm">{alerts.length} total</Badge>
        </div>
      </div>

      <div className="divide-y divide-[var(--border)]">
        {alerts.map((alert) => {
          const Icon = severityIcons[alert.severity] || AlertTriangle
          const timeAgo = getTimeAgo(alert.created_at)
          return (
            <div key={alert.id} className="px-5 py-3.5 hover:bg-[var(--bg-card-hover)] transition-colors">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0">
                  <Icon className={`w-4 h-4 ${
                    alert.severity === 'critical' ? 'text-[var(--danger)]' :
                    alert.severity === 'high' ? 'text-[var(--warning)]' :
                    alert.severity === 'medium' ? 'text-[var(--accent)]' :
                    alert.severity === 'low' ? 'text-[var(--text-muted)]' :
                    'text-[var(--purple)]'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-[var(--text-primary)]">{alert.title}</span>
                  </div>
                  {alert.description && (
                    <p className="text-[11px] text-[var(--text-secondary)] line-clamp-2 mb-1.5">{alert.description}</p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={severityBadge[alert.severity]} size="sm">{alert.severity.toUpperCase()}</Badge>
                    <Badge variant={statusBadge[alert.status]} size="sm">{alert.status}</Badge>
                    {alert.source && <span className="text-[9px] text-[var(--text-muted)]">from {alert.source}</span>}
                    <span className="text-[9px] text-[var(--text-muted)]">{timeAgo}</span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────
 * Threat Intelligence Feed
 * ──────────────────────────────────────────────────────────── */

function ThreatIntelFeed({ threats }: { threats: ThreatFeed[] }) {
  const severityBadge: Record<string, 'danger' | 'warning' | 'accent' | 'neutral'> = {
    critical: 'danger',
    high: 'warning',
    medium: 'accent',
    low: 'neutral',
  }

  const severityColors: Record<string, string> = {
    critical: 'text-[var(--danger)]',
    high: 'text-[var(--warning)]',
    medium: 'text-[var(--accent)]',
    low: 'text-[var(--text-muted)]',
  }

  return (
    <div className="animate-slide-up rounded-2xl glass-panel border border-[var(--border)] overflow-hidden card-hover" style={{ animationDelay: '300ms' }}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-[var(--purple)]" />
          <h3 className="text-sm font-semibold">Threat Intelligence</h3>
        </div>
        <Badge variant="purple" size="sm">{threats.length} feeds</Badge>
      </div>

      <div className="divide-y divide-[var(--border)]">
        {threats.map((threat) => {
          const timeAgo = getTimeAgo(threat.timestamp)
          return (
            <div key={threat.id} className="px-5 py-3.5 hover:bg-[var(--bg-card-hover)] transition-colors">
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                  threat.severity === 'critical' ? 'bg-[var(--danger)] pulse-dot text-[var(--danger)]' :
                  threat.severity === 'high' ? 'bg-[var(--warning)]' :
                  threat.severity === 'medium' ? 'bg-[var(--accent)]' :
                  'bg-[var(--text-muted)]'
                }`} />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-[var(--text-primary)] block mb-1">{threat.title}</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={severityBadge[threat.severity]} size="sm">{threat.severity.toUpperCase()}</Badge>
                    <span className="text-[9px] text-[var(--text-muted)]">{threat.source}</span>
                    <span className="text-[9px] text-[var(--text-muted)]">{timeAgo}</span>
                  </div>
                  {threat.ioc && (
                    <div className="mt-1.5 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[var(--bg-input)]">
                      <Search className="w-3 h-3 text-[var(--text-muted)]" />
                      <span className="text-[10px] text-[var(--accent)] font-mono">{threat.ioc}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {threat.tags.map((tag) => (
                      <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-md bg-[var(--purple)]/10 text-[var(--purple)] border border-[var(--purple)]/20">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────
 * Vulnerability Scanner Status
 * ──────────────────────────────────────────────────────────── */

function ScannerStatus({ scans }: { scans: ScanResult[] }) {
  const statusBadge: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
    completed: 'success',
    running: 'warning',
    failed: 'danger',
    queued: 'neutral',
  }

  const totalVulns = (v: { critical: number; high: number; medium: number; low: number }) =>
    v.critical + v.high + v.medium + v.low

  return (
    <div className="animate-slide-up rounded-2xl glass-panel border border-[var(--border)] overflow-hidden card-hover" style={{ animationDelay: '360ms' }}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <Scan className="w-4 h-4 text-[var(--warning)]" />
          <h3 className="text-sm font-semibold">Vulnerability Scans</h3>
        </div>
        <Badge variant="accent" size="sm">{scans.length} scans</Badge>
      </div>

      <div className="divide-y divide-[var(--border)]">
        {scans.map((scan) => {
          const vulns = totalVulns(scan.vulnerabilities)
          return (
            <div key={scan.id} className="px-5 py-3.5 hover:bg-[var(--bg-card-hover)] transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">{scan.name}</span>
                  {scan.status === 'running' && <Loader2 className="w-3 h-3 text-[var(--warning)] animate-spin" />}
                </div>
                <Badge variant={statusBadge[scan.status]} size="sm">{scan.status}</Badge>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] text-[var(--text-muted)] font-mono">{scan.target}</span>
              </div>
              {scan.status === 'completed' && vulns > 0 && (
                <div className="flex items-center gap-3">
                  {scan.vulnerabilities.critical > 0 && (
                    <span className="text-[10px] font-medium text-[var(--danger)]">
                      {scan.vulnerabilities.critical} critical
                    </span>
                  )}
                  {scan.vulnerabilities.high > 0 && (
                    <span className="text-[10px] font-medium text-[var(--warning)]">
                      {scan.vulnerabilities.high} high
                    </span>
                  )}
                  {scan.vulnerabilities.medium > 0 && (
                    <span className="text-[10px] font-medium text-[var(--accent)]">
                      {scan.vulnerabilities.medium} medium
                    </span>
                  )}
                  {scan.vulnerabilities.low > 0 && (
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {scan.vulnerabilities.low} low
                    </span>
                  )}
                </div>
              )}
              {scan.status === 'running' && (
                <div className="mt-2">
                  <div className="h-1.5 rounded-full bg-[var(--bg-input)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{
                        width: `${Math.min(90, Math.floor(Math.random() * 40 + 50))}%`,
                        background: 'linear-gradient(90deg, var(--warning), var(--accent))',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────
 * Helper: Time Ago
 * ──────────────────────────────────────────────────────────── */

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

/* ────────────────────────────────────────────────────────────
 * Main Page
 * ──────────────────────────────────────────────────────────── */

export default function HushPage() {
  const {
    data: apiData,
    isLoading,
  } = useSupabaseQuery<HushApiResponse>('/api/hush', 30000)

  const alerts = apiData?.alerts ?? MOCK_ALERTS
  const scans = apiData?.scans ?? MOCK_SCANS
  const network = apiData?.network ?? MOCK_NETWORK
  const threats = apiData?.threats ?? MOCK_THREATS
  const stats = apiData?.stats ?? MOCK_STATS

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-slide-up flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold gradient-text">Hush</h1>
            <Badge variant="danger" size="md">
              <ShieldAlert className="w-3 h-3 mr-1" />
              SECURITY OPS
            </Badge>
          </div>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Cybersecurity Operations Hub — Real-time threat monitoring & vulnerability management
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4 stagger">
        <Card
          label="Total Alerts"
          value={stats.totalAlerts}
          subtitle="All time"
          icon={Bell}
          color="blue"
          delay={0}
        />
        <Card
          label="Critical"
          value={stats.criticalAlerts}
          subtitle="Immediate action"
          icon={ShieldX}
          color="red"
          delay={60}
        />
        <Card
          label="Open Alerts"
          value={stats.openAlerts}
          subtitle="Awaiting triage"
          icon={AlertTriangle}
          color="purple"
          delay={120}
        />
        <Card
          label="Scans Running"
          value={stats.scansRunning}
          subtitle="In progress"
          icon={Scan}
          color="purple"
          delay={180}
        />
        <Card
          label="Network Nodes"
          value={`${stats.nodesOnline}/${stats.networkNodes}`}
          subtitle="Online / Total"
          icon={Network}
          color="green"
          delay={240}
        />
        <Card
          label="Threats Today"
          value={stats.threatsToday}
          subtitle="From feeds"
          icon={Radar}
          color="red"
          delay={300}
        />
      </div>

      {/* Top Row: Threat Counter + Network */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
        <ThreatCounter />
        <div className="lg:col-span-2">
          <NetworkTopology nodes={network} />
        </div>
      </div>

      {/* Middle Row: Alerts + Threat Intel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
        <AlertsFeed alerts={alerts} />
        <ThreatIntelFeed threats={threats} />
      </div>

      {/* Scanner Status */}
      <ScannerStatus scans={scans} />
    </div>
  )
}
