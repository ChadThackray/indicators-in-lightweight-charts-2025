import { createChart, CandlestickSeries, LineSeries, LineData, UTCTimestamp } from 'lightweight-charts';
import { loadCsvData } from '../data';
import { calculateSupertrend, SupertrendPoint } from '../indicators/supertrend';

// Split data into contiguous segments by trend
function segmentByTrend(data: SupertrendPoint[]): { uptrend: LineData<UTCTimestamp>[][]; downtrend: LineData<UTCTimestamp>[][] } {
  const uptrend: LineData<UTCTimestamp>[][] = [];
  const downtrend: LineData<UTCTimestamp>[][] = [];

  let currentSegment: LineData<UTCTimestamp>[] = [];
  let currentIsUptrend: boolean | null = null;

  for (const point of data) {
    if (currentIsUptrend !== point.isUptrend) {
      if (currentSegment.length > 0) {
        if (currentIsUptrend) {
          uptrend.push(currentSegment);
        } else {
          downtrend.push(currentSegment);
        }
      }
      currentSegment = [];
      currentIsUptrend = point.isUptrend;
    }
    currentSegment.push({ time: point.time, value: point.value });
  }

  // Push final segment
  if (currentSegment.length > 0) {
    if (currentIsUptrend) {
      uptrend.push(currentSegment);
    } else {
      downtrend.push(currentSegment);
    }
  }

  return { uptrend, downtrend };
}

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

  const data = await loadCsvData();
  candleSeries.setData(data);

  const supertrendData = calculateSupertrend(data, 10, 3);
  const segments = segmentByTrend(supertrendData);

  // Create a line series for each segment
  for (const segment of segments.uptrend) {
    const series = chart.addSeries(LineSeries, {
      color: '#26a69a',
      lineWidth: 2,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });
    series.setData(segment);
  }

  for (const segment of segments.downtrend) {
    const series = chart.addSeries(LineSeries, {
      color: '#ef5350',
      lineWidth: 2,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });
    series.setData(segment);
  }

  const barsToShow = 24 * 10;
  chart.timeScale().setVisibleLogicalRange({
    from: data.length - barsToShow,
    to: data.length,
  });

}
