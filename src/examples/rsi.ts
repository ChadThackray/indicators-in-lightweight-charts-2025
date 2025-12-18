import { createChart, CandlestickSeries, LineSeries } from 'lightweight-charts';
import { loadCsvData } from '../data';
import { calculateRSI } from '../indicators/rsi';

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

  // Add RSI in a separate pane (paneIndex: 1)
  const rsiSeries = chart.addSeries(LineSeries, {
    color: '#E91E63',
    lineWidth: 2,
    lastValueVisible: false,
    priceLineVisible: false,
    crosshairMarkerVisible: false,
  }, 1);

  const data = await loadCsvData();
  candleSeries.setData(data);

  const rsiData = calculateRSI(data, 14);
  rsiSeries.setData(rsiData);

  const barsToShow = 24 * 10;
  chart.timeScale().setVisibleLogicalRange({
    from: data.length - barsToShow,
    to: data.length,
  });

}
