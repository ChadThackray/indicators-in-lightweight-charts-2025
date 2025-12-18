import { UTCTimestamp } from 'lightweight-charts';

export interface OHLCData {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
}
