import {
  createChart,
  CandlestickSeries,
  LineSeries,
  CandlestickData,
  UTCTimestamp,
  Time,
} from 'lightweight-charts';
import {
  fetchBinanceKlines,
  BinanceKlineMessage,
  binanceKlineToCandlestick,
} from '../data';
import { calculateSMA } from '../indicators/sma';

const SMA_PERIOD = 20;

// Calculate SMA for the last bar only (for real-time updates)
function calculateLastSMA(
  data: CandlestickData<UTCTimestamp>[],
  period: number
): number | null {
  if (data.length < period) return null;

  let sum = 0;
  for (let i = data.length - period; i < data.length; i++) {
    sum += data[i].close;
  }
  return sum / period;
}

export async function render(container: HTMLElement): Promise<() => void> {
  const chart = createChart(container, {
    autoSize: true,
    layout: {
      background: { color: '#1e1e1e' },
      textColor: '#d1d4dc',
    },
    grid: {
      vertLines: { color: '#2B2B43' },
      horzLines: { color: '#2B2B43' },
    },
    timeScale: {
      tickMarkFormatter: (time: Time) => {
        const date = new Date((time as number) * 1000);
        return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      },
    },
  });

  const candleSeries = chart.addSeries(CandlestickSeries, {
    upColor: '#26a69a',
    downColor: '#ef5350',
    borderVisible: false,
    wickUpColor: '#26a69a',
    wickDownColor: '#ef5350',
    lastValueVisible: false,
    priceLineVisible: false,
  });

  const smaSeries = chart.addSeries(LineSeries, {
    color: '#F7931A',
    lineWidth: 2,
    lastValueVisible: false,
    priceLineVisible: false,
    crosshairMarkerVisible: false,
  });

  // Fetch initial historical data
  const data = await fetchBinanceKlines('BTCUSDT', '1m', 500);

  // Remove the last (incomplete) candle - WebSocket will provide current candle
  data.pop();

  candleSeries.setData(data);

  // Calculate initial SMA
  const smaData = calculateSMA(data, SMA_PERIOD);
  smaSeries.setData(smaData);

  // Set initial visible range
  const barsToShow = 100;
  chart.timeScale().setVisibleLogicalRange({
    from: data.length - barsToShow,
    to: data.length,
  });

  // Connect to Binance WebSocket for real-time updates
  const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@kline_1m');

  ws.onmessage = (event) => {
    const message: BinanceKlineMessage = JSON.parse(event.data);
    const kline = message.k;
    const candle = binanceKlineToCandlestick(kline);

    // Only process candles that are >= our last bar's time
    const lastBar = data[data.length - 1];
    if (candle.time < lastBar.time) {
      return; // Ignore old candles
    }

    if (candle.time === lastBar.time) {
      // Update existing bar
      data[data.length - 1] = candle;
    } else {
      // New bar
      data.push(candle);
    }

    // Update candlestick series
    candleSeries.update(candle);

    // Update SMA
    const smaValue = calculateLastSMA(data, SMA_PERIOD);
    if (smaValue !== null) {
      smaSeries.update({
        time: candle.time,
        value: smaValue,
      });
    }
  };

  // Return cleanup function
  return () => {
    ws.close();
    chart.remove();
  };
}
