import { LineData, UTCTimestamp } from 'lightweight-charts';

interface OHLCData {
  time: UTCTimestamp;
  close: number;
}

export function calculateRSI(
  data: OHLCData[],
  period: number = 14
): LineData<UTCTimestamp>[] {
  if (data.length < period + 1) {
    return [];
  }

  const result: LineData<UTCTimestamp>[] = [];
  const gains: number[] = [];
  const losses: number[] = [];

  // Calculate initial gains and losses
  for (let i = 1; i <= period; i++) {
    const change = data[i].close - data[i - 1].close;
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }

  let avgGain = gains.reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.reduce((a, b) => a + b, 0) / period;

  // First RSI value
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result.push({
    time: data[period].time,
    value: 100 - 100 / (1 + rs),
  });

  // Calculate subsequent RSI values using smoothed averages
  for (let i = period + 1; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const currentRs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push({
      time: data[i].time,
      value: 100 - 100 / (1 + currentRs),
    });
  }

  return result;
}
