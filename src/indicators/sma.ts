import { LineData, UTCTimestamp } from 'lightweight-charts';

interface OHLCData {
  time: UTCTimestamp;
  close: number;
}

export function calculateSMA(
  data: OHLCData[],
  period: number
): LineData<UTCTimestamp>[] {
  const result: LineData<UTCTimestamp>[] = [];

  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close;
    }
    result.push({
      time: data[i].time,
      value: sum / period,
    });
  }

  return result;
}
