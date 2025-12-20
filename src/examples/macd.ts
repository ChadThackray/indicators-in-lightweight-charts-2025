import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
} from 'lightweight-charts';
import { loadCsvData } from '../data';
import { calculateMACD } from '../indicators/macd';

export async function render(container: HTMLElement): Promise<void> {
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

  // MACD histogram in separate pane
  const histogramSeries = chart.addSeries(HistogramSeries, {
    color: '#26a69a',
    lastValueVisible: false,
    priceLineVisible: false,
  }, 1);

  // MACD line
  const macdLineSeries = chart.addSeries(LineSeries, {
    color: '#2962FF',
    lineWidth: 2,
    lastValueVisible: false,
    priceLineVisible: false,
    crosshairMarkerVisible: false,
  }, 1);

  // Signal line
  const signalLineSeries = chart.addSeries(LineSeries, {
    color: '#FF6D00',
    lineWidth: 2,
    lastValueVisible: false,
    priceLineVisible: false,
    crosshairMarkerVisible: false,
  }, 1);

  const data = await loadCsvData();
  candleSeries.setData(data);

  const { macdLine, signalLine, histogram } = calculateMACD(data, 12, 26, 9);
  histogramSeries.setData(histogram);
  macdLineSeries.setData(macdLine);
  signalLineSeries.setData(signalLine);

  const barsToShow = 24 * 10;
  chart.timeScale().setVisibleLogicalRange({
    from: data.length - barsToShow,
    to: data.length,
  });
}
