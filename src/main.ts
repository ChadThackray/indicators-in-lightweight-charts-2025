import { render as renderSMA } from './examples/sma';
import { render as renderRSI } from './examples/rsi';
import { render as renderZigZag } from './examples/zigzag';
import { render as renderSupertrend } from './examples/supertrend';
import { render as renderMACD } from './examples/macd';
import { render as renderSMARealtime } from './examples/sma-realtime';
import { render as renderZigZagRealtime } from './examples/zigzag-realtime';

type CleanupFn = () => void;
type RenderFn = (container: HTMLElement) => Promise<void | CleanupFn>;

const examples: Record<string, RenderFn> = {
  'SMA': renderSMA,
  'RSI': renderRSI,
  'ZigZag': renderZigZag,
  'Supertrend': renderSupertrend,
  'MACD': renderMACD,
  'SMA (Real-time)': renderSMARealtime,
  'ZigZag (Real-time)': renderZigZagRealtime,
};

const tabsContainer = document.getElementById('tabs');
const chartContainer = document.getElementById('chart');

if (!tabsContainer) throw new Error('Tabs container not found');
const tabsContainerValidated = tabsContainer

if (!chartContainer) throw new Error('Tabs container not found');
const chartContainerValidated = chartContainer

let activeTab = Object.keys(examples)[0];
let currentCleanup: CleanupFn | null = null;

function renderTabs() {
  tabsContainerValidated.innerHTML = '';
  for (const name of Object.keys(examples)) {
    const button = document.createElement('button');
    button.className = `tab${name === activeTab ? ' active' : ''}`;
    button.textContent = name;
    button.onclick = () => switchTab(name);
    tabsContainerValidated.appendChild(button);
  }
}

async function switchTab(name: string) {
  // Cleanup previous example (important for WebSocket connections)
  if (currentCleanup) {
    currentCleanup();
    currentCleanup = null;
  }

  activeTab = name;
  renderTabs();
  chartContainerValidated.innerHTML = '';

  const result = await examples[name](chartContainerValidated);
  if (typeof result === 'function') {
    currentCleanup = result;
  }
}

renderTabs();
switchTab(activeTab);
