import {
  createChart,
  CandlestickSeries,
  LineSeries,
  LineStyle,
  createSeriesMarkers,
  SeriesMarker,
  UTCTimestamp,
  CandlestickData,
  Time,
  IPriceLine,
} from 'lightweight-charts';
import {
  fetchBinanceKlines,
  BinanceKlineMessage,
  binanceKlineToCandlestick,
} from '../data';
import { calculateZigZagWithState, zigzagToLineData, ZigZagPoint } from '../indicators/zigzag';

const ZIGZAG_DEVIATION = 0.15; // 0.15% for 1m data

function confirmedPivotsToMarkers(pivots: ZigZagPoint[]): SeriesMarker<UTCTimestamp>[] {
  const offset = 0.001;
  return pivots.map((pivot) => ({
    time: pivot.time,
    position: pivot.isHigh ? 'atPriceBottom' : 'atPriceTop',
    price: pivot.isHigh ? pivot.value * (1 + offset) : pivot.value * (1 - offset),
    color: pivot.isHigh ? '#ef5350' : '#26a69a',
    shape: pivot.isHigh ? 'arrowDown' : 'arrowUp',
    text: pivot.value.toFixed(2),
    size: 2,
  }));
}

function unconfirmedPivotToMarker(pivot: ZigZagPoint): SeriesMarker<UTCTimestamp> {
  const offset = 0.001;
  return {
    time: pivot.time,
    position: pivot.isHigh ? 'atPriceBottom' : 'atPriceTop',
    price: pivot.isHigh ? pivot.value * (1 + offset) : pivot.value * (1 - offset),
    color: '#888888',
    shape: pivot.isHigh ? 'arrowDown' : 'arrowUp',
    text: pivot.value.toFixed(2),
    size: 2,
  };
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

  // Confirmed pivots line (solid blue)
  const confirmedSeries = chart.addSeries(LineSeries, {
    color: '#2962FF',
    lineWidth: 2,
    lastValueVisible: false,
    priceLineVisible: false,
    crosshairMarkerVisible: false,
  });

  // Unconfirmed segment line (gray)
  const unconfirmedSeries = chart.addSeries(LineSeries, {
    color: 'rgba(100, 100, 100, 0.6)',
    lineWidth: 2,
    lastValueVisible: false,
    priceLineVisible: false,
    crosshairMarkerVisible: false,
  });

  // Fetch initial historical data
  const data: CandlestickData<UTCTimestamp>[] = await fetchBinanceKlines(
    'BTCUSDT',
    '1m',
    500
  );

  // Remove the last (incomplete) candle - WebSocket will provide current candle
  data.pop();

  candleSeries.setData(data);

  // Calculate initial ZigZag
  let lastResult = calculateZigZagWithState(data, ZIGZAG_DEVIATION);
  if (!lastResult) {
    throw new Error('Not enough data for ZigZag calculation');
  }

  // Set initial confirmed line
  confirmedSeries.setData(zigzagToLineData(lastResult.confirmed));

  // Set initial unconfirmed segment (only if times differ - lightweight-charts requires ascending order)
  const lastConfirmed = lastResult.confirmed[lastResult.confirmed.length - 1];
  if (lastConfirmed.time !== lastResult.unconfirmed.time) {
    unconfirmedSeries.setData([
      { time: lastConfirmed.time, value: lastConfirmed.value },
      { time: lastResult.unconfirmed.time, value: lastResult.unconfirmed.value },
    ]);
  }

  // Create markers for confirmed pivots
  const markersPlugin = createSeriesMarkers(candleSeries, [
    ...confirmedPivotsToMarkers(lastResult.confirmed),
    unconfirmedPivotToMarker(lastResult.unconfirmed),
  ]);

  // Create threshold price line
  const thresholdLine: IPriceLine = unconfirmedSeries.createPriceLine({
    price: lastResult.confirmationPrice,
    color: '#888888',
    lineWidth: 1,
    lineStyle: LineStyle.Dashed,
    axisLabelVisible: true,
    title: 'Confirm',
  });

  // Set initial visible range
  const barsToShow = 100;
  chart.timeScale().setVisibleLogicalRange({
    from: data.length - barsToShow,
    to: data.length,
  });

  // Track last confirmed count for efficient updates
  let lastConfirmedCount = lastResult.confirmed.length;

  // Connect to Binance WebSocket for real-time updates
  const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@kline_1m');

  ws.onmessage = (event) => {
    const message: BinanceKlineMessage = JSON.parse(event.data);
    const kline = message.k;
    const candle = binanceKlineToCandlestick(kline);

    // Only process candles that are >= our last bar's time
    const lastBar = data[data.length - 1];
    if (candle.time < lastBar.time) {
      return;
    }

    if (candle.time === lastBar.time) {
      data[data.length - 1] = candle;
    } else {
      data.push(candle);
    }

    candleSeries.update(candle);

    // Recalculate ZigZag
    const result = calculateZigZagWithState(data, ZIGZAG_DEVIATION);
    if (!result) return;

    // Check if a new pivot was confirmed
    if (result.confirmed.length > lastConfirmedCount) {
      // New pivot confirmed - update confirmed series with new point
      const newConfirmed = result.confirmed[result.confirmed.length - 1];
      confirmedSeries.update({ time: newConfirmed.time, value: newConfirmed.value });
      lastConfirmedCount = result.confirmed.length;
    }

    // Always update unconfirmed segment (only if times differ - lightweight-charts requires ascending order)
    const lastConfirmedPivot = result.confirmed[result.confirmed.length - 1];
    if (lastConfirmedPivot.time !== result.unconfirmed.time) {
      unconfirmedSeries.setData([
        { time: lastConfirmedPivot.time, value: lastConfirmedPivot.value },
        { time: result.unconfirmed.time, value: result.unconfirmed.value },
      ]);
    } else {
      unconfirmedSeries.setData([]);
    }

    // Update threshold line position
    thresholdLine.applyOptions({ price: result.confirmationPrice });

    // Update markers
    markersPlugin.setMarkers([
      ...confirmedPivotsToMarkers(result.confirmed),
      unconfirmedPivotToMarker(result.unconfirmed),
    ]);

    lastResult = result;
  };

  return () => {
    ws.close();
    chart.remove();
  };
}
