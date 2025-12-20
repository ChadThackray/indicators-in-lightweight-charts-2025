import { LineData, UTCTimestamp } from 'lightweight-charts';
import { OHLCData } from '../types';

export interface ZigZagPoint {
  time: UTCTimestamp;
  value: number;
  isHigh: boolean;
}

export interface ZigZagResult {
  confirmed: ZigZagPoint[];
  unconfirmed: ZigZagPoint;
  confirmationPrice: number;
}

export function calculateZigZag(
  data: OHLCData[],
  deviation: number = 5 // percentage
): ZigZagPoint[] {
  if (data.length < 2) {
    return [];
  }

  const threshold = deviation / 100;
  const pivots: ZigZagPoint[] = [];

  // Find initial direction by looking at first significant move
  let lastPivotIndex = 0;
  let lastPivotPrice = data[0].high;
  let isLastPivotHigh = true;

  // Determine initial trend
  for (let i = 1; i < data.length; i++) {
    const highChange = (data[i].high - data[0].low) / data[0].low;
    const lowChange = (data[0].high - data[i].low) / data[0].high;

    if (highChange >= threshold) {
      lastPivotIndex = 0;
      lastPivotPrice = data[0].low;
      isLastPivotHigh = false;
      pivots.push({
        time: data[0].time,
        value: data[0].low,
        isHigh: false,
      });
      break;
    } else if (lowChange >= threshold) {
      lastPivotIndex = 0;
      lastPivotPrice = data[0].high;
      isLastPivotHigh = true;
      pivots.push({
        time: data[0].time,
        value: data[0].high,
        isHigh: true,
      });
      break;
    }
  }

  // If no initial pivot found, start with first bar's high
  if (pivots.length === 0) {
    pivots.push({
      time: data[0].time,
      value: data[0].high,
      isHigh: true,
    });
  }

  // Find subsequent pivots
  for (let i = 1; i < data.length; i++) {
    if (isLastPivotHigh) {
      // Looking for a lower pivot
      if (data[i].low < lastPivotPrice) {
        // New low extends current move
        lastPivotPrice = data[i].low;
        lastPivotIndex = i;
      } else {
        // Check if we've reversed enough to confirm the low
        const reversal = (data[i].high - lastPivotPrice) / lastPivotPrice;
        if (reversal >= threshold) {
          // Confirm the low pivot
          pivots.push({
            time: data[lastPivotIndex].time,
            value: lastPivotPrice,
            isHigh: false,
          });
          isLastPivotHigh = false;
          lastPivotPrice = data[i].high;
          lastPivotIndex = i;
        }
      }
    } else {
      // Looking for a higher pivot
      if (data[i].high > lastPivotPrice) {
        // New high extends current move
        lastPivotPrice = data[i].high;
        lastPivotIndex = i;
      } else {
        // Check if we've reversed enough to confirm the high
        const reversal = (lastPivotPrice - data[i].low) / lastPivotPrice;
        if (reversal >= threshold) {
          // Confirm the high pivot
          pivots.push({
            time: data[lastPivotIndex].time,
            value: lastPivotPrice,
            isHigh: true,
          });
          isLastPivotHigh = true;
          lastPivotPrice = data[i].low;
          lastPivotIndex = i;
        }
      }
    }
  }

  // Add the last pivot (isLastPivotHigh tracks what we're looking for, so invert it)
  pivots.push({
    time: data[lastPivotIndex].time,
    value: lastPivotPrice,
    isHigh: !isLastPivotHigh,
  });

  return pivots;
}

export function zigzagToLineData(pivots: ZigZagPoint[]): LineData<UTCTimestamp>[] {
  return pivots.map((p) => ({
    time: p.time,
    value: p.value,
  }));
}

export function calculateZigZagWithState(
  data: OHLCData[],
  deviation: number = 5
): ZigZagResult | null {
  if (data.length < 2) {
    return null;
  }

  const threshold = deviation / 100;
  const confirmed: ZigZagPoint[] = [];

  let lastPivotIndex = 0;
  let lastPivotPrice = data[0].high;
  let isLastPivotHigh = true;

  // Determine initial trend
  for (let i = 1; i < data.length; i++) {
    const highChange = (data[i].high - data[0].low) / data[0].low;
    const lowChange = (data[0].high - data[i].low) / data[0].high;

    if (highChange >= threshold) {
      lastPivotIndex = 0;
      lastPivotPrice = data[0].low;
      isLastPivotHigh = false;
      confirmed.push({
        time: data[0].time,
        value: data[0].low,
        isHigh: false,
      });
      break;
    } else if (lowChange >= threshold) {
      lastPivotIndex = 0;
      lastPivotPrice = data[0].high;
      isLastPivotHigh = true;
      confirmed.push({
        time: data[0].time,
        value: data[0].high,
        isHigh: true,
      });
      break;
    }
  }

  if (confirmed.length === 0) {
    confirmed.push({
      time: data[0].time,
      value: data[0].high,
      isHigh: true,
    });
  }

  // Find subsequent pivots
  for (let i = 1; i < data.length; i++) {
    if (isLastPivotHigh) {
      if (data[i].low < lastPivotPrice) {
        lastPivotPrice = data[i].low;
        lastPivotIndex = i;
      } else {
        const reversal = (data[i].high - lastPivotPrice) / lastPivotPrice;
        if (reversal >= threshold) {
          confirmed.push({
            time: data[lastPivotIndex].time,
            value: lastPivotPrice,
            isHigh: false,
          });
          isLastPivotHigh = false;
          lastPivotPrice = data[i].high;
          lastPivotIndex = i;
        }
      }
    } else {
      if (data[i].high > lastPivotPrice) {
        lastPivotPrice = data[i].high;
        lastPivotIndex = i;
      } else {
        const reversal = (lastPivotPrice - data[i].low) / lastPivotPrice;
        if (reversal >= threshold) {
          confirmed.push({
            time: data[lastPivotIndex].time,
            value: lastPivotPrice,
            isHigh: true,
          });
          isLastPivotHigh = true;
          lastPivotPrice = data[i].low;
          lastPivotIndex = i;
        }
      }
    }
  }

  // The unconfirmed pivot (isLastPivotHigh tracks what we're LOOKING for, so invert)
  const unconfirmed: ZigZagPoint = {
    time: data[lastPivotIndex].time,
    value: lastPivotPrice,
    isHigh: !isLastPivotHigh,
  };

  // Calculate confirmation price
  // If unconfirmed is a high, price must drop by threshold to confirm
  // If unconfirmed is a low, price must rise by threshold to confirm
  const confirmationPrice = unconfirmed.isHigh
    ? lastPivotPrice * (1 - threshold)
    : lastPivotPrice * (1 + threshold);

  return {
    confirmed,
    unconfirmed,
    confirmationPrice,
  };
}
