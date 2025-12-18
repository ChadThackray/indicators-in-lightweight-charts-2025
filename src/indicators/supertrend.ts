import { UTCTimestamp } from 'lightweight-charts';
import { OHLCData } from '../types';

function calculateATR(data: OHLCData[], period: number): number[] {
  const trueRanges: number[] = [];
  const atr: number[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      trueRanges.push(data[i].high - data[i].low);
    } else {
      const tr = Math.max(
        data[i].high - data[i].low,
        Math.abs(data[i].high - data[i - 1].close),
        Math.abs(data[i].low - data[i - 1].close)
      );
      trueRanges.push(tr);
    }

    if (i < period - 1) {
      atr.push(0);
    } else if (i === period - 1) {
      const sum = trueRanges.slice(0, period).reduce((a, b) => a + b, 0);
      atr.push(sum / period);
    } else {
      atr.push((atr[i - 1] * (period - 1) + trueRanges[i]) / period);
    }
  }

  return atr;
}

export interface SupertrendPoint {
  time: UTCTimestamp;
  value: number;
  isUptrend: boolean;
}

export function calculateSupertrend(
  data: OHLCData[],
  period: number = 10,
  multiplier: number = 3
): SupertrendPoint[] {
  if (data.length < period) {
    return [];
  }

  const atr = calculateATR(data, period);
  const result: SupertrendPoint[] = [];

  let upperBand = 0;
  let lowerBand = 0;
  let supertrend = 0;
  let isUptrend = true;

  for (let i = period - 1; i < data.length; i++) {
    const hl2 = (data[i].high + data[i].low) / 2;
    const basicUpperBand = hl2 + multiplier * atr[i];
    const basicLowerBand = hl2 - multiplier * atr[i];

    if (i === period - 1) {
      upperBand = basicUpperBand;
      lowerBand = basicLowerBand;
      isUptrend = data[i].close > hl2;
      supertrend = isUptrend ? lowerBand : upperBand;
    } else {
      const prevUpperBand = upperBand;
      const prevLowerBand = lowerBand;

      upperBand =
        basicUpperBand < prevUpperBand || data[i - 1].close > prevUpperBand
          ? basicUpperBand
          : prevUpperBand;

      lowerBand =
        basicLowerBand > prevLowerBand || data[i - 1].close < prevLowerBand
          ? basicLowerBand
          : prevLowerBand;

      const wasUptrend = isUptrend;

      if (wasUptrend) {
        isUptrend = data[i].close >= lowerBand;
      } else {
        isUptrend = data[i].close > upperBand;
      }

      supertrend = isUptrend ? lowerBand : upperBand;
    }

    result.push({
      time: data[i].time,
      value: supertrend,
      isUptrend,
    });
  }

  return result;
}
