// injected.js - WORBIT SNIPER V11.0 - LECTURA DIRECTA DEL GRÁFICO
// Características: Lectura de velas del gráfico, TradingView integration, Múltiples fuentes de datos
(function() {
'use strict';
console.log('%c WORBIT SNIPER V11.0 LOADING...', 'background: #00e676; color: #000; font-size: 14px; padding: 5px;');

// ============= CONSTANTES =============
const VERSION = '11.0';
const TARGET_CANDLES = 3;
const MAX_CANDLES = 200;
const MAX_LOGS = 20;
const HEALTH_CHECK_INTERVAL = 3000;
const DATA_TIMEOUT = 8000;
const RECONNECT_DELAY = 5000;
const CHART_SYNC_INTERVAL = 1000; // Sincronizar con gráfico cada segundo

// ============= ESTADO GLOBAL =============
let DOM = {};
let isSystemReady = false;
let isVisible = false;
let isRunning = false;

// Configuración (se carga desde storage)
let config = {
  autoTrade: false,
  useMartingale: false,
  invertTrade: false,
  useConfirmation: false,
  operateOnNext: false,
  riskPct: 1,
  mgMaxSteps: 3,
  mgFactor: 2.0,
  entrySec: 59,
  timeOffset: 0,
  useChartData: true, // NUEVO: Usar datos del gráfico cuando estén disponibles
  stopConfig: {
    useTime: false,
    timeMin: 0,
    useRisk: false,
    profitPct: 0,
    stopLossPct: 0,
    useTrades: false,
    maxWins: 0,
    maxLosses: 0
  }
};

// Estado de trading
let balance = 0;
let isDemo = true;
let currentAmt = 0;
let mgLevel = 0;
let candles = [];
let chartCandles = []; // NUEVO: Velas obtenidas directamente del gráfico
let currentCandle = null;
let currentPair = '';
let pendingTrades = [];
let processed = 0;
let tradeExecutedThisCandle = false;
let lastTradeType = null;
let activeMartingaleTrade = null;
let pendingSignal = null;
let stats = { w: 0, l: 0 };
let sessionStats = { w: 0, l: 0 };
let startTime = 0;
let initialBalance = 0;
let lastTickTime = 0;
let wsConnected = false;
let lastWsData = null;

// NUEVO: Estado del acceso al gráfico
let chartAccessMethod = 'none'; // 'tradingview', 'zustand', 'api', 'websocket'
let tvWidgetRef = null;
let chartSyncInterval = null;
let lastChartSync = 0;

// Intervalos
let tickerInterval = null;
let sessionInterval = null;
let healthCheckInterval = null;

// ============= NUEVO: ACCESO AL GRÁFICO =============

/**
 * Intenta obtener referencia al widget de TradingView
 * El widget está disponible en window.tvWidget cuando el gráfico está cargado
 */
function getTradingViewWidget() {
  try {
    // Método 1: Acceso directo al widget global
    if (window.tvWidget && typeof window.tvWidget.activeChart === 'function') {
      return window.tvWidget;
    }
    
    // Método 2: Buscar en el iframe del gráfico
    const chartContainer = document.querySelector('#chartContainer');
    if (chartContainer) {
      const iframe = chartContainer.querySelector('iframe');
      if (iframe && iframe.contentWindow) {
        try {
          if (iframe.contentWindow.tvWidget) {
            return iframe.contentWindow.tvWidget;
          }
        } catch (e) {
          // Restricción cross-origin, intentar otro método
        }
      }
    }
    
    // Método 3: Buscar TVWidget en cualquier iframe
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      try {
        if (iframe.contentWindow && iframe.contentWindow.tvWidget) {
          return iframe.contentWindow.tvWidget;
        }
      } catch (e) {
        // Continuar con el siguiente iframe
      }
    }
  } catch (e) {
    console.log('[SNIPER] TradingView widget no accesible:', e.message);
  }
  return null;
}

/**
 * Obtiene las velas del gráfico de TradingView
 * Retorna un array de velas en formato {s, o, h, l, c, v}
 */
function getCandlesFromTradingView() {
  try {
    const widget = getTradingViewWidget();
    if (!widget) return null;
    
    const chart = widget.activeChart();
    if (!chart) return null;
    
    // Intentar obtener datos del gráfico
    // TradingView expone los datos a través de diferentes métodos
    
    // Método 1: exportData (si está disponible)
    if (typeof chart.exportData === 'function') {
      return new Promise((resolve) => {
        chart.exportData({
          from: Date.now() - (MAX_CANDLES * 60 * 1000),
          to: Date.now()
        }).then(data => {
          if (data && data.data && Array.isArray(data.data)) {
            const candles = data.data.map(bar => ({
              s: bar.time * 1000, // TradingView usa segundos, convertir a ms
              o: bar.open,
              h: bar.high,
              l: bar.low,
              c: bar.close,
              v: bar.volume || 0
            }));
            resolve(candles);
          } else {
            resolve(null);
          }
        }).catch(() => resolve(null));
      });
    }
    
    // Método 2: Obtener series visibles
    if (typeof chart.getAllStudies === 'function') {
      // Las series principales contienen los datos OHLC
      const series = chart.getAllStudies();
      // Procesar series...
    }
    
    return null;
  } catch (e) {
    console.log('[SNIPER] Error obteniendo velas de TradingView:', e.message);
    return null;
  }
}

/**
 * Obtiene velas desde el store de Zustand (chart-storage)
 */
function getCandlesFromZustand() {
  try {
    // Los stores de Zustand persisten en localStorage
    const chartStore = localStorage.getItem('chart-storage');
    if (chartStore) {
      const parsed = JSON.parse(chartStore);
      // El store puede tener datos de velas en caché
      if (parsed.state && parsed.state.candles) {
        return parsed.state.candles;
      }
    }
  } catch (e) {
    // No hay datos en el store
  }
  return null;
}

/**
 * Sincroniza las velas del bot con las del gráfico
 * Prioriza fuentes: TradingView > Zustand > API > WebSocket
 */
async function syncWithChart() {
  if (!isRunning || !config.useChartData) return;
  
  const now = Date.now();
  if (now - lastChartSync < CHART_SYNC_INTERVAL) return;
  lastChartSync = now;
  
  // Intentar obtener velas de diferentes fuentes
  let newCandles = null;
  let method = 'none';
  
  // 1. Intentar TradingView Widget
  const tvCandles = await getCandlesFromTradingView();
  if (tvCandles && tvCandles.length > 0) {
    newCandles = tvCandles;
    method = 'tradingview';
  }
  
  // 2. Intentar Zustand Store
  if (!newCandles) {
    const zustandCandles = getCandlesFromZustand();
    if (zustandCandles && zustandCandles.length > 0) {
      newCandles = zustandCandles;
      method = 'zustand';
    }
  }
  
  // 3. Si no hay acceso directo, usar datos del WebSocket
  if (!newCandles && candles.length > 0) {
    method = 'websocket';
  }
  
  // Actualizar método de acceso si cambió
  if (method !== chartAccessMethod) {
    chartAccessMethod = method;
    if (method !== 'websocket' && method !== 'none') {
      logMonitor(`Fuente de datos: ${method.toUpperCase()}`, 'success');
    }
  }
  
  // Si obtuvimos velas del gráfico, actualizar chartCandles
  if (newCandles && newCandles.length > 0) {
    chartCandles = newCandles.slice(-MAX_CANDLES);
  }
}

/**
 * Obtiene las velas más confiables para análisis
 * Compara velas del gráfico con las construidas desde WebSocket
 */
function getAnalysisCandles() {
  // Si tenemos velas del gráfico y están actualizadas, usarlas
  if (config.useChartData && chartCandles.length > 0) {
    const chartLastTime = chartCandles[chartCandles.length - 1]?.s || 0;
    const wsLastTime = candles[candles.length - 1]?.s || 0;
    
    // Si las velas del gráfico son recientes (menos de 2 minutos de diferencia), usarlas
    if (Math.abs(chartLastTime - wsLastTime) < 120000) {
      return chartCandles;
    }
  }
  
  // Por defecto, usar las velas construidas desde WebSocket
  return candles;
}

/**
 * Valida que una vela esté completamente cerrada
 */
function isCandleClosed(candle, currentTime) {
  if (!candle || !candle.s) return false;
  const candleEndTime = candle.s + 60000; // Vela de 1 minuto
  return currentTime >= candleEndTime;
}

// ============= WORBIT STORE ACCESS =============
function getWorbitCredentials() {
  let credentials = null;
  
  // Método 1: Buscar en localStorage (setting-store de Zustand)
  try {
    const settingStore = localStorage.getItem('setting-store');
    if (settingStore) {
      const parsed = JSON.parse(settingStore);
      if (parsed.state && parsed.state.otcApiUrl && parsed.state.otcApiKey) {
        credentials = {
          otcApiUrl: parsed.state.otcApiUrl,
          otcApiKey: parsed.state.otcApiKey,
          otcWsUrl: parsed.state.otcWsUrl
        };
      }
    }
  } catch (e) {}
  
  // Método 2: Buscar en el iframe del gráfico (parámetros de URL)
  if (!credentials || !credentials.otcApiUrl) {
    try {
      const chartFrame = document.querySelector('iframe[src*="chart"]') || 
                         document.querySelector('iframe[src*="symbolApiUrl"]');
      if (chartFrame && chartFrame.src) {
        const url = new URL(chartFrame.src);
        const apiUrl = url.searchParams.get('symbolApiUrl');
        const apiKey = url.searchParams.get('symbolApiKey');
        const wsUrl = url.searchParams.get('symbolWsUrl');
        
        if (apiUrl && apiKey) {
          credentials = {
            otcApiUrl: apiUrl,
            otcApiKey: apiKey,
            otcWsUrl: wsUrl
          };
        }
      }
    } catch (e) {}
  }
  
  // Método 3: Buscar iframes y extraer de su contenido
  if (!credentials || !credentials.otcApiUrl) {
    try {
      const iframes = document.querySelectorAll('iframe');
      for (const iframe of iframes) {
        if (iframe.src && iframe.src.includes('symbolApiUrl')) {
          const url = new URL(iframe.src);
          const apiUrl = url.searchParams.get('symbolApiUrl');
          const apiKey = url.searchParams.get('symbolApiKey');
          const wsUrl = url.searchParams.get('symbolWsUrl');
          
          if (apiUrl && apiKey) {
            credentials = {
              otcApiUrl: apiUrl,
              otcApiKey: apiKey,
              otcWsUrl: wsUrl
            };
            break;
          }
        }
      }
    } catch (e) {}
  }
  
  // Método 4: Buscar en window.__NUXT__ o variables globales comunes
  if (!credentials || !credentials.otcApiUrl) {
    try {
      if (window.__CONFIG__ && window.__CONFIG__.otcApiUrl) {
        credentials = {
          otcApiUrl: window.__CONFIG__.otcApiUrl,
          otcApiKey: window.__CONFIG__.otcApiKey,
          otcWsUrl: window.__CONFIG__.otcWsUrl
        };
      }
    } catch (e) {}
  }
  
  return credentials;
}

function getSelectedSymbol() {
  try {
    const symbolStore = localStorage.getItem('symbol-store');
    if (symbolStore) {
      const parsed = JSON.parse(symbolStore);
      if (parsed.state && parsed.state.symbolSelected) {
        return parsed.state.symbolSelected;
      }
    }
  } catch (e) {}
  return null;
}

// ============= WEBSOCKET INTERCEPTOR MEJORADO =============
let originalWebSocket = null;
let wsReconnectTimeout = null;

function setupWebSocketInterceptor() {
  if (originalWebSocket) return;
  
  originalWebSocket = window.WebSocket;
  
  window.WebSocket = function(url, protocols) {
    const ws = new originalWebSocket(url, protocols);
    
    ws.addEventListener('open', () => {
      if (url.includes('symbol-prices')) {
        wsConnected = true;
        lastTickTime = Date.now();
        logMonitor('WebSocket conectado', 'success');
        updateConnectionUI(true);
      }
    });
    
    ws.addEventListener('close', (event) => {
      if (url.includes('symbol-prices')) {
        wsConnected = false;
        logMonitor(`WebSocket cerrado (${event.code})`, 'blocked');
        updateConnectionUI(false);
        scheduleReconnect();
      }
    });
    
    ws.addEventListener('error', () => {
      if (url.includes('symbol-prices')) {
        logMonitor('Error WebSocket', 'blocked');
        updateConnectionUI(false);
      }
    });
    
    ws.addEventListener('message', (event) => {
      processWebSocketMessage(event.data);
    });
    
    return ws;
  };
  
  window.WebSocket.prototype = originalWebSocket.prototype;
  Object.keys(originalWebSocket).forEach(key => {
    if (key !== 'prototype') {
      try { window.WebSocket[key] = originalWebSocket[key]; } catch(e) {}
    }
  });
}

function processWebSocketMessage(data) {
  if (typeof data !== 'string' || !data.includes('symbol.price.update')) return;
  
  try {
    const startIdx = data.indexOf('[');
    if (startIdx === -1) return;
    
    const json = JSON.parse(data.substring(startIdx));
    if (!Array.isArray(json) || json.length < 2) return;
    
    const payload = json[1];
    if (!payload || payload.event !== 'symbol.price.update') return;
    
    const priceData = payload.data;
    if (!priceData || !priceData.closePrice) return;
    
    wsConnected = true;
    lastTickTime = Date.now();
    
    lastWsData = {
      closePrice: parseFloat(priceData.closePrice),
      openPrice: parseFloat(priceData.openPrice || priceData.closePrice),
      highPrice: parseFloat(priceData.highPrice || priceData.closePrice),
      lowPrice: parseFloat(priceData.lowPrice || priceData.closePrice),
      time: priceData.time || Date.now(),
      pair: priceData.pair,
      volume: parseFloat(priceData.volume || 0)
    };
    
    if (isSystemReady && isRunning) {
      onTick(lastWsData);
    }
    
    window.postMessage({ type: 'SNIPER_WS_DATA', data: lastWsData }, '*');
  } catch (e) {}
}

function scheduleReconnect() {
  if (wsReconnectTimeout) return;
  if (!isRunning) return;
  
  wsReconnectTimeout = setTimeout(() => {
    wsReconnectTimeout = null;
    if (wsConnected) return;
    
    logMonitor('Intentando reconexión...', 'info');
    const chartFrame = document.querySelector('iframe[src*="chart"]');
    if (chartFrame) {
      try {
        chartFrame.contentWindow.location.reload();
      } catch(e) {}
    }
  }, RECONNECT_DELAY);
}

function updateConnectionUI(connected) {
  if (DOM.dot) {
    DOM.dot.style.background = connected ? '#00e676' : '#e74c3c';
    DOM.dot.style.boxShadow = connected ? '0 0 8px #00e676' : '0 0 8px #e74c3c';
  }
}

// ============= CARGA DE DATOS HISTÓRICOS =============
async function loadHistoricalData(pair) {
  const credentials = getWorbitCredentials();
  
  if (!credentials?.otcApiUrl || !credentials?.otcApiKey) {
    logMonitor('Sin API histórica - modo live', 'info');
    return [];
  }
  
  const symbol = getSelectedSymbol();
  const slot = symbol?.slot || 'mybroker-11';
  const type = symbol?.type || 'otc';
  const ticker = pair || symbol?.ticker;
  
  if (!ticker) {
    logMonitor('Sin símbolo para histórico', 'info');
    return [];
  }
  
  const endTime = Date.now();
  const startTimeMs = endTime - (2 * 60 * 60 * 1000);
  
  try {
    logMonitor('Cargando histórico...', 'info');
    
    const url = `${credentials.otcApiUrl}/aggregated-prices/prices`;
    const params = new URLSearchParams({
      slot, pair: ticker, startTime: startTimeMs.toString(),
      endTime: endTime.toString(), type, interval: '1m', limit: '200'
    });
    
    const response = await fetch(`${url}?${params}`, {
      headers: { 'api-key': credentials.otcApiKey }
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    
    if (Array.isArray(data) && data.length > 0) {
      const loadedCandles = data.map(d => ({
        s: parseInt(d.time),
        o: parseFloat(d.openPrice),
        h: parseFloat(d.highPrice),
        l: parseFloat(d.lowPrice),
        c: parseFloat(d.closePrice),
        v: parseFloat(d.volume || 0)
      })).sort((a, b) => a.s - b.s);
      
      logMonitor(`${loadedCandles.length} velas cargadas`, 'success');
      chartAccessMethod = 'api';
      return loadedCandles;
    }
    return [];
  } catch (e) {
    logMonitor(`Histórico no disponible`, 'info');
    return [];
  }
}

// ============= PERSISTENCIA DE CONFIGURACIÓN =============
function saveConfigToStorage() {
  const configToSave = {
    autoTrade: config.autoTrade,
    useMartingale: config.useMartingale,
    invertTrade: config.invertTrade,
    useConfirmation: config.useConfirmation,
    operateOnNext: config.operateOnNext,
    riskPct: config.riskPct,
    mgMaxSteps: config.mgMaxSteps,
    mgFactor: config.mgFactor,
    entrySec: config.entrySec,
    timeOffset: config.timeOffset,
    useChartData: config.useChartData,
    stopConfig: config.stopConfig
  };
  window.postMessage({ type: 'SNIPER_SAVE_CONFIG', data: configToSave }, '*');
}

function loadConfigFromStorage() {
  window.postMessage({ type: 'SNIPER_LOAD_CONFIG' }, '*');
}

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  
  if (event.data.type === 'SNIPER_CONFIG_LOADED' && event.data.config) {
    const c = event.data.config;
    config = { ...config, ...c };
    applyConfigToUI();
    logMonitor('Configuración restaurada', 'info');
  }
});

function applyConfigToUI() {
  if (!DOM.swAuto) return;
  
  DOM.swAuto.classList.toggle('active', config.autoTrade);
  DOM.swMg.classList.toggle('active', config.useMartingale);
  DOM.swInv.classList.toggle('active', config.invertTrade);
  if (DOM.swChart) DOM.swChart.classList.toggle('active', config.useChartData);
  if (DOM.riskPct) DOM.riskPct.value = config.riskPct;
  if (DOM.mgSteps) DOM.mgSteps.value = config.mgMaxSteps;
  if (DOM.mgFactor) DOM.mgFactor.value = config.mgFactor;
  if (DOM.entrySec) DOM.entrySec.value = config.entrySec;
  if (DOM.timerDelay) DOM.timerDelay.value = config.timeOffset;
  if (DOM.chkConfirm) DOM.chkConfirm.checked = config.useConfirmation;
  if (DOM.chkNext) DOM.chkNext.checked = config.operateOnNext;
  if (DOM.mgBox) DOM.mgBox.style.display = config.useMartingale ? 'block' : 'none';
  
  // Stop Config
  if (config.stopConfig) {
    if (DOM.chkTime) DOM.chkTime.checked = config.stopConfig.useTime;
    if (DOM.chkRisk) DOM.chkRisk.checked = config.stopConfig.useRisk;
    if (DOM.chkTrades) DOM.chkTrades.checked = config.stopConfig.useTrades;
    if (DOM.sessionTime) DOM.sessionTime.value = config.stopConfig.timeMin;
    if (DOM.profitTarget) DOM.profitTarget.value = config.stopConfig.profitPct;
    if (DOM.stopLoss) DOM.stopLoss.value = config.stopConfig.stopLossPct;
    if (DOM.maxWins) DOM.maxWins.value = config.stopConfig.maxWins;
    if (DOM.maxLosses) DOM.maxLosses.value = config.stopConfig.maxLosses;
    
    if (DOM.grpTime) DOM.grpTime.classList.toggle('disabled-group', !config.stopConfig.useTime);
    if (DOM.grpRisk) DOM.grpRisk.classList.toggle('disabled-group', !config.stopConfig.useRisk);
    if (DOM.grpTrades) DOM.grpTrades.classList.toggle('disabled-group', !config.stopConfig.useTrades);
  }
}

// ============= FUNCIONES DE PRICE ACTION =============
const getBody = c => Math.abs(c.c - c.o);
const getUpperWick = c => c.h - Math.max(c.o, c.c);
const getLowerWick = c => Math.min(c.o, c.c) - c.l;
const isGreen = c => c.c > c.o;
const isRed = c => c.c < c.o;
const getAvgBody = (arr, count = 10) => {
  if (arr.length < count) return 0;
  return arr.slice(-count).reduce((a, c) => a + getBody(c), 0) / count;
};

function getLevels(arr, index) {
  const supports = [], resistances = [];
  const lookback = Math.min(index, 50);
  const start = Math.max(0, index - lookback);
  
  for (let i = start + 2; i < index - 2; i++) {
    const c = arr[i];
    if (c.h > arr[i-1].h && c.h > arr[i-2].h && c.h > arr[i+1].h && c.h > arr[i+2].h) {
      resistances.push(c.h);
    }
    if (c.l < arr[i-1].l && c.l < arr[i-2].l && c.l < arr[i+1].l && c.l < arr[i+2].l) {
      supports.push(c.l);
    }
  }
  return { supports, resistances };
}

function isNearLevel(price, levels, threshold = 0.0002) {
  return levels.some(lvl => Math.abs(price - lvl) < (price * threshold));
}

function isPinBar(c, type) {
  const body = getBody(c);
  const upper = getUpperWick(c);
  const lower = getLowerWick(c);
  if (type === 'bullish') return lower > (body * 2) && upper < body;
  if (type === 'bearish') return upper > (body * 2) && lower < body;
  return false;
}

function isEngulfing(curr, prev, type) {
  if (type === 'bullish') return isRed(prev) && isGreen(curr) && curr.c > prev.o && curr.o < prev.c;
  if (type === 'bearish') return isGreen(prev) && isRed(curr) && curr.c < prev.o && curr.o > prev.c;
  return false;
}

function isExhaustion(c, type) {
  const body = getBody(c);
  const upper = getUpperWick(c);
  const lower = getLowerWick(c);
  if (type === 'bullish') return lower > (body * 3);
  if (type === 'bearish') return upper > (body * 3);
  return false;
}

function isStrongMomentum(arr, type) {
  if (arr.length < 5) return false;
  const last = arr[arr.length - 1];
  const prev = arr[arr.length - 2];
  const prev2 = arr[arr.length - 3];
  const avgBody = getAvgBody(arr);
  
  if (type === 'bearish') {
    return isRed(last) && isRed(prev) && isRed(prev2) && getBody(last) > avgBody;
  }
  if (type === 'bullish') {
    return isGreen(last) && isGreen(prev) && isGreen(prev2) && getBody(last) > avgBody;
  }
  return false;
}

// ============= DETECCIÓN DE SEÑALES (MEJORADA) =============
function detectSignal(liveCandle) {
  // MEJORADO: Usar velas del gráfico si están disponibles
  const baseCandles = getAnalysisCandles();
  const analysisCandles = [...baseCandles];
  
  // Solo añadir la vela live si estamos analizando en tiempo real
  if (liveCandle && !config.operateOnNext) {
    analysisCandles.push(liveCandle);
  }
  
  if (analysisCandles.length < 3) return null;
  
  const i = analysisCandles.length - 1;
  const now = analysisCandles[i];
  const prev = analysisCandles[i - 1];
  const prev2 = analysisCandles[i - 2];
  
  // MEJORADO: Validar que las velas de análisis estén cerradas (excepto la actual)
  const currentTime = Date.now();
  if (!isCandleClosed(prev, currentTime) || !isCandleClosed(prev2, currentTime)) {
    // Las velas previas no están cerradas, esperar
    return null;
  }
  
  const { supports, resistances } = getLevels(analysisCandles, i);
  const nearSupport = isNearLevel(now.l, supports);
  const nearResistance = isNearLevel(now.h, resistances);
  
  let signal = null;
  let strategy = '';
  
  // S1: Rechazo en niveles
  if (nearSupport) {
    if (isPinBar(now, 'bullish')) { signal = 'call'; strategy = 'Rechazo Soporte (PinBar)'; }
    else if (isEngulfing(now, prev, 'bullish')) { signal = 'call'; strategy = 'Rechazo Soporte (Engulfing)'; }
  } else if (nearResistance) {
    if (isPinBar(now, 'bearish')) { signal = 'put'; strategy = 'Rechazo Resistencia (PinBar)'; }
    else if (isEngulfing(now, prev, 'bearish')) { signal = 'put'; strategy = 'Rechazo Resistencia (Engulfing)'; }
  }
  
  // S2: Falsa ruptura
  if (!signal) {
    if (supports.some(s => now.l < s && now.c > s && isRed(prev))) {
      signal = 'call'; strategy = 'Falsa Ruptura Soporte';
    } else if (resistances.some(r => now.h > r && now.c < r && isGreen(prev))) {
      signal = 'put'; strategy = 'Falsa Ruptura Resistencia';
    }
  }
  
  // S3: Breakout
  if (!signal) {
    const avgBody = getAvgBody(baseCandles);
    const isSmallPrev = getBody(prev) < avgBody * 0.5;
    const isSmallPrev2 = getBody(prev2) < avgBody * 0.5;
    if (isSmallPrev && isSmallPrev2) {
      const isBigNow = getBody(now) > avgBody * 1.5;
      if (isBigNow && isGreen(now) && getUpperWick(now) < getBody(now) * 0.2) {
        signal = 'call'; strategy = 'Breakout Alcista';
      } else if (isBigNow && isRed(now) && getLowerWick(now) < getBody(now) * 0.2) {
        signal = 'put'; strategy = 'Breakout Bajista';
      }
    }
  }
  
  // S4: Agotamiento
  if (!signal) {
    const runDown = isRed(prev) && isRed(prev2);
    const runUp = isGreen(prev) && isGreen(prev2);
    if (runDown && isExhaustion(now, 'bullish')) {
      signal = 'call'; strategy = 'Agotamiento Bajista';
    } else if (runUp && isExhaustion(now, 'bearish')) {
      signal = 'put'; strategy = 'Agotamiento Alcista';
    }
  }
  
  if (signal) {
    let displayType = signal;
    let note = '';
    if (config.invertTrade) {
      displayType = signal === 'call' ? 'put' : 'call';
      note = ' (INV)';
    }
    // MEJORADO: Mostrar fuente de datos en el log
    const sourceTag = chartAccessMethod !== 'websocket' ? ` [${chartAccessMethod}]` : '';
    logMonitor(`🚀 ${strategy} → ${displayType.toUpperCase()}${note}${sourceTag}`, 'pattern');
    return { d: signal };
  }
  return null;
}

// ============= PROCESAMIENTO DE TICKS =============
function onTick(data) {
  if (!isRunning) return;
  
  updateConnectionUI(true);
  
  // MEJORADO: Intentar sincronizar con el gráfico periódicamente
  syncWithChart();
  
  if (DOM.uiPrice) {
    DOM.uiPrice.textContent = data.closePrice.toFixed(2);
    DOM.uiPrice.className = currentCandle && data.closePrice > currentCandle.o ? 'live-price price-up' : 'live-price price-down';
  }
  if (DOM.uiActive) DOM.uiActive.textContent = data.pair;
  
  // MEJORADO: Mostrar fuente de datos actual
  if (DOM.uiSource) {
    DOM.uiSource.textContent = chartAccessMethod.toUpperCase();
    DOM.uiSource.style.color = chartAccessMethod === 'tradingview' || chartAccessMethod === 'api' ? '#00e676' : '#f1c40f';
  }
  
  // Cambio de activo
  if (currentPair !== data.pair) {
    currentPair = data.pair;
    candles = [];
    chartCandles = [];
    currentCandle = null;
    pendingTrades = [];
    processed = 0;
    chartAccessMethod = 'none';
    if (DOM.uiCnt) DOM.uiCnt.textContent = `0/${TARGET_CANDLES}`;
    logMonitor(`Activo: ${currentPair}`, 'info');
    
    // Cargar histórico para el nuevo activo
    loadHistoricalData(currentPair).then(hist => {
      if (hist.length > 0) {
        candles = hist;
        chartCandles = hist.slice(); // Copiar también a chartCandles
        processed = hist.length;
        if (DOM.uiCnt) DOM.uiCnt.textContent = `${Math.min(processed, TARGET_CANDLES)}/${TARGET_CANDLES}`;
      }
    });
  }
  
  const timestamp = data.time;
  const candleTime = Math.floor(timestamp / 60000) * 60000;
  
  if (!currentCandle) {
    currentCandle = {
      s: candleTime, o: data.closePrice, h: data.closePrice,
      l: data.closePrice, c: data.closePrice, v: data.volume
    };
  } else if (timestamp >= currentCandle.s + 60000) {
    // Cerrar vela
    candles.push({ ...currentCandle });
    if (candles.length > MAX_CANDLES) candles.shift();
    
    processed++;
    if (DOM.uiCnt) DOM.uiCnt.textContent = `${Math.min(processed, TARGET_CANDLES)}/${TARGET_CANDLES}`;
    
    checkTradeResults(currentCandle);
    
    if (config.operateOnNext) {
      pendingSignal = detectSignal();
    } else {
      pendingSignal = null;
    }
    
    tradeExecutedThisCandle = false;
    lastTradeType = null;
    
    currentCandle = {
      s: candleTime, o: data.closePrice, h: data.closePrice,
      l: data.closePrice, c: data.closePrice, v: data.volume
    };
    
    // Martingala
    if (activeMartingaleTrade && config.useMartingale) {
      logMonitor(`Martingala Nivel ${mgLevel}`, 'info');
      if (config.autoTrade) executeTrade(activeMartingaleTrade.type);
      pendingTrades.push({ k: currentCandle.s, type: activeMartingaleTrade.type });
      tradeExecutedThisCandle = true;
      lastTradeType = activeMartingaleTrade.type;
      activeMartingaleTrade = null;
    }
  } else {
    currentCandle.c = data.closePrice;
    currentCandle.h = Math.max(currentCandle.h, data.closePrice);
    currentCandle.l = Math.min(currentCandle.l, data.closePrice);
    currentCandle.v = data.volume;
    
    if (!config.operateOnNext) {
      const signal = detectSignal(currentCandle);
      pendingSignal = signal || null;
    }
  }
  
  const now = Date.now() + config.timeOffset;
  const sec = Math.ceil((60000 - (now % 60000)) / 1000);
  updateSignalUI(sec, currentCandle.s);
}

// ============= UI DE SEÑALES =============
function updateSignalUI(sec, key) {
  if (!DOM.signalBox) return;
  
  if (tradeExecutedThisCandle) {
    DOM.signalBox.className = lastTradeType === 'call' ? 'sig-possible-call' : 'sig-possible-put';
    DOM.signalBox.innerHTML = `
      <div style="font-size:14px;font-weight:700">${lastTradeType === 'call' ? '▲ COMPRA' : '▼ VENTA'}</div>
      <div style="font-size:10px;margin-top:4px">ESPERANDO RESULTADO...</div>`;
    return;
  }
  
  if (pendingSignal) {
    let type = pendingSignal.d;
    if (config.invertTrade) type = type === 'call' ? 'put' : 'call';
    
    const triggerSec = 60 - config.entrySec;
    if (sec <= triggerSec && sec > (triggerSec - 5)) {
      DOM.signalBox.className = type === 'call' ? 'sig-entry-call' : 'sig-entry-put';
      DOM.signalBox.innerHTML = `
        <div style="font-size:16px;font-weight:800">${type === 'call' ? '▲ COMPRA' : '▼ VENTA'}</div>
        <div class="entry-countdown">¡ENTRAR AHORA!</div>`;
      
      if (!tradeExecutedThisCandle) {
        tradeExecutedThisCandle = true;
        lastTradeType = type;
        const tKey = key + 60000;
        if (!pendingTrades.some(t => t.k === tKey)) {
          pendingTrades.push({ k: tKey, type: type });
          if (config.autoTrade) executeTrade(type);
          else logMonitor(`Señal manual: ${type.toUpperCase()}`, 'success');
        }
      }
    } else {
      DOM.signalBox.className = 'sig-anticipation';
      DOM.signalBox.innerHTML = `
        <div class="anticipation-badge">PREPARAR ${type === 'call' ? '▲' : '▼'}</div>
        <div style="font-size:11px;margin-top:6px">Entrada en ${sec}s</div>`;
    }
  } else {
    DOM.signalBox.className = 'sig-waiting';
    DOM.signalBox.innerHTML = '<div style="font-size:11px;color:#888">ANALIZANDO MERCADO...</div>';
  }
}

// ============= EJECUCIÓN DE TRADES =============
function calcAmount() {
  let base = (balance * config.riskPct) / 100;
  let multiplier = 1;
  if (config.useMartingale && mgLevel > 0) {
    multiplier = Math.pow(config.mgFactor, mgLevel);
  }
  currentAmt = Math.max(1, base * multiplier);
}

function setTradeAmount(targetAmount) {
  try {
    const amountInput = document.querySelector('input[type="number"][class*="_input-operator_"]');
    if (amountInput) {
      const target = Math.round(targetAmount * 100) / 100;
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeInputValueSetter.call(amountInput, target.toFixed(2));
      amountInput.dispatchEvent(new Event('input', { bubbles: true }));
      amountInput.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  } catch (e) {}
  return false;
}

function executeTrade(type) {
  if (!config.autoTrade) return false;
  
  calcAmount();
  setTradeAmount(currentAmt);
  
  logMonitor(`Ejecutando ${type.toUpperCase()} - $${currentAmt.toFixed(2)}`, 'success');
  
  setTimeout(() => {
    try {
      let targetButton = null;
      if (type === 'call') targetButton = document.querySelector('.buy-button');
      else if (type === 'put') targetButton = document.querySelector('.sell-button');
      
      if (targetButton) {
        targetButton.click();
        logMonitor(`Click: ${type.toUpperCase()}`, 'success');
      } else {
        logMonitor(`Botón ${type} no encontrado`, 'blocked');
      }
    } catch (e) {
      logMonitor('Error en click', 'blocked');
    }
  }, 100 + Math.random() * 100);
  return true;
}

// ============= VERIFICACIÓN DE RESULTADOS =============
function checkTradeResults(candle) {
  const toRemove = [];
  pendingTrades.forEach((t, i) => {
    if (t.k === candle.s) {
      const winCall = t.type === 'call' && candle.c > candle.o;
      const winPut = t.type === 'put' && candle.c < candle.o;
      const isWin = winCall || winPut;
      const isDraw = candle.c === candle.o;
      
      if (isWin) {
        stats.w++;
        sessionStats.w++;
        mgLevel = 0;
        activeMartingaleTrade = null;
        logMonitor('✅ GANADA', 'success');
      } else if (!isDraw) {
        if (config.useMartingale) {
          const stopLossTrigger = (t.type === 'call' && isStrongMomentum(candles, 'bearish')) ||
                                  (t.type === 'put' && isStrongMomentum(candles, 'bullish'));
          if (stopLossTrigger) {
            stats.l++;
            sessionStats.l++;
            mgLevel = 0;
            activeMartingaleTrade = null;
            logMonitor('⛔ Momentum en contra - Stop', 'blocked');
          } else if (mgLevel < config.mgMaxSteps) {
            mgLevel++;
            activeMartingaleTrade = { type: t.type };
            logMonitor(`❌ PERDIDA - Martingala ${mgLevel}/${config.mgMaxSteps}`, 'blocked');
          } else {
            stats.l++;
            sessionStats.l++;
            mgLevel = 0;
            activeMartingaleTrade = null;
            logMonitor('⛔ Max Martingala - Stop', 'blocked');
          }
        } else {
          stats.l++;
          sessionStats.l++;
          logMonitor('❌ PERDIDA', 'blocked');
        }
      } else {
        logMonitor('↔️ EMPATE', 'info');
      }
      
      toRemove.push(i);
      updateStats();
      checkStopConditions();
    }
  });
  
  toRemove.reverse().forEach(i => pendingTrades.splice(i, 1));
}

function checkStopConditions() {
  const sc = config.stopConfig;
  
  if (sc.useTime && sc.timeMin > 0) {
    const elapsedMin = (Date.now() - startTime) / 60000;
    if (elapsedMin >= sc.timeMin) {
      logMonitor('⏱ Límite de tiempo alcanzado', 'blocked');
      stopBot();
      return;
    }
  }
  
  if (sc.useRisk && initialBalance > 0) {
    const profit = balance - initialBalance;
    const profitPct = (profit / initialBalance) * 100;
    
    if (sc.profitPct > 0 && profitPct >= sc.profitPct) {
      logMonitor(`💰 Take Profit: +${profitPct.toFixed(1)}%`, 'success');
      stopBot();
      return;
    }
    if (sc.stopLossPct > 0 && profitPct <= -sc.stopLossPct) {
      logMonitor(`⛔ Stop Loss: ${profitPct.toFixed(1)}%`, 'blocked');
      stopBot();
      return;
    }
  }
  
  if (sc.useTrades) {
    if (sc.maxWins > 0 && sessionStats.w >= sc.maxWins) {
      logMonitor(`🎯 Max wins alcanzado: ${sessionStats.w}`, 'success');
      stopBot();
      return;
    }
    if (sc.maxLosses > 0 && sessionStats.l >= sc.maxLosses) {
      logMonitor(`⛔ Max losses alcanzado: ${sessionStats.l}`, 'blocked');
      stopBot();
      return;
    }
  }
}

// ============= FUNCIONES AUXILIARES =============
function updateStats() {
  if (DOM.uiW) DOM.uiW.textContent = stats.w;
  if (DOM.uiL) DOM.uiL.textContent = stats.l;
  const total = stats.w + stats.l;
  const wr = total > 0 ? ((stats.w / total) * 100).toFixed(0) : '--';
  if (DOM.uiWr) DOM.uiWr.textContent = `${wr}%`;
  if (DOM.uiMg) DOM.uiMg.textContent = mgLevel;
}

function readAccount() {
  try {
    let foundBalance = false;
    let foundAccountType = false;
    
    // ============= MÉTODO 1: ZUSTAND STORE (localStorage) =============
    try {
      // Intentar leer del wallet-store de Zustand
      const walletStore = localStorage.getItem('wallet-store');
      if (walletStore) {
        const parsed = JSON.parse(walletStore);
        if (parsed && parsed.state) {
          // Detectar tipo de cuenta
          if (typeof parsed.state.isDemo !== 'undefined') {
            isDemo = parsed.state.isDemo;
            foundAccountType = true;
            logMonitor(`✓ Tipo cuenta desde store: ${isDemo ? 'DEMO' : 'REAL'}`, 'success');
          }
          
          // Obtener saldo de la cuenta activa
          if (parsed.state.wallets && Array.isArray(parsed.state.wallets)) {
            const accountType = isDemo ? 'DEMO' : 'REAL';
            const wallet = parsed.state.wallets.find(w => w.type === accountType);
            if (wallet && typeof wallet.balance !== 'undefined') {
              // El balance puede venir en diferentes formatos
              let rawBalance = wallet.balance;
              
              // Si es string, limpiar formato (quitar comas, espacios, etc)
              if (typeof rawBalance === 'string') {
                rawBalance = rawBalance.replace(/[^0-9.-]/g, '');
              }
              
              balance = parseFloat(rawBalance) || 0;
              
              // Si el balance parece estar en centavos (muy grande), dividir por 100
              // Por ejemplo: 403008 centavos = 4030.08 dólares
              if (balance > 10000 && balance.toString().length >= 5) {
                balance = balance / 100;
                logMonitor(`✓ Saldo desde store (convertido): $${balance.toFixed(2)}`, 'success');
              } else {
                logMonitor(`✓ Saldo desde store: $${balance.toFixed(2)}`, 'success');
              }
              
              foundBalance = true;
            }
          }
        }
      }
    } catch (e) {
      logMonitor('⚠ No se pudo leer wallet-store', 'info');
    }
    
    // ============= MÉTODO 2: LEER DEL DOM =============
    if (!foundBalance || !foundAccountType) {
      // Buscar todos los elementos con texto de cuenta
      const allText = document.body.innerText;
      
      // Buscar tipo de cuenta en el texto visible
      if (!foundAccountType) {
        // Buscar indicador de cuenta seleccionada
        const accountCards = document.querySelectorAll('[class*="_card-account"]');
        for (const card of accountCards) {
          const text = card.textContent.toLowerCase();
          if (card.classList.toString().includes('select') || 
              card.classList.toString().includes('checked') ||
              card.querySelector('svg[class*="check"]')) {
            if (text.includes('demo')) {
              isDemo = true;
              foundAccountType = true;
              logMonitor('✓ Tipo cuenta desde DOM: DEMO', 'success');
              break;
            } else if (text.includes('real')) {
              isDemo = false;
              foundAccountType = true;
              logMonitor('✓ Tipo cuenta desde DOM: REAL', 'success');
              break;
            }
          }
        }
      }
      
      // Si aún no se encontró, buscar en el header
      if (!foundAccountType) {
        const headerText = document.querySelector('header')?.textContent?.toLowerCase() || '';
        if (headerText.includes('cuenta demo')) {
          isDemo = true;
          foundAccountType = true;
          logMonitor('✓ Tipo cuenta desde header: DEMO', 'success');
        } else if (headerText.includes('cuenta real')) {
          isDemo = false;
          foundAccountType = true;
          logMonitor('✓ Tipo cuenta desde header: REAL', 'success');
        }
      }
      
      // Buscar saldo en elementos con clases específicas
      if (!foundBalance) {
        const balanceSelectors = [
          '[class*="_account-value_"]',
          '[class*="_balance"]',
          '[class*="balance-amount"]',
          '[class*="account-balance"]'
        ];
        
        for (const selector of balanceSelectors) {
          const elements = document.querySelectorAll(selector);
          for (const el of elements) {
            const parent = el.closest('[class*="_card-account"]') || el.parentElement;
            const parentText = parent?.textContent?.toLowerCase() || '';
            const targetType = isDemo ? 'demo' : 'real';
            
            // Verificar si este elemento corresponde al tipo de cuenta activo
            if (parentText.includes(targetType) || parentText.includes('cuenta ' + targetType)) {
              // Limpiar el texto: quitar todo excepto números, puntos y comas
              let text = el.textContent.replace(/[^0-9.,]/g, '');
              
              // Manejar formato con comas (4,030.08 -> 4030.08)
              // Si hay coma Y punto, la coma es separador de miles
              if (text.includes(',') && text.includes('.')) {
                text = text.replace(/,/g, ''); // Eliminar todas las comas
              } 
              // Si solo hay coma, podría ser separador decimal (4,03)
              else if (text.includes(',') && !text.includes('.')) {
                text = text.replace(',', '.'); // Convertir coma a punto
              }
              
              const parsedBalance = parseFloat(text);
              if (!isNaN(parsedBalance) && parsedBalance >= 0) {
                balance = parsedBalance;
                foundBalance = true;
                logMonitor(`✓ Saldo desde DOM (${selector}): $${balance.toFixed(2)}`, 'success');
                break;
              }
            }
          }
          if (foundBalance) break;
        }
      }
    }
    
    // ============= MÉTODO 3: GLOBAL VARIABLES =============
    if (!foundBalance || !foundAccountType) {
      try {
        // Buscar en variables globales de Worbit
        if (window.__NUXT__ && window.__NUXT__.state) {
          const state = window.__NUXT__.state;
          if (state.wallet) {
            if (typeof state.wallet.isDemo !== 'undefined' && !foundAccountType) {
              isDemo = state.wallet.isDemo;
              foundAccountType = true;
              logMonitor('✓ Tipo cuenta desde __NUXT__: ' + (isDemo ? 'DEMO' : 'REAL'), 'success');
            }
            if (typeof state.wallet.balance !== 'undefined' && !foundBalance) {
              balance = parseFloat(state.wallet.balance) || 0;
              foundBalance = true;
              logMonitor(`✓ Saldo desde __NUXT__: $${balance.toFixed(2)}`, 'success');
            }
          }
        }
      } catch (e) {}
    }
    
    // ============= ACTUALIZAR UI =============
    if (DOM.accType) {
      DOM.accType.textContent = isDemo ? 'DEMO' : 'REAL';
      DOM.accType.style.color = isDemo ? '#f1c40f' : '#e74c3c';
    }
    if (DOM.accBal) {
      DOM.accBal.textContent = `$${balance.toFixed(2)}`;
    }
    
    // Log de estado final si hay problemas
    if (!foundBalance) {
      logMonitor('⚠ No se pudo detectar saldo', 'blocked');
    }
    if (!foundAccountType) {
      logMonitor('⚠ No se pudo detectar tipo de cuenta', 'blocked');
    }
    
  } catch (e) {
    logMonitor('❌ Error en readAccount: ' + e.message, 'blocked');
  }
}

function logMonitor(msg, type = 'info') {
  if (!DOM.monitorBox) return;
  
  const now = new Date();
  const time = now.toTimeString().slice(0,8);
  const cls = type === 'success' ? 'monitor-success' : 
              type === 'blocked' ? 'monitor-blocked' : 
              type === 'pattern' ? 'monitor-pattern' : 'monitor-info';
  
  const line = document.createElement('div');
  line.className = 'monitor-line';
  line.innerHTML = `<span class="monitor-time">${time}</span> <span class="${cls}">${msg}</span>`;
  
  DOM.monitorBox.appendChild(line);
  
  while (DOM.monitorBox.children.length > MAX_LOGS) {
    DOM.monitorBox.removeChild(DOM.monitorBox.firstChild);
  }
  
  DOM.monitorBox.scrollTop = DOM.monitorBox.scrollHeight;
}

function startHealthCheck() {
  if (healthCheckInterval) clearInterval(healthCheckInterval);
  
  healthCheckInterval = setInterval(() => {
    const now = Date.now();
    const timeSinceLastTick = now - lastTickTime;
    
    if (timeSinceLastTick > DATA_TIMEOUT && wsConnected) {
      wsConnected = false;
      updateConnectionUI(false);
      logMonitor('Sin datos - verificando...', 'blocked');
      scheduleReconnect();
    }
    
    // Actualizar timer
    if (DOM.timerText && DOM.timerFill) {
      const adjustedNow = now + config.timeOffset;
      const sec = Math.ceil((60000 - (adjustedNow % 60000)) / 1000);
      DOM.timerText.textContent = `⏱ Cierre: ${sec}s`;
      const pct = ((60 - sec) / 60) * 100;
      DOM.timerFill.style.width = `${pct}%`;
      DOM.timerFill.style.background = sec <= 10 ? '#e74c3c' : sec <= 30 ? '#f1c40f' : '#00e676';
    }
    
    // Actualizar runtime
    if (DOM.uiRuntime && startTime > 0) {
      const elapsed = Math.floor((now - startTime) / 1000);
      const h = Math.floor(elapsed / 3600);
      const m = Math.floor((elapsed % 3600) / 60);
      DOM.uiRuntime.textContent = `${h.toString().padStart(2,'0')}h ${m.toString().padStart(2,'0')}m`;
    }
    
  }, HEALTH_CHECK_INTERVAL);
}

// ============= CONTROL DEL BOT =============
function startBot() {
  if (isRunning) return;
  
  isRunning = true;
  startTime = Date.now();
  initialBalance = balance;
  sessionStats = { w: 0, l: 0 };
  mgLevel = 0;
  tradeExecutedThisCandle = false;
  lastTradeType = null;
  activeMartingaleTrade = null;
  pendingSignal = null;
  chartAccessMethod = 'none';
  
  setupWebSocketInterceptor();
  startHealthCheck();
  
  // DIAGNÓSTICO: Ejecutar verificación de detección de datos
  setTimeout(() => runDiagnostics(), 500); // Pequeño delay para que todo se inicialice
  
  // NUEVO: Iniciar sincronización con gráfico
  if (config.useChartData) {
    chartSyncInterval = setInterval(syncWithChart, CHART_SYNC_INTERVAL);
  }
  
  if (DOM.mainBtn) {
    DOM.mainBtn.textContent = 'DETENER';
    DOM.mainBtn.classList.remove('btn-start');
    DOM.mainBtn.classList.add('btn-stop');
  }
  
  logMonitor('🟢 Sistema iniciado', 'success');
  logMonitor(`Fuente de datos: ${config.useChartData ? 'AUTO (Gráfico+WS)' : 'WebSocket'}`, 'info');
  
  // Cargar histórico si tenemos un par activo
  if (currentPair) {
    loadHistoricalData(currentPair).then(hist => {
      if (hist.length > 0) {
        candles = hist;
        chartCandles = hist.slice();
        processed = hist.length;
        if (DOM.uiCnt) DOM.uiCnt.textContent = `${Math.min(processed, TARGET_CANDLES)}/${TARGET_CANDLES}`;
      }
    });
  }
}

// ============= FUNCIÓN DE DIAGNÓSTICO =============
function runDiagnostics() {
  logMonitor('🔍 === INICIANDO DIAGNÓSTICO ===', 'info');
  
  // 1. VERIFICAR DETECCIÓN DE CUENTA
  logMonitor('📋 Verificando detección de cuenta...', 'info');
  readAccount(); // Esto ya mostrará logs de lo que detecta
  
  // 2. VERIFICAR ACCESO A STORES
  logMonitor('💾 Verificando stores de localStorage...', 'info');
  try {
    const walletStore = localStorage.getItem('wallet-store');
    if (walletStore) {
      logMonitor('✓ wallet-store encontrado', 'success');
      const parsed = JSON.parse(walletStore);
      if (parsed && parsed.state && parsed.state.wallets) {
        logMonitor(`✓ ${parsed.state.wallets.length} wallets en store`, 'success');
        
        // DEBUG: Mostrar valores crudos de cada wallet
        parsed.state.wallets.forEach(w => {
          logMonitor(`  → ${w.type}: ${w.balance} (crudo)`, 'info');
        });
        
        // DEBUG: Mostrar isDemo
        if (typeof parsed.state.isDemo !== 'undefined') {
          logMonitor(`  → isDemo: ${parsed.state.isDemo}`, 'info');
        }
      }
    } else {
      logMonitor('⚠ wallet-store no encontrado', 'blocked');
    }
    
    const chartStore = localStorage.getItem('chart-storage');
    if (chartStore) {
      logMonitor('✓ chart-storage encontrado', 'success');
    } else {
      logMonitor('⚠ chart-storage no encontrado', 'info');
    }
    
    const symbolStore = localStorage.getItem('symbol-store');
    if (symbolStore) {
      logMonitor('✓ symbol-store encontrado', 'success');
      const parsed = JSON.parse(symbolStore);
      if (parsed && parsed.state && parsed.state.symbolSelected) {
        logMonitor(`✓ Par actual: ${parsed.state.symbolSelected.ticker}`, 'success');
      }
    } else {
      logMonitor('⚠ symbol-store no encontrado', 'info');
    }
  } catch (e) {
    logMonitor('❌ Error verificando stores: ' + e.message, 'blocked');
  }
  
  // 3. VERIFICAR ACCESO A TRADINGVIEW
  logMonitor('📊 Verificando acceso a TradingView...', 'info');
  try {
    const widget = getTradingViewWidget();
    if (widget) {
      logMonitor('✓ Widget de TradingView accesible', 'success');
      try {
        const chart = widget.activeChart();
        if (chart) {
          logMonitor('✓ Gráfico activo detectado', 'success');
        } else {
          logMonitor('⚠ No hay gráfico activo', 'blocked');
        }
      } catch (e) {
        logMonitor('⚠ Error accediendo al gráfico: ' + e.message, 'blocked');
      }
    } else {
      logMonitor('⚠ Widget de TradingView no accesible', 'blocked');
      logMonitor('ℹ El bot usará WebSocket como fuente', 'info');
    }
  } catch (e) {
    logMonitor('❌ Error verificando TradingView: ' + e.message, 'blocked');
  }
  
  // 4. VERIFICAR IFRAME DEL GRÁFICO
  logMonitor('🖼️ Verificando iframe del gráfico...', 'info');
  try {
    const iframe = document.querySelector('iframe[title="Chart"]');
    if (iframe) {
      logMonitor('✓ Iframe del gráfico encontrado', 'success');
      if (iframe.src) {
        const url = new URL(iframe.src);
        if (url.searchParams.get('ticker')) {
          logMonitor(`✓ Ticker: ${url.searchParams.get('ticker')}`, 'success');
        }
        if (url.searchParams.get('symbolApiUrl')) {
          logMonitor('✓ API URL presente en iframe', 'success');
        }
      }
    } else {
      logMonitor('⚠ Iframe del gráfico no encontrado', 'blocked');
    }
  } catch (e) {
    logMonitor('❌ Error verificando iframe: ' + e.message, 'blocked');
  }
  
  // 5. VERIFICAR WEBSOCKET
  logMonitor('🌐 Estado de WebSocket...', 'info');
  if (wsConnected) {
    logMonitor('✓ WebSocket conectado', 'success');
    if (candles.length > 0) {
      logMonitor(`✓ Velas acumuladas: ${candles.length}`, 'success');
      logMonitor(`✓ Última vela: ${new Date(candles[candles.length - 1].s).toLocaleTimeString()}`, 'info');
    } else {
      logMonitor('ℹ Sin velas aún - esperando datos', 'info');
    }
  } else {
    logMonitor('⚠ WebSocket no conectado (aún)', 'info');
    logMonitor('ℹ El WebSocket se conectará automáticamente', 'info');
    logMonitor('ℹ Puede tardar 5-15 segundos en recibir datos', 'info');
  }
  
  // 6. ESTADO DE VELAS Y DATOS DEL GRÁFICO
  logMonitor('📊 Verificando datos del gráfico...', 'info');
  if (processed >= TARGET_CANDLES) {
    logMonitor(`✓ Velas suficientes: ${processed}/${TARGET_CANDLES}`, 'success');
  } else {
    logMonitor(`⏳ Acumulando velas: ${processed}/${TARGET_CANDLES}`, 'info');
    logMonitor('ℹ Espera 1-3 minutos para acumular 3 velas', 'info');
  }
  
  if (currentPair) {
    logMonitor(`✓ Par actual: ${currentPair}`, 'success');
  } else {
    logMonitor('⚠ Sin par seleccionado', 'blocked');
  }
  
  // 7. RESUMEN FINAL
  logMonitor('📊 === RESUMEN DE DIAGNÓSTICO ===', 'info');
  logMonitor(`Saldo: $${balance.toFixed(2)} | Cuenta: ${isDemo ? 'DEMO' : 'REAL'}`, balance > 0 ? 'success' : 'blocked');
  logMonitor(`Velas: ${processed}/${TARGET_CANDLES} | Par: ${currentPair || 'N/A'}`, 'info');
  logMonitor(`WebSocket: ${wsConnected ? 'Conectado' : 'Esperando'}`, wsConnected ? 'success' : 'info');
  logMonitor(`Método de datos: ${config.useChartData ? 'AUTO' : 'WebSocket'}`, 'info');
  
  if (!wsConnected || processed < TARGET_CANDLES) {
    logMonitor('', 'info');
    logMonitor('⏰ IMPORTANTE: Espera 1-3 minutos', 'info');
    logMonitor('   El bot necesita acumular 3 velas', 'info');
    logMonitor('   completas antes de detectar patrones', 'info');
  }
  
  logMonitor('=================================', 'info');
}


function stopBot() {
  isRunning = false;
  
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
  
  if (chartSyncInterval) {
    clearInterval(chartSyncInterval);
    chartSyncInterval = null;
  }
  
  if (wsReconnectTimeout) {
    clearTimeout(wsReconnectTimeout);
    wsReconnectTimeout = null;
  }
  
  if (DOM.mainBtn) {
    DOM.mainBtn.textContent = 'INICIAR SISTEMA';
    DOM.mainBtn.classList.remove('btn-stop');
    DOM.mainBtn.classList.add('btn-start');
  }
  
  logMonitor('�´ Sistema detenido', 'blocked');
  
  // Resumen de sesión
  const sessionTotal = sessionStats.w + sessionStats.l;
  if (sessionTotal > 0) {
    const wr = ((sessionStats.w / sessionTotal) * 100).toFixed(0);
    logMonitor(`📊 Sesión: ${sessionStats.w}W/${sessionStats.l}L (${wr}%)`, 'info');
  }
}

// ============= INICIALIZACIÓN =============
function initSystem() {
  if (isSystemReady) return;
  
  try {
    setupWebSocketInterceptor();
    
    let hud = document.getElementById('worbit-hud');
    if (!hud) {
      hud = document.createElement('div');
      hud.id = 'worbit-hud';
      hud.innerHTML = `
<style>
#worbit-hud{position:fixed;top:20px;right:20px;width:320px;background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,.6);z-index:999999;font-family:'Segoe UI',system-ui,sans-serif;display:none;border:1px solid rgba(255,255,255,.1);overflow:hidden}
#worbit-hud.visible{display:block}
.hud-header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:linear-gradient(90deg,#0f3460 0%,#16213e 100%);border-bottom:1px solid rgba(255,255,255,.1);cursor:grab}
.hud-title{display:flex;align-items:center;gap:10px;font-weight:700;font-size:14px;color:#fff;text-transform:uppercase;letter-spacing:1px}
.hud-version{font-size:10px;color:#00e676;font-weight:400}
.dot{width:10px;height:10px;border-radius:50%;background:#e74c3c;box-shadow:0 0 8px #e74c3c;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
.close-btn{background:none;border:none;color:#888;cursor:pointer;font-size:18px;padding:4px 8px;border-radius:4px}
.close-btn:hover{background:rgba(255,255,255,.1);color:#fff}
.hud-body{padding:12px 16px}
.account-info{display:flex;gap:10px;margin-bottom:12px;align-items:center}
.acc-badge{padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;background:rgba(241,196,15,.2);color:#f1c40f}
.acc-balance{font-size:16px;font-weight:700;color:#fff}
.live-price{font-size:11px;padding:3px 8px;border-radius:4px;margin-left:auto}
.price-up{background:rgba(0,230,118,.2);color:#00e676}
.price-down{background:rgba(231,76,60,.2);color:#e74c3c}
.controls-row{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap}
.switch-box{display:flex;align-items:center;gap:6px;background:rgba(255,255,255,.05);padding:6px 10px;border-radius:8px;cursor:pointer;transition:all .2s;flex:1;min-width:70px}
.switch-box:hover{background:rgba(255,255,255,.1)}
.switch-box.active{background:rgba(0,230,118,.2);border:1px solid rgba(0,230,118,.3)}
.switch-label{font-size:10px;color:#aaa;text-transform:uppercase}
.switch-box.active .switch-label{color:#00e676}
.section-header{display:flex;align-items:center;justify-content:space-between;padding:8px 0;cursor:pointer;border-top:1px solid rgba(255,255,255,.05);margin-top:8px}
.section-title{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px}
.section-toggle{color:#666;font-size:10px;transition:transform .2s}
.section-toggle.open{transform:rotate(180deg)}
.config-panel{display:none;padding:10px 0}
.config-panel.visible{display:block}
.config-row{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.config-label{font-size:11px;color:#aaa;flex:1}
.config-input{width:60px;padding:6px 8px;border:1px solid rgba(255,255,255,.1);border-radius:6px;background:rgba(0,0,0,.3);color:#fff;font-size:12px;text-align:center}
.config-input:focus{outline:none;border-color:#00e676}
.checkbox-row{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.checkbox-row input{width:14px;height:14px;accent-color:#00e676}
.checkbox-row label{font-size:11px;color:#aaa}
.stop-group{margin-left:20px;padding:8px;background:rgba(0,0,0,.2);border-radius:8px;margin-bottom:8px}
.stop-group.disabled-group{opacity:.4;pointer-events:none}
.stats-row{display:flex;gap:10px;margin-bottom:12px}
.stat-item{flex:1;text-align:center;background:rgba(255,255,255,.05);padding:8px;border-radius:8px}
.stat-val{font-size:18px;font-weight:700;color:#fff}
.stat-label{font-size:9px;color:#666;text-transform:uppercase;margin-top:2px}
.stat-val.win{color:#00e676}
.stat-val.loss{color:#e74c3c}
.timer-section{background:rgba(0,0,0,.2);border-radius:10px;padding:10px;margin-bottom:12px}
.timer-header{display:flex;justify-content:space-between;margin-bottom:6px;font-size:11px;color:#aaa}
.session-timer{color:#00e676}
#timer-bar-bg{height:4px;background:rgba(255,255,255,.1);border-radius:2px;overflow:hidden}
#timer-bar-fill{height:100%;width:0;background:#00e676;transition:width .3s,background .3s}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}
.stat-box{background:rgba(255,255,255,.05);padding:8px;border-radius:8px;text-align:center}
.stat-box .stat-label{font-size:9px;color:#666;text-transform:uppercase;margin-bottom:2px}
.stat-box .stat-val{font-size:13px;font-weight:600;color:#fff}
#signal-box{padding:16px;border-radius:12px;text-align:center;margin-bottom:12px;background:rgba(255,255,255,.03);transition:all .3s}
.sig-waiting{border:1px dashed rgba(255,255,255,.1)}
.sig-anticipation{background:linear-gradient(135deg,rgba(52,152,219,.2) 0%,rgba(52,152,219,.1) 100%);border:1px solid rgba(52,152,219,.3)}
.sig-possible-call{background:linear-gradient(135deg,rgba(0,230,118,.15) 0%,rgba(0,230,118,.05) 100%);border:1px solid rgba(0,230,118,.3)}
.sig-possible-put{background:linear-gradient(135deg,rgba(231,76,60,.15) 0%,rgba(231,76,60,.05) 100%);border:1px solid rgba(231,76,60,.3)}
.sig-entry-call{background:linear-gradient(135deg,rgba(0,230,118,.3) 0%,rgba(0,230,118,.1) 100%);border:2px solid #00e676;animation:glow-green 1s infinite}
.sig-entry-put{background:linear-gradient(135deg,rgba(231,76,60,.3) 0%,rgba(231,76,60,.1) 100%);border:2px solid #e74c3c;animation:glow-red 1s infinite}
@keyframes glow-green{0%,100%{box-shadow:0 0 10px rgba(0,230,118,.3)}50%{box-shadow:0 0 20px rgba(0,230,118,.5)}}
@keyframes glow-red{0%,100%{box-shadow:0 0 10px rgba(231,76,60,.3)}50%{box-shadow:0 0 20px rgba(231,76,60,.5)}}
.anticipation-badge{display:inline-block;padding:6px 16px;background:rgba(52,152,219,.3);border-radius:20px;font-size:13px;font-weight:700;color:#3498db}
.entry-countdown{margin-top:8px;font-size:12px;font-weight:600;color:#fff;animation:blink .5s infinite}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.5}}
.monitor-container{margin-bottom:12px}
#monitor-box{max-height:0;overflow:hidden;transition:max-height .3s;background:rgba(0,0,0,.3);border-radius:8px}
#monitor-box.visible{max-height:150px;overflow-y:auto;padding:8px}
.monitor-line{font-size:10px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,.03);display:flex;gap:8px}
.monitor-time{color:#666;font-family:monospace}
.monitor-info{color:#aaa}
.monitor-success{color:#00e676}
.monitor-blocked{color:#e74c3c}
.monitor-pattern{color:#f1c40f}
.btn-main{width:100%;padding:14px;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;text-transform:uppercase;letter-spacing:1px;transition:all .2s}
.btn-start{background:linear-gradient(135deg,#00e676 0%,#00c853 100%);color:#000}
.btn-start:hover{background:linear-gradient(135deg,#00c853 0%,#00a843 100%);transform:translateY(-1px)}
.btn-stop{background:linear-gradient(135deg,#e74c3c 0%,#c0392b 100%);color:#fff}
.btn-stop:hover{background:linear-gradient(135deg,#c0392b 0%,#a93226 100%)}
.source-badge{font-size:9px;padding:2px 6px;border-radius:4px;background:rgba(0,230,118,.2);color:#00e676;margin-left:auto}
</style>

<div class="hud-header" id="worbit-header">
  <div class="hud-title">
    <span class="dot" id="dot"></span>
    WORBIT SNIPER <span class="hud-version">v${VERSION}</span>
  </div>
  <button class="close-btn" id="close-btn">✕</button>
</div>

<div class="hud-body">
  <div class="account-info">
    <span class="acc-badge" id="acc-type">DEMO</span>
    <span class="acc-balance" id="acc-bal">$0.00</span>
    <span class="live-price price-down" id="ui-price">--</span>
    <span class="source-badge" id="ui-source">--</span>
  </div>
  
  <div class="controls-row">
    <div class="switch-box" id="sw-auto"><span class="switch-label">Auto</span></div>
    <div class="switch-box" id="sw-mg"><span class="switch-label">MG</span></div>
    <div class="switch-box" id="sw-inv"><span class="switch-label">INV</span></div>
    <div class="switch-box" id="sw-chart"><span class="switch-label">📊</span></div>
  </div>
  
  <div class="stats-row">
    <div class="stat-item"><div class="stat-val win" id="ui-w">0</div><div class="stat-label">Ganadas</div></div>
    <div class="stat-item"><div class="stat-val loss" id="ui-l">0</div><div class="stat-label">Perdidas</div></div>
    <div class="stat-item"><div class="stat-val" id="ui-wr">--%</div><div class="stat-label">Win Rate</div></div>
  </div>
  
  <div class="section-header" id="config-header">
    <span class="section-title">⚙️ CONFIGURACIÓN</span>
    <span class="section-toggle" id="config-toggle">▼</span>
  </div>
  <div class="config-panel" id="config-panel">
    <div class="config-row">
      <span class="config-label">% Riesgo</span>
      <input type="number" class="config-input" id="risk-pct" value="1" min="0.1" max="100" step="0.1">
    </div>
    <div class="config-row">
      <span class="config-label">Niveles MG</span>
      <input type="number" class="config-input" id="mg-steps" value="3" min="1" max="10">
    </div>
    <div class="config-row">
      <span class="config-label">Factor MG</span>
      <input type="number" class="config-input" id="mg-factor" value="2.0" min="1.1" max="5" step="0.1">
    </div>
    <div class="config-row">
      <span class="config-label">Entrada (seg)</span>
      <input type="number" class="config-input" id="entry-sec" value="59" min="50" max="59">
    </div>
    <div class="config-row">
      <span class="config-label">Offset Timer (ms)</span>
      <input type="number" class="config-input" id="timer-delay" value="0" min="-5000" max="5000" step="100">
    </div>
    <div class="checkbox-row">
      <input type="checkbox" id="chk-confirm">
      <label for="chk-confirm">Confirmación extra</label>
    </div>
    <div class="checkbox-row">
      <input type="checkbox" id="chk-next">
      <label for="chk-next">Operar en siguiente vela</label>
    </div>
    
    <div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.1)">
      <div style="font-size:10px;color:#888;margin-bottom:8px">STOP AUTOMÁTICO</div>
      <div class="checkbox-row">
        <input type="checkbox" id="chk-time">
        <label for="chk-time">Por tiempo</label>
      </div>
      <div class="stop-group disabled-group" id="grp-time">
        <div class="config-row">
          <span class="config-label">Minutos</span>
          <input type="number" class="config-input" id="session-time" value="60" min="1" max="480">
        </div>
      </div>
      <div class="checkbox-row">
        <input type="checkbox" id="chk-risk">
        <label for="chk-risk">Por riesgo</label>
      </div>
      <div class="stop-group disabled-group" id="grp-risk">
        <div class="config-row">
          <span class="config-label">Take Profit %</span>
          <input type="number" class="config-input" id="profit-target" value="10" min="1" max="100">
        </div>
        <div class="config-row">
          <span class="config-label">Stop Loss %</span>
          <input type="number" class="config-input" id="stop-loss" value="10" min="1" max="100">
        </div>
      </div>
      <div class="checkbox-row">
        <input type="checkbox" id="chk-trades">
        <label for="chk-trades">Por trades</label>
      </div>
      <div class="stop-group disabled-group" id="grp-trades">
        <div class="config-row">
          <span class="config-label">Max Wins</span>
          <input type="number" class="config-input" id="max-wins" value="5" min="1" max="100">
        </div>
        <div class="config-row">
          <span class="config-label">Max Losses</span>
          <input type="number" class="config-input" id="max-losses" value="3" min="1" max="100">
        </div>
      </div>
    </div>
  </div>
  
  <div class="timer-section">
    <div class="timer-header">
      <span id="timer-text">⏱ Cierre: --s</span>
      <span id="ui-runtime" class="session-timer">00h 00m</span>
    </div>
    <div id="timer-bar-bg"><div id="timer-bar-fill"></div></div>
  </div>
  
  <div class="info-grid">
    <div class="stat-box"><div class="stat-label">ACTIVO</div><div class="stat-val" id="ui-active" style="color:#3498db;font-size:10px">--</div></div>
    <div class="stat-box"><div class="stat-label">VELAS</div><div class="stat-val" id="ui-cnt">0/${TARGET_CANDLES}</div></div>
    <div class="stat-box" id="mg-box" style="display:none"><div class="stat-label">NIVEL MG</div><div class="stat-val" id="ui-mg" style="color:#f1c40f">0</div></div>
  </div>
  
  <div id="signal-box"><div style="font-size:11px;color:#666">INICIAR PARA ANALIZAR</div></div>
  
  <div class="monitor-container">
    <div class="section-header" id="log-header">
      <span class="section-title">📋 REGISTRO</span>
      <span class="section-toggle" id="log-toggle">▼</span>
    </div>
    <div id="monitor-box">
      <div class="monitor-line"><span class="monitor-time">--:--:--</span> <span class="monitor-info">Sistema listo</span></div>
    </div>
  </div>
  
  <button class="btn-main btn-start" id="main-btn">INICIAR SISTEMA</button>
</div>`;
      document.body.appendChild(hud);
    }
    
    const $ = id => document.getElementById(id);
    DOM = {
      hud: $('worbit-hud'),
      header: $('worbit-header'),
      dot: $('dot'),
      accType: $('acc-type'),
      accBal: $('acc-bal'),
      uiPrice: $('ui-price'),
      uiSource: $('ui-source'),
      swAuto: $('sw-auto'),
      swChart: $('sw-chart'),
      riskPct: $('risk-pct'),
      swMg: $('sw-mg'),
      swInv: $('sw-inv'),
      mgSteps: $('mg-steps'),
      mgFactor: $('mg-factor'),
      entrySec: $('entry-sec'),
      timerDelay: $('timer-delay'),
      chkConfirm: $('chk-confirm'),
      chkNext: $('chk-next'),
      configHeader: $('config-header'),
      configPanel: $('config-panel'),
      configToggle: $('config-toggle'),
      logHeader: $('log-header'),
      logToggle: $('log-toggle'),
      uiW: $('ui-w'),
      uiL: $('ui-l'),
      uiWr: $('ui-wr'),
      timerText: $('timer-text'),
      timerFill: $('timer-bar-fill'),
      uiRuntime: $('ui-runtime'),
      uiActive: $('ui-active'),
      uiCnt: $('ui-cnt'),
      uiMg: $('ui-mg'),
      mgBox: $('mg-box'),
      signalBox: $('signal-box'),
      monitorBox: $('monitor-box'),
      mainBtn: $('main-btn'),
      closeBtn: $('close-btn'),
      chkTime: $('chk-time'),
      chkRisk: $('chk-risk'),
      chkTrades: $('chk-trades'),
      grpTime: $('grp-time'),
      grpRisk: $('grp-risk'),
      grpTrades: $('grp-trades'),
      sessionTime: $('session-time'),
      profitTarget: $('profit-target'),
      stopLoss: $('stop-loss'),
      maxWins: $('max-wins'),
      maxLosses: $('max-losses')
    };
    
    // Event Listeners
    if (DOM.configHeader) DOM.configHeader.onclick = () => {
      DOM.configPanel.classList.toggle('visible');
      DOM.configToggle.classList.toggle('open');
    };
    if (DOM.logHeader) DOM.logHeader.onclick = () => {
      DOM.monitorBox.classList.toggle('visible');
      DOM.logToggle.classList.toggle('open');
    };
    
    if (DOM.swAuto) DOM.swAuto.onclick = function() {
      config.autoTrade = !config.autoTrade;
      this.classList.toggle('active', config.autoTrade);
      logMonitor(`AutoTrade: ${config.autoTrade ? 'ON' : 'OFF'}`);
      saveConfigToStorage();
    };
    
    if (DOM.swMg) DOM.swMg.onclick = function() {
      config.useMartingale = !config.useMartingale;
      this.classList.toggle('active', config.useMartingale);
      DOM.mgBox.style.display = config.useMartingale ? 'block' : 'none';
      logMonitor(`Martingala: ${config.useMartingale ? 'ON' : 'OFF'}`);
      if (!config.useMartingale) mgLevel = 0;
      saveConfigToStorage();
    };
    
    if (DOM.swInv) DOM.swInv.onclick = function() {
      config.invertTrade = !config.invertTrade;
      this.classList.toggle('active', config.invertTrade);
      logMonitor(`Inversión: ${config.invertTrade ? 'ON' : 'OFF'}`);
      saveConfigToStorage();
    };
    
    // NUEVO: Switch para usar datos del gráfico
    if (DOM.swChart) DOM.swChart.onclick = function() {
      config.useChartData = !config.useChartData;
      this.classList.toggle('active', config.useChartData);
      logMonitor(`Datos del gráfico: ${config.useChartData ? 'ON' : 'OFF'}`);
      saveConfigToStorage();
    };
    
    if (DOM.riskPct) DOM.riskPct.onchange = function() {
      config.riskPct = parseFloat(this.value) || 1;
      calcAmount();
      saveConfigToStorage();
    };
    if (DOM.mgSteps) DOM.mgSteps.onchange = function() {
      config.mgMaxSteps = parseInt(this.value) || 3;
      saveConfigToStorage();
    };
    if (DOM.mgFactor) DOM.mgFactor.onchange = function() {
      config.mgFactor = parseFloat(this.value) || 2.0;
      saveConfigToStorage();
    };
    if (DOM.entrySec) DOM.entrySec.onchange = function() {
      config.entrySec = parseInt(this.value) || 59;
      saveConfigToStorage();
    };
    if (DOM.timerDelay) DOM.timerDelay.onchange = function() {
      config.timeOffset = parseInt(this.value) || 0;
      saveConfigToStorage();
    };
    if (DOM.chkConfirm) DOM.chkConfirm.onchange = function() {
      config.useConfirmation = this.checked;
      logMonitor(`Confirmación: ${config.useConfirmation ? 'ON' : 'OFF'}`);
      saveConfigToStorage();
    };
    if (DOM.chkNext) DOM.chkNext.onchange = function() {
      config.operateOnNext = this.checked;
      logMonitor(`Modo: ${config.operateOnNext ? 'SIGUIENTE VELA' : 'VELA ACTUAL'}`);
      saveConfigToStorage();
    };
    
    // Stop Config
    if (DOM.chkTime) DOM.chkTime.onchange = function() {
      config.stopConfig.useTime = this.checked;
      DOM.grpTime.classList.toggle('disabled-group', !this.checked);
      saveConfigToStorage();
    };
    if (DOM.chkRisk) DOM.chkRisk.onchange = function() {
      config.stopConfig.useRisk = this.checked;
      DOM.grpRisk.classList.toggle('disabled-group', !this.checked);
      saveConfigToStorage();
    };
    if (DOM.chkTrades) DOM.chkTrades.onchange = function() {
      config.stopConfig.useTrades = this.checked;
      DOM.grpTrades.classList.toggle('disabled-group', !this.checked);
      saveConfigToStorage();
    };
    if (DOM.sessionTime) DOM.sessionTime.onchange = function() {
      config.stopConfig.timeMin = parseInt(this.value) || 0;
      saveConfigToStorage();
    };
    if (DOM.profitTarget) DOM.profitTarget.onchange = function() {
      config.stopConfig.profitPct = parseFloat(this.value) || 0;
      saveConfigToStorage();
    };
    if (DOM.stopLoss) DOM.stopLoss.onchange = function() {
      config.stopConfig.stopLossPct = parseFloat(this.value) || 0;
      saveConfigToStorage();
    };
    if (DOM.maxWins) DOM.maxWins.onchange = function() {
      config.stopConfig.maxWins = parseInt(this.value) || 0;
      saveConfigToStorage();
    };
    if (DOM.maxLosses) DOM.maxLosses.onchange = function() {
      config.stopConfig.maxLosses = parseInt(this.value) || 0;
      saveConfigToStorage();
    };
    
    if (DOM.closeBtn) DOM.closeBtn.onclick = () => {
      isVisible = false;
      DOM.hud.classList.remove('visible');
      stopBot();
    };
    if (DOM.mainBtn) DOM.mainBtn.onclick = () => isRunning ? stopBot() : startBot();
    
    // Dragging
    let dragging = false, dragStartX = 0, dragStartY = 0, hudOffsetX = 0, hudOffsetY = 0;
    if (DOM.header) DOM.header.addEventListener('mousedown', (e) => {
      if (e.target.id === 'close-btn') return;
      dragging = true;
      dragStartX = e.clientX - hudOffsetX;
      dragStartY = e.clientY - hudOffsetY;
      DOM.header.style.cursor = 'grabbing';
    });
    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      hudOffsetX = e.clientX - dragStartX;
      hudOffsetY = e.clientY - dragStartY;
      DOM.hud.style.transform = `translate(${hudOffsetX}px, ${hudOffsetY}px)`;
    });
    document.addEventListener('mouseup', () => {
      dragging = false;
      if (DOM.header) DOM.header.style.cursor = 'grab';
    });
    
    // Final Init
    isSystemReady = true;
    updateStats();
    readAccount();
    loadConfigFromStorage();
    setInterval(readAccount, 3000);
    
    console.log('%c WORBIT SNIPER V11.0 READY', 'color: #00e676; font-weight: bold; font-size: 12px;');
    
  } catch (e) {
    console.error('Init Error:', e);
  }
}

// ============= MESSAGE HANDLERS =============
window.addEventListener('message', e => {
  if (e.data.type === 'SNIPER_TOGGLE_UI') {
    if (!isSystemReady) initSystem();
    isVisible = !isVisible;
    if (DOM.hud) DOM.hud.classList.toggle('visible', isVisible);
    if (isVisible) readAccount();
    else stopBot();
  }
  
  if (e.data.type === 'SNIPER_CONNECTION_LOST') {
    wsConnected = false;
    updateConnectionUI(false);
    logMonitor('Conexión perdida', 'blocked');
  }
});

// ============= AUTO INIT =============
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSystem);
} else {
  if (document.body) initSystem();
}

})();