/**
 * Monte Carlo Simulation Engine
 * Quant Edge Strategy Profile: S/R + Momentum Continuation
 *
 * Simulates N trading sessions using a random walk of wins/losses
 * based on the strategy's historical win rate and risk-reward ratio.
 */

export interface MonteCarloParams {
  /** Starting account balance in USD */
  initialBalance: number
  /** Fraction of account risked per trade (e.g. 0.01 = 1%) */
  riskPerTrade: number
  /** Probability of a winning trade (0–1) */
  winRate: number
  /** Reward-to-risk ratio (e.g. 1.5 means 1.5:1) */
  rewardRatio: number
  /** Number of trades per simulation path */
  numTrades: number
  /** Number of simulation paths to run */
  numSimulations: number
}

export interface MonteCarloResult {
  /** Average win rate across all simulations */
  winRate: number
  /** Average max drawdown (as percentage) */
  maxDrawdown: number
  /** Average profit factor (gross profit / gross loss) */
  profitFactor: number
  /** Sharpe ratio approximation (annualized) */
  sharpeRatio: number
  /** Representative equity curve (median simulation) */
  equityCurve: number[]
  /** Histogram buckets for final balance distribution */
  histogram: HistogramBucket[]
  /** Summary stats */
  medianBalance: number
  bestCase: number
  worstCase: number
  avgFinalBalance: number
}

export interface HistogramBucket {
  label: string
  count: number
  percentage: number
}

/** Default Quant Edge strategy parameters */
export const DEFAULT_PARAMS: MonteCarloParams = {
  initialBalance: 10000,
  riskPerTrade: 0.01,
  winRate: 0.55,
  rewardRatio: 1.5,
  numTrades: 252, // ~1 year of daily trading
  numSimulations: 10000,
}

/**
 * Run a single simulation path
 * Returns the equity curve for that path
 */
function simulatePath(params: MonteCarloParams): number[] {
  const { initialBalance, riskPerTrade, winRate, rewardRatio, numTrades } = params
  const curve: number[] = [initialBalance]
  let balance = initialBalance

  for (let i = 0; i < numTrades; i++) {
    const isWin = Math.random() < winRate
    const riskAmount = balance * riskPerTrade
    const pnl = isWin ? riskAmount * rewardRatio : -riskAmount
    balance = Math.max(0, balance + pnl)
    curve.push(balance)

    // If account blows up, fill remaining with 0
    if (balance <= 0) {
      while (curve.length <= numTrades) curve.push(0)
      break
    }
  }

  return curve
}

/**
 * Calculate max drawdown from an equity curve
 */
function calcMaxDrawdown(curve: number[]): number {
  let peak = curve[0]
  let maxDD = 0

  for (const val of curve) {
    if (val > peak) peak = val
    const dd = peak > 0 ? (peak - val) / peak : 0
    if (dd > maxDD) maxDD = dd
  }

  return maxDD * 100 // Return as percentage
}

/**
 * Calculate Sharpe ratio from trade returns
 */
function calcSharpeFromCurve(curve: number[]): number {
  const returns: number[] = []
  for (let i = 1; i < curve.length; i++) {
    if (curve[i - 1] > 0) {
      returns.push((curve[i] - curve[i - 1]) / curve[i - 1])
    }
  }

  if (returns.length < 2) return 0

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length - 1)
  const stdDev = Math.sqrt(variance)

  if (stdDev === 0) return 0

  // Annualize assuming 252 trading days
  return (mean / stdDev) * Math.sqrt(252)
}

/**
 * Run the full Monte Carlo simulation
 */
export function runMonteCarlo(
  params: Partial<MonteCarloParams> = {}
): MonteCarloResult {
  const p: MonteCarloParams = { ...DEFAULT_PARAMS, ...params }

  // Run all simulations
  const allCurves: number[][] = []
  for (let i = 0; i < p.numSimulations; i++) {
    allCurves.push(simulatePath(p))
  }

  // Collect final balances
  const finalBalances = allCurves.map((c) => c[c.length - 1])
  finalBalances.sort((a, b) => a - b)

  // Find median curve
  const medianIdx = Math.floor(p.numSimulations / 2)

  // Sort curves by final balance to find median
  const curveIndices = Array.from({ length: p.numSimulations }, (_, i) => i)
  curveIndices.sort((a, b) => finalBalances[a] - finalBalances[b])

  // Wait, I need to sort by final balance from allCurves
  const sortedCurves = [...allCurves].sort(
    (a, b) => a[a.length - 1] - b[b.length - 1]
  )
  const medianCurve = sortedCurves[Math.floor(p.numSimulations / 2)]

  // Calculate metrics across all simulations
  let totalMaxDD = 0
  let totalSharpe = 0
  let totalProfitFactor = 0

  for (const curve of allCurves) {
    totalMaxDD += calcMaxDrawdown(curve)

    // Profit factor per simulation
    let grossProfit = 0
    let grossLoss = 0
    for (let i = 1; i < curve.length; i++) {
      const diff = curve[i] - curve[i - 1]
      if (diff > 0) grossProfit += diff
      else grossLoss += Math.abs(diff)
    }
    totalProfitFactor += grossLoss > 0 ? grossProfit / grossLoss : 0
    totalSharpe += calcSharpeFromCurve(curve)
  }

  // Build histogram
  const numBuckets = 20
  const minBal = finalBalances[0]
  const maxBal = finalBalances[finalBalances.length - 1]
  const range = maxBal - minBal
  const bucketSize = range > 0 ? range / numBuckets : 1

  const buckets: HistogramBucket[] = []
  for (let i = 0; i < numBuckets; i++) {
    const lo = minBal + i * bucketSize
    const hi = lo + bucketSize
    const count = finalBalances.filter(
      (b) => b >= lo && (i === numBuckets - 1 ? b <= hi : b < hi)
    ).length
    buckets.push({
      label: `$${Math.round(lo)}`,
      count,
      percentage: (count / p.numSimulations) * 100,
    })
  }

  // Median of final balances
  const median = finalBalances[Math.floor(finalBalances.length / 2)]

  return {
    winRate: p.winRate * 100,
    maxDrawdown: totalMaxDD / p.numSimulations,
    profitFactor: totalProfitFactor / p.numSimulations,
    sharpeRatio: totalSharpe / p.numSimulations,
    equityCurve: medianCurve,
    histogram: buckets,
    medianBalance: median,
    bestCase: finalBalances[finalBalances.length - 1],
    worstCase: finalBalances[0],
    avgFinalBalance:
      finalBalances.reduce((a, b) => a + b, 0) / p.numSimulations,
  }
}
