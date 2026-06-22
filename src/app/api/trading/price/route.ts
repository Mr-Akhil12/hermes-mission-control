import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Fetch XAUUSD price from Yahoo Finance
export async function GET() {
  try {
    const resp = await fetch(
      'https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1h&range=5d',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      }
    );

    if (resp.ok) {
      const data = await resp.json();
      const result = data.chart.result[0];
      const meta = result.meta;
      
      return NextResponse.json({
        symbol: 'XAUUSD',
        price: meta.regularMarketPrice,
        previousClose: meta.previousClose,
        currency: meta.currency,
        exchangeName: meta.exchangeName,
        instrumentType: meta.instrumentType,
        timestamp: new Date().toISOString(),
      });
    }

    throw new Error('Yahoo Finance API failed');
  } catch {
    // Return simulated price if API fails
    const basePrice = 4221.20;
    const change = (Math.random() - 0.5) * 10;
    
    return NextResponse.json({
      symbol: 'XAUUSD',
      price: Math.round((basePrice + change) * 100) / 100,
      previousClose: basePrice,
      currency: 'USD',
      exchangeName: 'SIMULATED',
      instrumentType: 'COMMODITY',
      timestamp: new Date().toISOString(),
    });
  }
}
