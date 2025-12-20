import { CandlestickData, UTCTimestamp } from 'lightweight-charts';

// Binance REST API kline tuple structure
type BinanceKline = [
  number,  // 0: Open time (ms)
  string,  // 1: Open price
  string,  // 2: High price
  string,  // 3: Low price
  string,  // 4: Close price
  string,  // 5: Volume
  number,  // 6: Close time (ms)
  string,  // 7: Quote asset volume
  number,  // 8: Number of trades
  string,  // 9: Taker buy base asset volume
  string,  // 10: Taker buy quote asset volume
  string,  // 11: Unused
];

// Binance WebSocket kline message structure
export interface BinanceKlineMessage {
  e: string; // event type
  E: number; // event time
  s: string; // symbol
  k: {
    t: number; // kline open time (ms)
    T: number; // kline close time (ms)
    s: string; // symbol
    i: string; // interval
    o: string; // open price
    h: string; // high price
    l: string; // low price
    c: string; // close price
    v: string; // volume
    x: boolean; // is kline closed?
  };
}

// Convert Binance kline to CandlestickData
export function binanceKlineToCandlestick(
  kline: BinanceKlineMessage['k']
): CandlestickData<UTCTimestamp> {
  return {
    time: (kline.t / 1000) as UTCTimestamp,
    open: Number(kline.o),
    high: Number(kline.h),
    low: Number(kline.l),
    close: Number(kline.c),
  };
}

// Fetch historical klines from Binance REST API
export async function fetchBinanceKlines(
  symbol: string = 'BTCUSDT',
  interval: string = '1m',
  limit: number = 500
): Promise<CandlestickData<UTCTimestamp>[]> {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const response = await fetch(url);
  const data: BinanceKline[] = await response.json();

  return data.map((kline) => ({
    time: (kline[0] / 1000) as UTCTimestamp,
    open: Number(kline[1]),
    high: Number(kline[2]),
    low: Number(kline[3]),
    close: Number(kline[4]),
  }));
}

export async function loadCsvData(): Promise<CandlestickData<UTCTimestamp>[]> {
  const response = await fetch('/BTCUSDT-1h-2025-11.csv');
  const text = await response.text();
  const lines = text.trim().split('\n');

  return lines.map((line) => {
    const columns = line.split(',');
    return {
      time: (Number(columns[0]) / 1_000_000) as UTCTimestamp,
      open: Number(columns[1]),
      high: Number(columns[2]),
      low: Number(columns[3]),
      close: Number(columns[4]),
    };
  });
}
