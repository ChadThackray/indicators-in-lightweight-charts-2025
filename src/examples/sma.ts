import { createChart, CandlestickSeries, LineSeries } from 'lightweight-charts';
import { loadCsvData } from '../data';
import { calculateSMA } from '../indicators/sma';

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

  const smaSeries = chart.addSeries(LineSeries, {
    color: '#F7931A',
    lineWidth: 2,
    lastValueVisible: false,
    priceLineVisible: false,
    crosshairMarkerVisible: false,
  });

  const data = await loadCsvData();
  candleSeries.setData(data);

  const smaData = calculateSMA(data, 20);
  smaSeries.setData(smaData);

  const barsToShow = 24 * 10;
  chart.timeScale().setVisibleLogicalRange({
    from: data.length - barsToShow,
    to: data.length,
  });

}
