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
  IChartApi,
  ISeriesApi,
  ISeriesMarkersPluginApi,
} from 'lightweight-charts';
import { fetchBinanceKlines } from '../src/data';
import {
  calculateZigZagWithState,
  zigzagToLineData,
  ZigZagPoint,
  ZigZagResult,
} from '../src/indicators/zigzag';

const ZIGZAG_DEVIATION = 0.15; // 0.15% for 1m data

// State
let allData: CandlestickData<UTCTimestamp>[] = [];
let currentIndex = 0;
let replayInterval: ReturnType<typeof setInterval> | null = null;
let chart: IChartApi | null = null;
let candleSeries: ISeriesApi<'Candlestick'> | null = null;
let confirmedSeries: ISeriesApi<'Line'> | null = null;
let unconfirmedSeries: ISeriesApi<'Line'> | null = null;
let markersPlugin: ISeriesMarkersPluginApi<UTCTimestamp> | null = null;
let thresholdLine: IPriceLine | null = null;
let lastConfirmedCount = 0;
let lastUnconfirmedValue: number | null = null;
let lastUnconfirmedIsHigh: boolean | null = null;

// DOM elements
const startBtn = document.getElementById('start') as HTMLButtonElement;
const pauseBtn = document.getElementById('pause') as HTMLButtonElement;
const resetBtn = document.getElementById('reset') as HTMLButtonElement;
const speedSlider = document.getElementById('speed') as HTMLInputElement;
const speedValue = document.getElementById('speed-value') as HTMLSpanElement;
const statusEl = document.getElementById('status') as HTMLSpanElement;
const chartContainer = document.getElementById('chart') as HTMLDivElement;

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

function log(message: string, type: 'info' | 'confirm' | 'redraw' = 'info') {
  const colors: Record<string, string> = {
    info: 'color: #888',
    confirm: 'color: #26a69a; font-weight: bold',
    redraw: 'color: #ffa726',
  };
  console.log(`%c${message}`, colors[type]);
}

function setupChart() {
  chart = createChart(chartContainer, {
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

  candleSeries = chart.addSeries(CandlestickSeries, {
    upColor: '#26a69a',
    downColor: '#ef5350',
    borderVisible: false,
    wickUpColor: '#26a69a',
    wickDownColor: '#ef5350',
    lastValueVisible: false,
    priceLineVisible: false,
  });

  confirmedSeries = chart.addSeries(LineSeries, {
    color: '#2962FF',
    lineWidth: 2,
    lastValueVisible: false,
    priceLineVisible: false,
    crosshairMarkerVisible: false,
  });

  unconfirmedSeries = chart.addSeries(LineSeries, {
    color: 'rgba(100, 100, 100, 0.6)',
    lineWidth: 2,
    lastValueVisible: false,
    priceLineVisible: false,
    crosshairMarkerVisible: false,
  });

  markersPlugin = createSeriesMarkers(candleSeries, []);
}

function processCandle(index: number) {
  if (!candleSeries || !confirmedSeries || !unconfirmedSeries || !markersPlugin || !chart) {
    return;
  }

  const currentData = allData.slice(0, index + 1);
  const candle = allData[index];

  // Update candle series
  candleSeries.update(candle);

  // Calculate zigzag
  const result = calculateZigZagWithState(currentData, ZIGZAG_DEVIATION);
  if (!result) return;

  // Check for confirmation
  if (result.confirmed.length > lastConfirmedCount) {
    const newConfirmed = result.confirmed[result.confirmed.length - 1];
    log(
      `[Candle ${index}] CONFIRMED: ${newConfirmed.isHigh ? 'HIGH' : 'LOW'} @ ${newConfirmed.value.toFixed(2)} | New threshold: ${result.confirmationPrice.toFixed(2)}`,
      'confirm'
    );

    // Update confirmed series - always use setData to ensure lines connect
    const confirmedData = zigzagToLineData(result.confirmed);
    console.log('CONFIRMED SERIES DATA:', result.confirmed.map(p => ({
      time: p.time,
      value: p.value,
      isHigh: p.isHigh
    })));
    console.log('UNCONFIRMED SEGMENT will start at:', {
      time: result.confirmed[result.confirmed.length - 1].time,
      value: result.confirmed[result.confirmed.length - 1].value
    });
    confirmedSeries.setData(confirmedData);
    lastConfirmedCount = result.confirmed.length;
  }

  // Check for unconfirmed pivot changes (re-drawing)
  const unconfirmed = result.unconfirmed;
  if (lastUnconfirmedValue !== null) {
    const valueChanged = unconfirmed.value !== lastUnconfirmedValue;
    const typeChanged = unconfirmed.isHigh !== lastUnconfirmedIsHigh;

    if (valueChanged || typeChanged) {
      if (typeChanged) {
        log(
          `[Candle ${index}] Unconfirmed pivot CHANGED TYPE: now ${unconfirmed.isHigh ? 'HIGH' : 'LOW'} @ ${unconfirmed.value.toFixed(2)}`,
          'redraw'
        );
      } else {
        log(
          `[Candle ${index}] Unconfirmed pivot updated: ${unconfirmed.isHigh ? 'HIGH' : 'LOW'} @ ${unconfirmed.value.toFixed(2)} (was ${lastUnconfirmedValue.toFixed(2)})`,
          'redraw'
        );
      }
    }
  }
  lastUnconfirmedValue = unconfirmed.value;
  lastUnconfirmedIsHigh = unconfirmed.isHigh;

  // Update unconfirmed segment (only if times differ - lightweight-charts requires ascending order)
  const lastConfirmedPivot = result.confirmed[result.confirmed.length - 1];
  if (lastConfirmedPivot.time !== unconfirmed.time) {
    unconfirmedSeries.setData([
      { time: lastConfirmedPivot.time, value: lastConfirmedPivot.value },
      { time: unconfirmed.time, value: unconfirmed.value },
    ]);
  } else {
    unconfirmedSeries.setData([]);
  }

  // Update or create threshold line
  if (thresholdLine) {
    thresholdLine.applyOptions({ price: result.confirmationPrice });
  } else {
    thresholdLine = unconfirmedSeries.createPriceLine({
      price: result.confirmationPrice,
      color: '#888888',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: 'Confirm',
    });
  }

  // Update markers
  markersPlugin.setMarkers([
    ...confirmedPivotsToMarkers(result.confirmed),
    unconfirmedPivotToMarker(unconfirmed),
  ]);

  // Update status
  statusEl.textContent = `Candle ${index + 1}/${allData.length} | Confirmed: ${result.confirmed.length} | Unconfirmed: ${unconfirmed.isHigh ? 'HIGH' : 'LOW'} @ ${unconfirmed.value.toFixed(2)}`;
}

function startReplay() {
  if (currentIndex >= allData.length) {
    return;
  }

  const speed = parseInt(speedSlider.value);
  replayInterval = setInterval(() => {
    if (currentIndex >= allData.length) {
      stopReplay();
      statusEl.textContent += ' - FINISHED';
      return;
    }
    processCandle(currentIndex);
    currentIndex++;

    // Auto-scroll to keep current candle visible
    if (chart) {
      const barsToShow = 50;
      const from = Math.max(0, currentIndex - barsToShow);
      chart.timeScale().setVisibleLogicalRange({
        from,
        to: currentIndex + 5,
      });
    }
  }, speed);

  startBtn.disabled = true;
  pauseBtn.disabled = false;
  resetBtn.disabled = false;
  log(`Replay started at ${speed}ms per candle`, 'info');
}

function stopReplay() {
  if (replayInterval) {
    clearInterval(replayInterval);
    replayInterval = null;
  }
  startBtn.disabled = false;
  startBtn.textContent = 'Resume';
  pauseBtn.disabled = true;
}

function resetReplay() {
  stopReplay();
  currentIndex = 0;
  lastConfirmedCount = 0;
  lastUnconfirmedValue = null;
  lastUnconfirmedIsHigh = null;
  thresholdLine = null;

  if (chart) {
    chart.remove();
    chart = null;
  }

  setupChart();

  if (candleSeries) {
    candleSeries.setData([]);
  }
  if (confirmedSeries) {
    confirmedSeries.setData([]);
  }
  if (unconfirmedSeries) {
    unconfirmedSeries.setData([]);
  }

  startBtn.disabled = false;
  startBtn.textContent = 'Start Replay';
  resetBtn.disabled = true;
  statusEl.textContent = `Ready - ${allData.length} candles loaded`;
  console.clear();
  log('Replay reset', 'info');
}

async function init() {
  statusEl.textContent = 'Fetching data from Binance...';
  startBtn.disabled = true;

  try {
    allData = await fetchBinanceKlines('BTCUSDT', '1m', 500);
    log(`Fetched ${allData.length} candles from Binance`, 'info');
    statusEl.textContent = `Ready - ${allData.length} candles loaded`;
    startBtn.disabled = false;
    setupChart();
  } catch (error) {
    statusEl.textContent = `Error: ${error}`;
    console.error('Failed to fetch data:', error);
  }
}

// Event listeners
startBtn.addEventListener('click', startReplay);
pauseBtn.addEventListener('click', stopReplay);
resetBtn.addEventListener('click', resetReplay);
speedSlider.addEventListener('input', () => {
  speedValue.textContent = `${speedSlider.value}ms`;
  // If currently playing, restart with new speed
  if (replayInterval) {
    stopReplay();
    startReplay();
  }
});

// Start
init();
