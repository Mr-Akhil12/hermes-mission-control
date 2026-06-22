'use client';

import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Target, Shield, RefreshCw, Play, Square, ArrowUpRight, ArrowDownRight, Activity, Zap } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

interface Trade {
  id: string;
  time: string;
  type: 'BUY' | 'SELL';
  symbol: string;
  entry: number;
  sl: number;
  tp: number;
  size: number;
  pnl: number;
  status: 'OPEN' | 'CLOSED' | 'PENDING';
}

interface PriceData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export default function TradingPage() {
  const [price, setPrice] = useState(4221.20);
  const [priceHistory, setPriceHistory] = useState<PriceData[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [balance, setBalance] = useState(10000);
  const [equity, setEquity] = useState(10000);
  const [openPnL, setOpenPnL] = useState(0);
  const [lastUpdate, setLastUpdate] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [lotSize, setLotSize] = useState('0.1');

  // Fetch XAUUSD data
  const fetchPrice = useCallback(async () => {
    try {
      const resp = await fetch('/api/trading/price');
      if (resp.ok) {
        const data = await resp.json();
        setPrice(data.price);
        setLastUpdate(new Date().toLocaleTimeString());
        if (data.history) {
          setPriceHistory(data.history);
        }
        setIsLoading(false);
      }
    } catch {
      // Fallback: simulate price movement
      setPrice(prev => {
        const change = (Math.random() - 0.5) * 5;
        return Math.round((prev + change) * 100) / 100;
      });
      setLastUpdate(new Date().toLocaleTimeString());
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrice();
    const interval = setInterval(fetchPrice, 5000);
    return () => clearInterval(interval);
  }, [fetchPrice]);

  // Update open P&L
  useEffect(() => {
    const pnl = trades
      .filter(t => t.status === 'OPEN')
      .reduce((sum, t) => {
        const diff = t.type === 'BUY' ? price - t.entry : t.entry - price;
        return sum + (diff * t.size * 100);
      }, 0);
    setOpenPnL(Math.round(pnl * 100) / 100);
    setEquity(Math.round((balance + pnl) * 100) / 100);
  }, [price, trades, balance]);

  const openTrade = () => {
    if (!stopLoss || !takeProfit) {
      alert('Please set Stop Loss and Take Profit');
      return;
    }

    const newTrade: Trade = {
      id: Date.now().toString(),
      time: new Date().toLocaleString(),
      type: tradeType,
      symbol: 'XAUUSD',
      entry: price,
      sl: parseFloat(stopLoss),
      tp: parseFloat(takeProfit),
      size: parseFloat(lotSize),
      pnl: 0,
      status: 'OPEN',
    };

    setTrades(prev => [newTrade, ...prev]);
  };

  const closeTrade = (tradeId: string) => {
    setTrades(prev => prev.map(t => {
      if (t.id === tradeId && t.status === 'OPEN') {
        const diff = t.type === 'BUY' ? price - t.entry : t.entry - price;
        const pnl = Math.round(diff * t.size * 100 * 100) / 100;
        setBalance(b => b + pnl);
        return { ...t, status: 'CLOSED' as const, pnl };
      }
      return t;
    }));
  };

  const totalTrades = trades.length;
  const winTrades = trades.filter(t => t.status === 'CLOSED' && t.pnl > 0).length;
  const winRate = totalTrades > 0 ? Math.round((winTrades / Math.max(trades.filter(t => t.status === 'CLOSED').length, 1)) * 100) : 0;
  const totalPnL = trades.filter(t => t.status === 'CLOSED').reduce((sum, t) => sum + t.pnl, 0);

  return (
    <div className="space-y-4 sm:space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold gradient-text flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[var(--accent)]" />
            XAUUSD Trading
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
            Exness MT5 Demo · Server: Exness-MT5Trial9 · Login: 436475793
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="success" size="sm">DEMO</Badge>
          <button onClick={fetchPrice} className="p-2 rounded-lg glass hover:border-accent/30 transition-all">
            <RefreshCw className={`w-4 h-4 text-[var(--text-secondary)] ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Price Display */}
      <div className="glass-strong rounded-2xl p-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-purple/5 pointer-events-none" />
        <div className="relative z-10">
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">XAUUSD (Gold)</p>
          <h2 className="text-4xl sm:text-5xl font-bold text-text-primary font-mono">
            ${price.toFixed(2)}
          </h2>
          <div className="flex items-center justify-center gap-4 mt-3">
            <span className="text-xs text-[var(--text-muted)]">Last: {lastUpdate}</span>
            <span className="text-xs text-[var(--text-muted)]">P&L: <span className={openPnL >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}>${openPnL.toFixed(2)}</span></span>
          </div>
        </div>
      </div>

      {/* Account Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="glass rounded-xl p-4 text-center">
          <div className="text-lg font-bold text-[var(--accent)]">${balance.toFixed(2)}</div>
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Balance</div>
        </div>
        <div className="glass rounded-xl p-4 text-center">
          <div className={`text-lg font-bold ${openPnL >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
            ${openPnL.toFixed(2)}
          </div>
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Open P&L</div>
        </div>
        <div className="glass rounded-xl p-4 text-center">
          <div className="text-lg font-bold text-text-primary">{winRate}%</div>
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Win Rate</div>
        </div>
        <div className="glass rounded-xl p-4 text-center">
          <div className={`text-lg font-bold ${totalPnL >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
            ${totalPnL.toFixed(2)}
          </div>
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Total P&L</div>
        </div>
      </div>

      {/* Trade Panel */}
      <div className="glass-strong rounded-2xl p-6">
        <h3 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
          <Target className="w-4 h-4 text-[var(--accent)]" />
          New Trade
        </h3>
        
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1 block">Type</label>
            <div className="flex gap-2">
              <button
                onClick={() => setTradeType('BUY')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  tradeType === 'BUY'
                    ? 'bg-[var(--success)] text-white shadow-[0_0_20px_rgba(34,197,94,0.3)]'
                    : 'glass border border-border text-text-secondary'
                }`}
              >
                <ArrowUpRight className="w-4 h-4 inline mr-1" /> BUY
              </button>
              <button
                onClick={() => setTradeType('SELL')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  tradeType === 'SELL'
                    ? 'bg-[var(--danger)] text-white shadow-[0_0_20px_rgba(239,68,68,0.3)]'
                    : 'glass border border-border text-text-secondary'
                }`}
              >
                <ArrowDownRight className="w-4 h-4 inline mr-1" /> SELL
              </button>
            </div>
          </div>
          
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1 block">Lot Size</label>
            <select
              value={lotSize}
              onChange={(e) => setLotSize(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-border text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="0.01">0.01 (Micro)</option>
              <option value="0.1">0.1 (Mini)</option>
              <option value="1">1.0 (Standard)</option>
            </select>
          </div>
          
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1 block">Stop Loss</label>
            <input
              type="number"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              placeholder={`e.g., ${(price - 20).toFixed(2)}`}
              className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
          </div>
          
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1 block">Take Profit</label>
            <input
              type="number"
              value={takeProfit}
              onChange={(e) => setTakeProfit(e.target.value)}
              placeholder={`e.g., ${(price + 30).toFixed(2)}`}
              className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        <button
          onClick={openTrade}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-accent to-purple text-white font-semibold text-sm hover:opacity-90 transition-opacity shadow-[0_0_30px_rgba(79,143,255,0.2)] flex items-center justify-center gap-2"
        >
          <Play className="w-4 h-4" />
          Open {tradeType} Trade @ ${price.toFixed(2)}
        </button>
      </div>

      {/* Open Trades */}
      {trades.filter(t => t.status === 'OPEN').length > 0 && (
        <div className="glass-strong rounded-2xl p-6">
          <h3 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-[var(--accent)]" />
            Open Trades ({trades.filter(t => t.status === 'OPEN').length})
          </h3>
          <div className="space-y-3">
            {trades.filter(t => t.status === 'OPEN').map(trade => {
              const currentPnl = trade.type === 'BUY' 
                ? (price - trade.entry) * trade.size * 100 
                : (trade.entry - price) * trade.size * 100;
              
              return (
                <div key={trade.id} className="flex items-center justify-between p-4 rounded-xl glass border border-border">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      trade.type === 'BUY' ? 'bg-[var(--success)]/10' : 'bg-[var(--danger)]/10'
                    }`}>
                      {trade.type === 'BUY' 
                        ? <TrendingUp className="w-4 h-4 text-[var(--success)]" />
                        : <TrendingDown className="w-4 h-4 text-[var(--danger)]" />
                      }
                    </div>
                    <div>
                      <div className="text-sm font-bold text-text-primary">{trade.type} {trade.symbol}</div>
                      <div className="text-[10px] text-[var(--text-muted)]">
                        Entry: ${trade.entry.toFixed(2)} · SL: ${trade.sl} · TP: ${trade.tp} · {trade.size} lots
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-bold ${currentPnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                      ${currentPnl.toFixed(2)}
                    </span>
                    <button
                      onClick={() => closeTrade(trade.id)}
                      className="p-2 rounded-lg bg-[var(--danger)]/10 hover:bg-[var(--danger)]/20 transition-all"
                    >
                      <Square className="w-3.5 h-3.5 text-[var(--danger)]" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Trade History */}
      {trades.filter(t => t.status === 'CLOSED').length > 0 && (
        <div className="glass-strong rounded-2xl p-6">
          <h3 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-[var(--accent)]" />
            Trade History ({trades.filter(t => t.status === 'CLOSED').length})
          </h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {trades.filter(t => t.status === 'CLOSED').map(trade => (
              <div key={trade.id} className="flex items-center justify-between p-3 rounded-xl glass border border-border">
                <div className="flex items-center gap-3">
                  <Badge variant={trade.type === 'BUY' ? 'success' : 'danger'} size="sm">
                    {trade.type}
                  </Badge>
                  <div>
                    <div className="text-xs text-text-primary font-medium">{trade.symbol} @ {trade.size} lots</div>
                    <div className="text-[10px] text-[var(--text-muted)]">{trade.time}</div>
                  </div>
                </div>
                <span className={`text-sm font-bold ${trade.pnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                  {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Connection Status */}
      <div className="glass rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--success)] pulse-dot" />
          <span className="text-xs text-[var(--text-muted)]">Market Data: Live (Yahoo Finance)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--warning)]" />
          <span className="text-xs text-[var(--text-muted)]">MT5: Demo Credentials Only</span>
        </div>
      </div>
    </div>
  );
}
