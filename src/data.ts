import { CandlestickData, UTCTimestamp } from 'lightweight-charts';

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
