import { HistogramData, LineData, UTCTimestamp } from 'lightweight-charts';
import { OHLCData } from '../types';

export interface MACDResult {
  macdLine: LineData<UTCTimestamp>[];
  signalLine: LineData<UTCTimestamp>[];
  histogram: HistogramData<UTCTimestamp>[];
}

function calculateEMA(values: number[], period: number): number[] {
  const result: number[] = [];
  const multiplier = 2 / (period + 1);

  // First EMA is SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += values[i];
  }
  let ema = sum / period;
  result.push(ema);

  // Subsequent EMAs
  for (let i = period; i < values.length; i++) {
    ema = (values[i] - ema) * multiplier + ema;
    result.push(ema);
  }

  return result;
}

export function calculateMACD(
  data: OHLCData[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDResult {
  const closes = data.map((d) => d.close);

  const fastEMA = calculateEMA(closes, fastPeriod);
  const slowEMA = calculateEMA(closes, slowPeriod);

  // MACD line starts when we have both EMAs
  // Fast EMA starts at index fastPeriod-1, slow EMA starts at index slowPeriod-1
  const macdStartIndex = slowPeriod - 1;
  const macdValues: number[] = [];

  for (let i = 0; i < slowEMA.length; i++) {
    const fastIndex = i + (slowPeriod - fastPeriod);
    macdValues.push(fastEMA[fastIndex] - slowEMA[i]);
  }

  // Signal line is EMA of MACD values
  const signalValues = calculateEMA(macdValues, signalPeriod);
  const signalStartIndex = macdStartIndex + signalPeriod - 1;

  // Build result arrays
  const macdLine: LineData<UTCTimestamp>[] = [];
  const signalLine: LineData<UTCTimestamp>[] = [];
  const histogram: HistogramData<UTCTimestamp>[] = [];

  for (let i = 0; i < signalValues.length; i++) {
    const dataIndex = signalStartIndex + i;
    const macdValue = macdValues[signalPeriod - 1 + i];
    const signalValue = signalValues[i];
    const histValue = macdValue - signalValue;

    macdLine.push({
      time: data[dataIndex].time,
      value: macdValue,
    });

    signalLine.push({
      time: data[dataIndex].time,
      value: signalValue,
    });

    histogram.push({
      time: data[dataIndex].time,
      value: histValue,
      color: histValue >= 0 ? '#26a69a' : '#ef5350',
    });
  }

  return { macdLine, signalLine, histogram };
}
