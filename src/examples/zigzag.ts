import {
  createChart,
  CandlestickSeries,
  LineSeries,
  createSeriesMarkers,
  SeriesMarker,
  UTCTimestamp,
} from 'lightweight-charts';
import { loadCsvData } from '../data';
import { calculateZigZag, zigzagToLineData } from '../indicators/zigzag';

export async function render(container: HTMLElement): Promise<void> {
  const chart = createChart(container, {
    width: container.clientWidth,
    height: container.clientHeight,
    layout: {
      background: { color: '#1e1e1e' },
      textColor: '#d1d4dc',
    },
    grid: {
      vertLines: { color: '#2B2B43' },
      horzLines: { color: '#2B2B43' },
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

  const zigzagSeries = chart.addSeries(LineSeries, {
    color: '#2962FF',
    lineWidth: 2,
    lastValueVisible: false,
    priceLineVisible: false,
    crosshairMarkerVisible: false,
  });

  const data = await loadCsvData();
  candleSeries.setData(data);

  const pivots = calculateZigZag(data, 3);
  const zigzagLineData = zigzagToLineData(pivots);
  zigzagSeries.setData(zigzagLineData);

  // Add markers at pivot points with offset to avoid collision
  const offset = 0.01; // 1% offset from the price
  const markers: SeriesMarker<UTCTimestamp>[] = pivots.map((pivot) => ({
    time: pivot.time,
    position: pivot.isHigh ? 'atPriceBottom' : 'atPriceTop',
    price: pivot.isHigh ? pivot.value * (1 + offset) : pivot.value * (1 - offset),
    color: pivot.isHigh ? '#ef5350' : '#26a69a',
    shape: pivot.isHigh ? 'arrowDown' : 'arrowUp',
    text: pivot.value.toFixed(2),
    size: 2,
  }));

  createSeriesMarkers(candleSeries, markers);

  const barsToShow = 24 * 10;
  chart.timeScale().setVisibleLogicalRange({
    from: data.length - barsToShow,
    to: data.length,
  });

  window.addEventListener('resize', () => {
    chart.applyOptions({
      width: container.clientWidth,
      height: container.clientHeight,
    });
  });
}
