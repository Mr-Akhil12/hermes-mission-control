'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, Circle, Clock, Save, RotateCcw, ChevronDown, ChevronUp, AlertTriangle, Lightbulb, BookOpen, TrendingUp, Target, BarChart3, Zap } from 'lucide-react';

interface DayCard {
  id: number;
  title: string;
  duration: string;
  checklist: string[];
  journal: string;
}

const COURSE_DAYS: DayCard[] = [
  { id: 1, title: 'Candlestick Anatomy + Doji Reversals', duration: '15 min', checklist: ['Watch TWP Lesson: Candlestick Patterns (5 min)', 'Identify 3 doji candles on XAUUSD H4 chart', 'Log: What happened after each doji? (reversal or continuation?)', 'Paper trade: Mark 1 setup you would have taken'], journal: 'What did I learn about doji candles on gold?' },
  { id: 2, title: 'Engulfing Patterns + Pin Bars', duration: '15 min', checklist: ['Watch TWP Lesson: Engulfing + Pin Bars (5 min)', 'Find 2 bullish engulfing and 2 bearish engulfing on XAUUSD H4', 'Find 3 pin bars (hammer / shooting star) on M15', 'Paper trade: Mark 1 engulfing setup with entry + SL + TP'], journal: 'Which pattern appears more reliably on gold?' },
  { id: 3, title: 'Support & Resistance Basics', duration: '15 min', checklist: ['Watch TWP Lesson: S/R Basics (5 min)', 'Draw 3 support and 3 resistance levels on XAUUSD H4', 'Mark which levels have been tested multiple times', 'Paper trade: Mark 1 bounce trade at a key level'], journal: 'What price levels does gold keep respecting?' },
  { id: 4, title: 'Market Structure: Higher Highs & Lower Lows', duration: '15 min', checklist: ['Watch TWP Lesson: Market Structure (5 min)', 'Identify the current trend on XAUUSD H4 (HH/HL or LH/LL)', 'Mark the last 5 swing highs and swing lows', 'Paper trade: Mark 1 trend-continuation entry'], journal: 'Is gold trending or ranging right now?' },
  { id: 5, title: 'Trend Lines + Channels', duration: '15 min', checklist: ['Watch TWP Lesson: Trend Lines (5 min)', 'Draw 2 trend lines on XAUUSD H4 (1 ascending, 1 descending)', 'Identify if price is in a channel', 'Paper trade: Mark 1 trend line bounce entry'], journal: "How clean are gold's trend lines?" },
  { id: 6, title: 'Fibonacci Retracement Levels', duration: '15 min', checklist: ['Watch TWP Lesson: Fibonacci (5 min)', 'Draw Fib retracement on the last major swing on XAUUSD H4', 'Mark the 38.2%, 50%, and 61.8% levels', 'Paper trade: Mark 1 Fib bounce entry (which level held?)'], journal: 'Which Fib level does gold respect most?' },
  { id: 7, title: 'Phase 1 Review + First Weekly Recap', duration: '20 min', checklist: ['Review all 6 paper trades from Days 1-6', 'Count: How many would have been winners?', 'Identify: Which pattern/setup feels most natural?', 'Write: 3 key takeaways from Week 1'], journal: 'What are my 3 biggest takeaways from Week 1?' },
  { id: 8, title: 'Breakout Entries + False Breakouts', duration: '15 min', checklist: ['Watch TWP Lesson: Breakout Entries (5 min)', 'Find 2 false breakouts on XAUUSD M15', 'Find 1 confirmed breakout on H4', 'Paper trade: Mark 1 breakout entry with confirmation filter'], journal: 'What confirms a real breakout vs a fake one?' },
  { id: 9, title: 'Retracement Entries (Pullback Trading)', duration: '15 min', checklist: ['Watch TWP Lesson: Retracement Entries (5 min)', 'Find 3 pullback setups in a trending market on M15', 'Mark entry at the pullback extreme + SL beyond the swing', 'Paper trade: Mark 1 retracement entry with RR calculation'], journal: 'How deep do gold pullbacks typically go?' },
  { id: 10, title: 'Multi-Timeframe Confluence', duration: '15 min', checklist: ['Watch TWP Lesson: Multi-Timeframe Analysis (5 min)', 'Check H4 bias (trend direction) → M15 entry → M5 precision', 'Find 1 setup where all 3 timeframes align', 'Paper trade: Mark the confluence entry'], journal: 'What does confluence look like on gold?' },
  { id: 11, title: 'Risk-Reward Ratio Mastery', duration: '15 min', checklist: ['Watch TWP Lesson: Risk Management (5 min)', 'Review last 5 paper trades: calculate actual RR for each', 'Identify: Which setups naturally offer 1.5:1+ RR?', 'Rule: No trade without minimum 1.5:1 RR'], journal: 'What is my average RR across all paper trades so far?' },
  { id: 12, title: 'Stop Loss Placement Strategies', duration: '15 min', checklist: ['Watch TWP Lesson: Stop Loss Methods (5 min)', 'Compare: Fixed SL vs Structure-based SL vs ATR-based SL', 'Apply each method to the same setup — which gives best RR?', 'Paper trade: Mark 1 trade with structure-based SL'], journal: "Which SL method works best for gold's volatility?" },
  { id: 13, title: 'Position Sizing + Risk Per Trade', duration: '15 min', checklist: ['Watch TWP Lesson: Position Sizing (5 min)', 'Calculate: 3% risk per trade on your ThinkMarkets account', 'Apply to 3 paper trades: what lot size for each?', 'Rule: Max 2 trades per session, max 3% daily loss'], journal: 'What is my position size for a 3% risk trade on gold?' },
  { id: 14, title: 'Phase 2 Review + Two-Week Assessment', duration: '20 min', checklist: ['Review all 13 paper trades: win rate, average RR, total P&L', 'Identify: Best setup type so far', 'Identify: Worst setup type (avoid going forward)', 'Write: 3 rules for your personal trading plan'], journal: 'What is my win rate? What are my 3 trading rules?' },
  { id: 15, title: 'Pre-Session Routine + 18:00 SAST Setup', duration: '20 min', checklist: ['At 17:45 SAST: Open MT5, check H4 bias', 'Draw key S/R levels for the session', 'Write: What is my bias? (bullish/bearish/neutral)', 'Set alerts at key levels — do NOT stare at charts'], journal: 'My bias for today is... Key levels to watch...' },
  { id: 16, title: 'First Live Trade (Minimum Size)', duration: '30 min', checklist: ['Enter 1 live trade during 18:00-19:00 SAST session', 'Use the setup type with highest paper win rate', 'Set SL and TP before entering (no moving SL!)', 'Log the trade: entry reason, emotions, outcome'], journal: 'Live Trade #1: Setup type, entry, SL, TP, outcome, emotions...' },
  { id: 17, title: 'Trade Journal Deep Dive', duration: '15 min', checklist: ["Review yesterday's live trade in detail", 'What went right? What went wrong?', 'Would you take the same trade again? Why/why not?', 'Paper trade: 1 additional setup for practice'], journal: 'What did I learn from my first live trade?' },
  { id: 18, title: 'Second Live Trade + Emotional Check', duration: '30 min', checklist: ['Enter 1 live trade (can be same or different setup)', 'Before entering: Rate your emotional state 1-10', 'After exiting: Rate your emotional state 1-10', 'Log: Did emotions affect the trade?'], journal: 'Live Trade #2: Emotions before/after, outcome, lesson...' },
  { id: 19, title: 'News Event Trading (Gold-Specific)', duration: '20 min', checklist: ['Check economic calendar: Any gold-moving events today?', 'NFP, CPI, FOMC, DGP — mark them on your calendar', 'Paper trade: How does gold react to news events?', 'Rule: No new trades 30 min before/after major news'], journal: 'What events move gold the most?' },
  { id: 20, title: 'Third Live Trade + Pattern Refinement', duration: '30 min', checklist: ['Enter 1 live trade using your best setup', 'Apply everything: confluence, RR check, SL placement', 'Log: Rate the setup quality 1-10 before entering', 'Compare: Setup quality score vs outcome'], journal: 'Live Trade #3: Setup quality, execution, outcome...' },
  { id: 21, title: 'Phase 3 Review + Live Trading Assessment', duration: '25 min', checklist: ['Review all 3 live trades: win rate, RR, emotional control', 'Compare: Paper trading results vs live results', 'Identify: Biggest difference between paper and live?', 'Write: Updated trading rules based on live experience'], journal: 'Paper vs live comparison, updated rules...' },
  { id: 22, title: 'Your Personal Trading Plan (Part 1)', duration: '20 min', checklist: ['Define: Which setup types will you trade? (max 3)', 'Define: Which timeframes? (bias + entry + precision)', 'Define: Max trades per session? Max daily loss?', 'Write: Your trading plan in 5 sentences or less'], journal: 'I will trade [setups] on [timeframes] with [rules]...' },
  { id: 23, title: 'Your Personal Trading Plan (Part 2)', duration: '20 min', checklist: ['Define: Entry checklist (must have all boxes checked)', 'Define: Exit rules (TP method, trailing SL, time-based)', 'Define: What voids a trade? (what makes you NOT take it)', 'Print/save: Your complete trading plan'], journal: 'Entry checklist, exit rules, void conditions...' },
  { id: 24, title: 'Live Trade + Trading Plan Execution', duration: '30 min', checklist: ['Enter 1 live trade following your written trading plan exactly', 'Check every box on your entry checklist before entering', 'Log: Did you follow the plan? Any deviations?', 'Rate: Plan adherence 1-10'], journal: 'Live Trade #4: Plan adherence, outcome, deviations...' },
  { id: 25, title: 'Correlation Tracking: USD Index + Gold', duration: '15 min', checklist: ['Open DXY (US Dollar Index) chart alongside XAUUSD', 'Track: When DXY goes up, what happens to gold? (10 examples)', 'Log: Correlation strength over the past month', 'Rule: Check DXY direction before every gold trade'], journal: 'DXY-Gold relationship over the past month...' },
  { id: 26, title: 'Live Trade + Correlation Filter', duration: '30 min', checklist: ['Check DXY direction before entering', 'Enter 1 live trade with correlation filter applied', 'Log: Did the correlation filter help?', 'Rate: Setup quality 1-10'], journal: 'Live Trade #5: Correlation filter applied, outcome...' },
  { id: 27, title: 'Weekly Recap + Performance Metrics', duration: '20 min', checklist: ['Calculate: Win rate, average RR, total P&L for the week', 'Identify: Best trade of the week (why was it good?)', 'Identify: Worst trade of the week (what went wrong?)', 'Write: 3 improvements for next week'], journal: 'Win rate, best/worst trade, improvements...' },
  { id: 28, title: 'Live Trade + Full System Execution', duration: '30 min', checklist: ['Execute 1 live trade using your complete system', 'Pre-session: Bias + S/R levels + DXY check', 'Entry: Checklist + confluence + RR verification', 'Log: Full trade journal entry'], journal: 'Live Trade #6: Full system execution, outcome...' },
  { id: 29, title: 'Live Trade + System Refinement', duration: '30 min', checklist: ['Execute 1 live trade', 'After: Review and refine one element of your system', 'Log: What will you change going forward?', 'Rate: Overall system confidence 1-10'], journal: 'Live Trade #7: System refinement, confidence level...' },
  { id: 30, title: '🎯 FINAL DAY: 30-Day Review + Way Forward', duration: '30 min', checklist: ['Calculate: Overall win rate across ALL paper + live trades', 'Calculate: Average RR, total P&L, max drawdown', 'Write: Your final trading plan (the one you\'ll use going forward)', 'Set: Goals for the next 30 days (win rate target, monthly ROI target)'], journal: '30-Day Final Review: Win rate, RR, P&L, final trading plan, next 30-day goals...' },
];

const PHASES = [
  { id: 1, label: 'Foundation', days: '1-7', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { id: 2, label: 'Entry Mastery', days: '8-14', color: 'text-green-400', bg: 'bg-green-400/10' },
  { id: 3, label: 'Live Application', days: '15-21', color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  { id: 4, label: 'Mastery + Automation', days: '22-30', color: 'text-purple-400', bg: 'bg-purple-400/10' },
];

export default function TWPActivationKit() {
  const [progress, setProgress] = useState<Record<string, any>>({});
  const [openDay, setOpenDay] = useState<number | null>(null);
  const [journalTexts, setJournalTexts] = useState<Record<number, string>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem('twp_progress');
      if (saved) setProgress(JSON.parse(saved));
      const journals = localStorage.getItem('twp_journals');
      if (journals) setJournalTexts(JSON.parse(journals));
    } catch {}
  }, []);

  const getProgress = () => {
    try { return JSON.parse(localStorage.getItem('twp_progress') || '{}'); } catch { return {}; }
  };

  const saveProgressToStorage = (p: Record<string, any>) => {
    localStorage.setItem('twp_progress', JSON.stringify(p));
  };

  const toggleDay = (n: number) => {
    setOpenDay(openDay === n ? null : n);
  };

  const markComplete = (n: number) => {
    const p = getProgress();
    if (p['day' + n]) { delete p['day' + n]; } else { p['day' + n] = true; }
    saveProgressToStorage(p);
    setProgress(p);
  };

  const saveProgress = () => {
    const p = getProgress();
    for (let i = 1; i <= 30; i++) {
      if (journalTexts[i]) p['journal' + i] = journalTexts[i];
    }
    saveProgressToStorage(p);
    alert('Progress saved! 💾');
  };

  const resetProgress = () => {
    if (confirm('Reset ALL progress? This cannot be undone.')) {
      localStorage.removeItem('twp_progress');
      localStorage.removeItem('twp_journals');
      setProgress({});
      setJournalTexts({});
    }
  };

  const completed = Object.keys(progress).filter(k => k.startsWith('day')).length;
  const pct = Math.round((completed / 30) * 100);
  let streak = 0;
  for (let i = 1; i <= 30; i++) { if (progress['day' + i]) streak++; else streak = 0; }

  const phaseDays = (id: number) => {
    switch(id) {
      case 1: return COURSE_DAYS.filter(d => d.id <= 7);
      case 2: return COURSE_DAYS.filter(d => d.id >= 8 && d.id <= 14);
      case 3: return COURSE_DAYS.filter(d => d.id >= 15 && d.id <= 21);
      case 4: return COURSE_DAYS.filter(d => d.id >= 22 && d.id <= 30);
      default: return [];
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-slide-up">
        <div className="flex items-center gap-2 mb-2">
          <Target className="w-5 h-5 text-[var(--accent)]" />
          <h1 className="text-xl sm:text-2xl font-bold gradient-text">TWP Course Activation Kit</h1>
        </div>
        <p className="text-sm text-[var(--text-muted)]">30-Day Price Action Mastery — Activate your R5000 investment. 15 min/day.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-slide-up" style={{ animationDelay: '60ms' }}>
        <div className="rounded-xl glass-panel border border-[var(--border)] p-4 text-center">
          <div className="text-2xl font-bold text-[var(--accent)]">{completed}</div>
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Days Done</div>
        </div>
        <div className="rounded-xl glass-panel border border-[var(--border)] p-4 text-center">
          <div className="text-2xl font-bold text-[var(--success)]">{completed}</div>
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Lessons</div>
        </div>
        <div className="rounded-xl glass-panel border border-[var(--border)] p-4 text-center">
          <div className="text-2xl font-bold text-[var(--warning)]">{completed}</div>
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Paper Trades</div>
        </div>
        <div className="rounded-xl glass-panel border border-[var(--border)] p-4 text-center">
          <div className="text-2xl font-bold text-[var(--danger)]">{streak}</div>
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Day Streak 🔥</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="rounded-xl glass-panel border border-[var(--border)] p-4 animate-slide-up" style={{ animationDelay: '120ms' }}>
        <div className="flex justify-between text-xs text-[var(--text-muted)] mb-2">
          <span>Overall Progress</span>
          <span>{completed} / 30 days ({pct}%)</span>
        </div>
        <div className="h-3 rounded-full bg-[var(--border)] overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-[var(--success)] to-[var(--accent)] transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Save/Reset */}
      <div className="flex gap-2">
        <button onClick={saveProgress} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--success)]/15 border border-[var(--success)]/30 text-[var(--success)] text-xs font-medium hover:bg-[var(--success)]/25 transition-all">
          <Save className="w-3.5 h-3.5" /> Save Progress
        </button>
        <button onClick={resetProgress} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--text-muted)]/10 border border-[var(--text-muted)]/20 text-[var(--text-muted)] text-xs font-medium hover:bg-[var(--text-muted)]/20 transition-all">
          <RotateCcw className="w-3.5 h-3.5" /> Reset
        </button>
      </div>

      {/* Warning */}
      <div className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-[var(--danger)] flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-[var(--danger)]">The 38-Day Deadlock</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">This course cost R5000. Every day without activation = R132 in lost potential. This kit breaks the deadlock. 15 minutes per day. No excuses.</p>
        </div>
      </div>

      {/* Phases */}
      {PHASES.map(phase => (
        <div key={phase.id} className="space-y-3">
          <div className="flex items-center gap-3">
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${phase.bg} ${phase.color}`}>
              Phase {phase.id}
            </span>
            <h2 className={`text-sm font-bold ${phase.color}`}>{phase.label} — Days {phase.days}</h2>
          </div>
          <div className="space-y-2">
            {phaseDays(phase.id).map(day => {
              const isOpen = openDay === day.id;
              const isComplete = progress['day' + day.id];
              return (
                <div key={day.id} className={`rounded-xl border transition-all ${isComplete ? 'border-[var(--success)]/30 bg-[var(--success)]/5' : 'border-[var(--border)] bg-[var(--bg-card)]'}`}>
                  <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => toggleDay(day.id)}>
                    <button
                      onClick={(e) => { e.stopPropagation(); markComplete(day.id); }}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${isComplete ? 'border-[var(--success)] bg-[var(--success)]' : 'border-[var(--border)] hover:border-[var(--accent)]'}`}
                    >
                      {isComplete && <CheckCircle2 className="w-4 h-4 text-white" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-[var(--accent)]">DAY {day.id}</span>
                        <span className={`text-xs font-medium ${isComplete ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}>{day.title}</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-[var(--text-muted)] flex-shrink-0">{day.duration}</span>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />}
                  </div>
                  {isOpen && (
                    <div className="px-3 pb-3 pt-1 border-t border-[var(--border)]">
                      <ul className="space-y-2 my-3">
                        {day.checklist.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                            <Circle className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
                            {item}
                          </li>
                        ))}
                      </ul>
                      <textarea
                        placeholder={day.journal}
                        value={journalTexts[day.id] || ''}
                        onChange={(e) => setJournalTexts(prev => ({ ...prev, [day.id]: e.target.value }))}
                        className="w-full rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] p-3 text-xs text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] resize-y min-h-[60px]"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Motivational Footer */}
      <div className="rounded-xl glass-panel border border-[var(--border)] p-6 text-center">
        <p className="text-sm text-[var(--text-muted)] italic">"The market rewards preparation, not prediction. 15 minutes a day compounds into mastery."</p>
        <p className="text-[10px] text-[var(--text-muted)] mt-2">TWP Course Activation Kit v1.0 · 30 days · 15 min/day · R5000 investment activation</p>
      </div>
    </div>
  );
}
