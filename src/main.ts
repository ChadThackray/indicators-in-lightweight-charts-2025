import { render as renderSMA } from './examples/sma';
import { render as renderRSI } from './examples/rsi';
import { render as renderZigZag } from './examples/zigzag';
import { render as renderSupertrend } from './examples/supertrend';

type RenderFn = (container: HTMLElement) => Promise<void>;

const examples: Record<string, RenderFn> = {
  'SMA': renderSMA,
  'RSI': renderRSI,
  'ZigZag': renderZigZag,
  'Supertrend': renderSupertrend,
};

const tabsContainer = document.getElementById('tabs');
const chartContainer = document.getElementById('chart');

if (!tabsContainer || !chartContainer) {
  throw new Error('Required containers not found');
}

let activeTab = Object.keys(examples)[0];

function renderTabs() {
  tabsContainer!.innerHTML = '';
  for (const name of Object.keys(examples)) {
    const button = document.createElement('button');
    button.className = `tab${name === activeTab ? ' active' : ''}`;
    button.textContent = name;
    button.onclick = () => switchTab(name);
    tabsContainer!.appendChild(button);
  }
}

async function switchTab(name: string) {
  activeTab = name;
  renderTabs();
  chartContainer!.innerHTML = '';
  await examples[name](chartContainer!);
}

renderTabs();
switchTab(activeTab);
