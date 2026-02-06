// injected.js - WORBIT SNIPER V12.0 - ESTRATEGIA BLINDADA
// Características: Sistema de warmup, EMA/ATR filters, Martingala inteligente, Score de señales
(function() {
'use strict';
console.log('%c WORBIT SNIPER V12.0 LOADING...', 'background: #00e676; color: #000; font-size: 14px; padding: 5px;');

// ============= CONSTANTES =============
const VERSION = '12.0';
const TARGET_CANDLES = 3;           // Mínimo para patrones básicos
const TARGET_CANDLES_FULL = 21;     // Mínimo para sistema completo (EMA 21)
const MAX_CANDLES = 200;
const MAX_LOGS = 20;
const HEALTH_CHECK_INTERVAL = 3000;
const DATA_TIMEOUT = 8000;
const CHART_SYNC_INTERVAL = 1000;

// Constantes de reconexión WebSocket (backoff exponencial rápido)
const WS_RECONNECT_DELAYS = [100, 300, 500, 1000, 2000];
const WS_MAX_RECONNECT_ATTEMPTS = 10;

// Constantes de EMA y ATR
const EMA_FAST_PERIOD = 8;
const EMA_SLOW_PERIOD = 21;
const ATR_PERIOD = 14;

// Constantes de Score
const MIN_SCORE_TO_TRADE = 6;       // Score mínimo para operar (de 10)
const MIN_SCORE_MARTINGALE = 5;     // Score mínimo para martingala

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
  entrySec: 57,           // Segundo de entrada (57 = 3 segundos antes del cierre)
  entryWindowSec: 3,      // Duración de la ventana de entrada en segundos
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
let lastLoggedBalance = 0; // Para evitar loguear el mismo saldo repetidamente
let balanceLoaded = false; // Flag para indicar que el saldo ya fue cargado
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
let lastTradeTime = 0;             // Timestamp del último trade ejecutado
let consecutiveLosses = 0;         // Contador de pérdidas consecutivas
const MIN_TRADE_INTERVAL = 5000;   // Mínimo 5 segundos entre trades
const MAX_CONSECUTIVE_LOSSES = 5;  // Máximo de pérdidas consecutivas antes de pausa

// NUEVO: Estado del acceso al gráfico
let chartAccessMethod = 'none'; // 'tradingview', 'zustand', 'api', 'websocket'
let tvWidgetRef = null;
let chartSyncInterval = null;
let lastChartSync = 0;

// ============= NUEVO V12: SISTEMA DE WARMUP =============
let systemWarmupLevel = 0;         // 0-100% de preparación
let isSystemWarmedUp = false;      // True cuando está al 100%

// ============= NUEVO V12: INDICADORES TÉCNICOS =============
let emaFast = null;                // EMA 8
let emaSlow = null;                // EMA 21
let atrValue = null;               // ATR 14
let atrAverage = null;             // Promedio de ATR para comparar volatilidad
let currentTrend = 'neutral';      // 'bullish', 'bearish', 'neutral'
let volatilityLevel = 'normal';    // 'low', 'normal', 'high'

// ============= NUEVO V12: WEBSOCKET ROBUSTO =============
let wsReconnectAttempt = 0;
let activeWebSocket = null;
let wsHeartbeatInterval = null;
let lastWsMessageTime = 0;

// ============= NUEVO V12: MONITOR DE TRADE EN TIEMPO REAL =============
let activeTradeMonitor = null;     // Trade activo siendo monitoreado
let tradeProgressData = [];        // Historial de precios durante el trade

// Intervalos
let tickerInterval = null;
let sessionInterval = null;
let healthCheckInterval = null;
let warmupInterval = null;

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

// ============= WEBSOCKET INTERCEPTOR MEJORADO V12 =============
let originalWebSocket = null;
let wsReconnectTimeout = null;
let lastWsUrl = null;
let lastWsProtocols = null;

function setupWebSocketInterceptor() {
  if (originalWebSocket) return;

  originalWebSocket = window.WebSocket;

  window.WebSocket = function(url, protocols) {
    const ws = new originalWebSocket(url, protocols);

    // V12: Guardar URL y protocolos para reconexión
    if (url.includes('symbol-prices')) {
      lastWsUrl = url;
      lastWsProtocols = protocols;
      activeWebSocket = ws;
    }

    ws.addEventListener('open', () => {
      if (url.includes('symbol-prices')) {
        wsConnected = true;
        lastTickTime = Date.now();
        lastWsMessageTime = Date.now();
        wsReconnectAttempt = 0; // V12: Resetear contador de intentos
        logMonitor('✓ WebSocket conectado', 'success');
        updateConnectionUI(true);
        startWsHeartbeat(); // V12: Iniciar monitoreo de heartbeat
      }
    });

    ws.addEventListener('close', (event) => {
      if (url.includes('symbol-prices')) {
        wsConnected = false;
        activeWebSocket = null;
        logMonitor(`⚠ WebSocket cerrado (${event.code})`, 'blocked');
        updateConnectionUI(false);
        scheduleReconnect(); // V12: Reconexión instantánea
      }
    });

    ws.addEventListener('error', () => {
      if (url.includes('symbol-prices')) {
        logMonitor('⚠ Error WebSocket', 'blocked');
        updateConnectionUI(false);
      }
    });

    ws.addEventListener('message', (event) => {
      lastWsMessageTime = Date.now(); // V12: Actualizar timestamp de último mensaje
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

  // V12: Iniciar monitoreo de health del WebSocket
  setInterval(checkWsHealth, 3000);
}

/**
 * V12: Monitorea la salud del WebSocket y detecta conexiones zombies
 */
function checkWsHealth() {
  if (!isRunning || !wsConnected) return;

  const timeSinceLastMessage = Date.now() - lastWsMessageTime;

  // Si no hay mensajes en 10 segundos, la conexión puede estar muerta
  if (timeSinceLastMessage > 10000) {
    logMonitor('⚠ WebSocket sin datos - Verificando...', 'info');

    // Si el WebSocket existe pero no envía datos, cerrarlo y reconectar
    if (activeWebSocket && activeWebSocket.readyState === WebSocket.OPEN) {
      logMonitor('Forzando reconexión...', 'info');
      try {
        activeWebSocket.close();
      } catch (e) {}
    }
  }
}

/**
 * V12: Inicia el heartbeat del WebSocket para detectar desconexiones rápidamente
 */
function startWsHeartbeat() {
  if (wsHeartbeatInterval) clearInterval(wsHeartbeatInterval);

  wsHeartbeatInterval = setInterval(() => {
    if (!wsConnected || !activeWebSocket) return;

    // Verificar si el WebSocket sigue abierto
    if (activeWebSocket.readyState !== WebSocket.OPEN) {
      wsConnected = false;
      updateConnectionUI(false);
      scheduleReconnect();
    }
  }, 1000);
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

/**
 * V12: Sistema de reconexión instantánea con backoff exponencial
 * No recarga la página, crea una nueva conexión WebSocket directamente
 */
function scheduleReconnect() {
  if (wsReconnectTimeout) return;
  if (!isRunning) return;

  // Determinar delay basado en el intento actual
  const delayIndex = Math.min(wsReconnectAttempt, WS_RECONNECT_DELAYS.length - 1);
  const delay = WS_RECONNECT_DELAYS[delayIndex];

  wsReconnectTimeout = setTimeout(() => {
    wsReconnectTimeout = null;
    if (wsConnected) {
      wsReconnectAttempt = 0;
      return;
    }

    wsReconnectAttempt++;
    logMonitor(`🔄 Reconectando (${wsReconnectAttempt}/${WS_MAX_RECONNECT_ATTEMPTS})...`, 'info');

    // Si excedemos el máximo de intentos, usar método de fallback
    if (wsReconnectAttempt > WS_MAX_RECONNECT_ATTEMPTS) {
      logMonitor('⚠ Máximo de intentos - Recargando gráfico...', 'blocked');
      wsReconnectAttempt = 0;
      forceChartReconnect();
      return;
    }

    // V12: Intentar reconexión directa sin recargar página
    attemptDirectReconnect();

  }, delay);
}

/**
 * V12: Intenta reconectar directamente creando un nuevo WebSocket
 */
function attemptDirectReconnect() {
  // Método 1: Si tenemos la URL guardada, intentar reconectar directamente
  if (lastWsUrl && originalWebSocket) {
    try {
      logMonitor('Intentando conexión directa...', 'info');
      const newWs = new window.WebSocket(lastWsUrl, lastWsProtocols);
      // El interceptor manejará la conexión automáticamente
      return;
    } catch (e) {
      logMonitor('Conexión directa fallida', 'blocked');
    }
  }

  // Método 2: Forzar reconexión del socket.io subyacente
  try {
    const socketManager = window.__SOCKET_MANAGER__ || window.io?.Manager?._managers;
    if (socketManager) {
      Object.values(socketManager).forEach(manager => {
        if (manager?.engine?.close) {
          manager.engine.close();
          setTimeout(() => manager.open?.(), 100);
        }
      });
      return;
    }
  } catch (e) {}

  // Método 3: Disparar evento de visibilidad para forzar reconexión
  try {
    document.dispatchEvent(new Event('visibilitychange'));
  } catch (e) {}

  // Si nada funciona, programar otro intento
  if (wsReconnectAttempt < WS_MAX_RECONNECT_ATTEMPTS) {
    scheduleReconnect();
  }
}

/**
 * V12: Método de fallback - recarga el iframe del gráfico
 */
function forceChartReconnect() {
  const chartFrame = document.querySelector('iframe[src*="chart"]');
  if (chartFrame) {
    try {
      chartFrame.contentWindow.location.reload();
    } catch(e) {
      // Si no podemos recargar el iframe, intentar recrearlo
      const parent = chartFrame.parentNode;
      const src = chartFrame.src;
      chartFrame.remove();
      const newFrame = document.createElement('iframe');
      newFrame.src = src;
      newFrame.style.cssText = chartFrame.style.cssText;
      parent?.appendChild(newFrame);
    }
  }
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
    entryWindowSec: config.entryWindowSec,
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

  // Switches principales
  DOM.swAuto.classList.toggle('active', config.autoTrade);
  DOM.swMg.classList.toggle('active', config.useMartingale);
  DOM.swInv.classList.toggle('active', config.invertTrade);
  if (DOM.swConfirm) DOM.swConfirm.classList.toggle('active', config.useConfirmation);
  if (DOM.swNext) DOM.swNext.classList.toggle('active', config.operateOnNext);
  if (DOM.swChart) DOM.swChart.classList.toggle('active', config.useChartData);

  // Inputs numéricos
  if (DOM.riskPct) DOM.riskPct.value = config.riskPct;
  if (DOM.mgSteps) DOM.mgSteps.value = config.mgMaxSteps;
  if (DOM.mgFactor) DOM.mgFactor.value = config.mgFactor;
  if (DOM.entrySec) DOM.entrySec.value = config.entrySec;
  if (DOM.timerDelay) DOM.timerDelay.value = config.timeOffset;
  if (DOM.mgBox) DOM.mgBox.style.display = config.useMartingale ? 'block' : 'none';

  // Stop Config
  if (config.stopConfig) {
    if (DOM.swTime) DOM.swTime.classList.toggle('active', config.stopConfig.useTime);
    if (DOM.swRisk) DOM.swRisk.classList.toggle('active', config.stopConfig.useRisk);
    if (DOM.swTrades) DOM.swTrades.classList.toggle('active', config.stopConfig.useTrades);
    if (DOM.sessionTime) DOM.sessionTime.value = config.stopConfig.timeMin || 60;
    if (DOM.profitTarget) DOM.profitTarget.value = config.stopConfig.profitPct || 10;
    if (DOM.stopLoss) DOM.stopLoss.value = config.stopConfig.stopLossPct || 10;
    if (DOM.maxWins) DOM.maxWins.value = config.stopConfig.maxWins || 5;
    if (DOM.maxLosses) DOM.maxLosses.value = config.stopConfig.maxLosses || 3;

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

// ============= NUEVO V12: CÁLCULO DE INDICADORES TÉCNICOS =============

/**
 * Calcula EMA (Exponential Moving Average)
 * @param {Array} candles - Array de velas
 * @param {number} period - Período de la EMA
 * @returns {number|null} - Valor de EMA o null si no hay suficientes datos
 */
function calculateEMA(candles, period) {
  if (!candles || candles.length < period) return null;

  const k = 2 / (period + 1);
  let ema = candles[0].c; // Iniciar con el primer cierre

  for (let i = 1; i < candles.length; i++) {
    ema = candles[i].c * k + ema * (1 - k);
  }

  return ema;
}

/**
 * Calcula ATR (Average True Range)
 * @param {Array} candles - Array de velas
 * @param {number} period - Período del ATR (default 14)
 * @returns {number|null} - Valor de ATR o null si no hay suficientes datos
 */
function calculateATR(candles, period = ATR_PERIOD) {
  if (!candles || candles.length < period + 1) return null;

  const trueRanges = [];

  for (let i = 1; i < candles.length; i++) {
    const curr = candles[i];
    const prev = candles[i - 1];

    const tr1 = curr.h - curr.l;                    // High - Low
    const tr2 = Math.abs(curr.h - prev.c);          // |High - Previous Close|
    const tr3 = Math.abs(curr.l - prev.c);          // |Low - Previous Close|

    trueRanges.push(Math.max(tr1, tr2, tr3));
  }

  // Calcular promedio de los últimos 'period' true ranges
  const recentTRs = trueRanges.slice(-period);
  const atr = recentTRs.reduce((sum, tr) => sum + tr, 0) / recentTRs.length;

  return atr;
}

/**
 * Actualiza todos los indicadores técnicos
 */
function updateIndicators() {
  const analysisCandles = getAnalysisCandles();

  if (analysisCandles.length < EMA_SLOW_PERIOD) {
    emaFast = null;
    emaSlow = null;
    atrValue = null;
    currentTrend = 'neutral';
    volatilityLevel = 'normal';
    return;
  }

  // Calcular EMAs
  emaFast = calculateEMA(analysisCandles, EMA_FAST_PERIOD);
  emaSlow = calculateEMA(analysisCandles, EMA_SLOW_PERIOD);

  // Calcular ATR
  atrValue = calculateATR(analysisCandles);

  // Calcular ATR promedio (para comparar volatilidad)
  if (analysisCandles.length >= ATR_PERIOD * 2) {
    const pastCandles = analysisCandles.slice(0, -ATR_PERIOD);
    atrAverage = calculateATR(pastCandles);
  }

  // Determinar tendencia basada en EMAs
  if (emaFast !== null && emaSlow !== null) {
    const emaDiff = (emaFast - emaSlow) / emaSlow * 100;
    if (emaDiff > 0.02) {
      currentTrend = 'bullish';
    } else if (emaDiff < -0.02) {
      currentTrend = 'bearish';
    } else {
      currentTrend = 'neutral';
    }
  }

  // Determinar nivel de volatilidad
  if (atrValue !== null && atrAverage !== null && atrAverage > 0) {
    const volRatio = atrValue / atrAverage;
    if (volRatio < 0.7) {
      volatilityLevel = 'low';
    } else if (volRatio > 1.5) {
      volatilityLevel = 'high';
    } else {
      volatilityLevel = 'normal';
    }
  }
}

/**
 * Verifica y actualiza el estado de warmup del sistema
 */
function checkWarmupStatus() {
  const analysisCandles = getAnalysisCandles();
  const candleCount = analysisCandles.length;

  // Calcular nivel de warmup (0-100%)
  systemWarmupLevel = Math.min(100, Math.round((candleCount / TARGET_CANDLES_FULL) * 100));

  // Sistema está listo cuando tiene suficientes velas para EMA 21
  const wasWarmedUp = isSystemWarmedUp;
  isSystemWarmedUp = candleCount >= TARGET_CANDLES_FULL;

  // Log cuando se complete el warmup
  if (isSystemWarmedUp && !wasWarmedUp) {
    logMonitor(`✅ Sistema 100% listo (${candleCount} velas)`, 'success');
  }

  // Actualizar indicadores si hay suficientes datos
  if (candleCount >= EMA_FAST_PERIOD) {
    updateIndicators();
  }

  return isSystemWarmedUp;
}

/**
 * Calcula el score de una señal (0-10)
 * @param {string} signalType - 'call' o 'put'
 * @param {string} strategy - Nombre de la estrategia que generó la señal
 * @returns {number} - Score de 0 a 10
 */
function calculateSignalScore(signalType, strategy) {
  let score = 0;

  // Base: Todas las señales empiezan con 3 puntos
  score += 3;

  // +2 puntos: Señal alineada con tendencia EMA
  if (currentTrend === 'bullish' && signalType === 'call') score += 2;
  if (currentTrend === 'bearish' && signalType === 'put') score += 2;

  // +1 punto: Tendencia neutral (mercado en rango, bueno para reversiones)
  if (currentTrend === 'neutral') score += 1;

  // +2 puntos: Volatilidad normal (ni muy baja ni muy alta)
  if (volatilityLevel === 'normal') score += 2;
  // +1 punto: Volatilidad baja (menos ruido)
  if (volatilityLevel === 'low') score += 1;
  // -1 punto: Volatilidad alta (más riesgo)
  if (volatilityLevel === 'high') score -= 1;

  // +2 puntos: Estrategias de alta probabilidad
  if (strategy.includes('Rechazo')) score += 2;
  if (strategy.includes('Engulfing')) score += 1;
  if (strategy.includes('PinBar')) score += 1;

  // +1 punto: Estrategias de ruptura confirmada
  if (strategy.includes('Breakout')) score += 1;

  // Verificar confluencia con niveles S/R
  const analysisCandles = getAnalysisCandles();
  if (analysisCandles.length >= 10) {
    const currentPrice = analysisCandles[analysisCandles.length - 1].c;
    const { supports, resistances } = getLevels(analysisCandles, analysisCandles.length - 1);

    // +1 punto por confluencia con nivel cercano
    if (signalType === 'call' && isNearLevel(currentPrice, supports, 0.0003)) score += 1;
    if (signalType === 'put' && isNearLevel(currentPrice, resistances, 0.0003)) score += 1;
  }

  // Asegurar que el score esté entre 0 y 10
  return Math.max(0, Math.min(10, score));
}

/**
 * Evalúa si se debe ejecutar martingala basado en análisis previo
 * @param {string} tradeType - 'call' o 'put'
 * @returns {boolean} - true si se debe ejecutar martingala
 */
function shouldExecuteMartingale(tradeType) {
  // Si el sistema no está listo, no ejecutar martingala
  if (!isSystemWarmedUp) {
    logMonitor('⏳ Martingala pausada - Sistema en warmup', 'info');
    return false;
  }

  // Verificar que la tendencia no esté fuertemente en contra
  if (currentTrend === 'bullish' && tradeType === 'put') {
    logMonitor('⚠️ Martingala cancelada - Tendencia alcista contra PUT', 'pattern');
    return false;
  }
  if (currentTrend === 'bearish' && tradeType === 'call') {
    logMonitor('⚠️ Martingala cancelada - Tendencia bajista contra CALL', 'pattern');
    return false;
  }

  // Verificar volatilidad
  if (volatilityLevel === 'high') {
    logMonitor('⚠️ Martingala pausada - Alta volatilidad', 'pattern');
    return false;
  }

  // Calcular score mínimo para martingala
  const score = calculateSignalScore(tradeType, 'Martingala');
  if (score < MIN_SCORE_MARTINGALE) {
    logMonitor(`⚠️ Martingala cancelada - Score ${score}/${MIN_SCORE_MARTINGALE}`, 'pattern');
    return false;
  }

  return true;
}

/**
 * Obtiene el precio actual del mercado
 * @returns {number|null} - Precio actual o null
 */
function getCurrentPrice() {
  // Primero intentar del WebSocket
  if (lastWsData && lastWsData.closePrice) {
    return lastWsData.closePrice;
  }

  // Luego de la vela actual
  if (currentCandle && currentCandle.c) {
    return currentCandle.c;
  }

  // Finalmente de las velas del gráfico
  const analysisCandles = getAnalysisCandles();
  if (analysisCandles.length > 0) {
    return analysisCandles[analysisCandles.length - 1].c;
  }

  return null;
}

// ============= DETECCIÓN DE SEÑALES (MEJORADA V12) =============
function detectSignal(liveCandle) {
  // V12: Verificar estado de warmup
  checkWarmupStatus();

  // V12: No operar si el sistema no está 100% listo
  if (!isSystemWarmedUp) {
    // Actualizar UI con estado de warmup (no bloquear análisis)
    return null;
  }

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
    // V12: Calcular score de la señal
    const score = calculateSignalScore(signal, strategy);

    // V12: Filtrar por score mínimo
    if (score < MIN_SCORE_TO_TRADE) {
      logMonitor(`⚠️ Señal ${signal.toUpperCase()} rechazada - Score ${score}/${MIN_SCORE_TO_TRADE}`, 'info');
      return null;
    }

    let displayType = signal;
    let note = '';
    if (config.invertTrade) {
      displayType = signal === 'call' ? 'put' : 'call';
      note = ' (INV)';
    }

    // MEJORADO: Mostrar fuente de datos y score en el log
    const sourceTag = chartAccessMethod !== 'websocket' ? ` [${chartAccessMethod}]` : '';
    const trendTag = currentTrend !== 'neutral' ? ` [${currentTrend.toUpperCase()}]` : '';
    logMonitor(`🚀 ${strategy} → ${displayType.toUpperCase()}${note} | Score: ${score}/10${trendTag}${sourceTag}`, 'pattern');

    return { d: signal, score: score, strategy: strategy };
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
  
  // Actualizar warmup UI
  updateWarmupUI();
  
  // Cambio de activo
  if (currentPair !== data.pair) {
    currentPair = data.pair;
    candles = [];
    chartCandles = [];
    currentCandle = null;
    pendingTrades = [];
    processed = 0;
    chartAccessMethod = 'none';
    // Contador de velas removido - usar warmup indicator
// if (DOM.uiCnt) DOM.uiCnt.textContent = `0/${TARGET_CANDLES}`;
    logMonitor(`Activo: ${currentPair}`, 'info');
    
    // Cargar histórico para el nuevo activo
    loadHistoricalData(currentPair).then(hist => {
      if (hist.length > 0) {
        candles = hist;
        chartCandles = hist.slice(); // Copiar también a chartCandles
        processed = hist.length;
        // Contador de velas removido - usar warmup indicator
// if (DOM.uiCnt) DOM.uiCnt.textContent = `${Math.min(processed, TARGET_CANDLES)}/${TARGET_CANDLES}`;
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
    // Contador de velas removido - usar warmup indicator
// if (DOM.uiCnt) DOM.uiCnt.textContent = `${Math.min(processed, TARGET_CANDLES)}/${TARGET_CANDLES}`;
    
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
    
    // Martingala V12: Verificar condiciones antes de ejecutar
    if (activeMartingaleTrade && config.useMartingale) {
      if (shouldExecuteMartingale(activeMartingaleTrade.type)) {
        logMonitor(`Martingala Nivel ${mgLevel}`, 'info');
        if (config.autoTrade) executeTrade(activeMartingaleTrade.type);
        // V12: Guardar precio de entrada real
        const entryPrice = getCurrentPrice();
        pendingTrades.push({ k: currentCandle.s, type: activeMartingaleTrade.type, entryPrice: entryPrice });
        tradeExecutedThisCandle = true;
        lastTradeType = activeMartingaleTrade.type;
      } else {
        // Martingala cancelada por condiciones desfavorables
        mgLevel = 0;
        stats.l++;
        sessionStats.l++;
        logMonitor('⛔ Martingala cancelada - Condiciones desfavorables', 'blocked');
      }
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

// ============= UI DE SEÑALES (CYBERPUNK STYLE) =============
function updateSignalUI(sec, key) {
  if (!DOM.signalBox || !DOM.signalStatus) return;

  // V12: Si el sistema no está listo, mostrar estado de carga
  if (!isSystemWarmedUp) {
    DOM.signalBox.className = 'sig-waiting';
    DOM.signalStatus.innerHTML = `
      <div class="signal-title" style="color:#ff00ff;font-size:12px">CARGANDO SISTEMA</div>
      <div class="signal-subtitle" style="color:#00ffff;font-size:9px">Esperando ${TARGET_CANDLES_FULL} velas...</div>`;
    return;
  }

  if (tradeExecutedThisCandle) {
    const isCall = lastTradeType === 'call';
    DOM.signalBox.className = isCall ? 'sig-possible-call' : 'sig-possible-put';
    DOM.signalStatus.innerHTML = `
      <div class="signal-title" style="color:${isCall ? '#00ff88' : '#ff0080'};font-size:14px">${isCall ? '▲ COMPRA' : '▼ VENTA'}</div>
      <div class="signal-subtitle" style="font-size:10px">ESPERANDO RESULTADO...</div>`;
    return;
  }

  if (pendingSignal) {
    let type = pendingSignal.d;
    const score = pendingSignal.score || 0;
    if (config.invertTrade) type = type === 'call' ? 'put' : 'call';

    const isCall = type === 'call';
    const triggerSec = 60 - config.entrySec;
    const windowSize = config.entryWindowSec || 3;

    if (sec <= triggerSec && sec > (triggerSec - windowSize)) {
      DOM.signalBox.className = isCall ? 'sig-entry-call' : 'sig-entry-put';
      DOM.signalStatus.innerHTML = `
        <div class="signal-title" style="color:${isCall ? '#00ff88' : '#ff0080'};font-size:16px">${isCall ? '▲▲ COMPRA ▲▲' : '▼▼ VENTA ▼▼'}</div>
        <div class="entry-countdown" style="color:${isCall ? '#00ff88' : '#ff0080'}">¡¡ ENTRAR AHORA !!</div>
        <div style="font-size:9px;margin-top:4px;color:#fff">Score: ${score}/10 | ${currentTrend.toUpperCase()}</div>`;

      if (!tradeExecutedThisCandle) {
        tradeExecutedThisCandle = true;
        lastTradeType = type;
        const tKey = key + 60000;
        if (!pendingTrades.some(t => t.k === tKey)) {
          const entryPrice = getCurrentPrice();
          pendingTrades.push({ k: tKey, type: type, entryPrice: entryPrice });
          if (config.autoTrade) executeTrade(type);
          else logMonitor(`Señal manual: ${type.toUpperCase()} @ ${entryPrice}`, 'success');
        }
      }
    } else {
      DOM.signalBox.className = 'sig-anticipation';
      DOM.signalStatus.innerHTML = `
        <div class="anticipation-badge" style="color:${isCall ? '#00ff88' : '#ff0080'};padding:4px 10px">
          PREPARAR ${isCall ? '▲ CALL' : '▼ PUT'}
        </div>
        <div style="font-size:11px;margin-top:6px;color:#fff">Entrada: <span style="color:#ffff00;font-weight:700">${sec}s</span></div>
        <div style="font-size:9px;margin-top:2px;color:#aaa">Score: ${score}/10</div>`;
    }
  } else {
    DOM.signalBox.className = 'sig-waiting';
    DOM.signalStatus.innerHTML = `
      <div class="signal-title" style="color:#00ffff;font-size:11px">ANALIZANDO MERCADO</div>
      <div class="signal-subtitle" style="color:#888;font-size:9px">Buscando oportunidades...</div>`;
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
  // Validar que autoTrade esté activo
  if (!config.autoTrade) {
    logMonitor('AutoTrade desactivado', 'info');
    return false;
  }

  // Validar tipo de trade
  if (type !== 'call' && type !== 'put') {
    logMonitor(`Tipo de trade inválido: ${type}`, 'blocked');
    return false;
  }

  // SEGURIDAD: Validar conexión WebSocket
  if (!wsConnected) {
    logMonitor('⚠️ Sin conexión WebSocket - Trade cancelado', 'blocked');
    return false;
  }

  // SEGURIDAD: Evitar trades muy rápidos (anti-spam)
  const now = Date.now();
  if (now - lastTradeTime < MIN_TRADE_INTERVAL) {
    const waitTime = Math.ceil((MIN_TRADE_INTERVAL - (now - lastTradeTime)) / 1000);
    logMonitor(`⏳ Espera ${waitTime}s entre trades`, 'info');
    return false;
  }

  // SEGURIDAD: Pausa automática por pérdidas consecutivas
  if (consecutiveLosses >= MAX_CONSECUTIVE_LOSSES) {
    logMonitor(`⛔ Pausa automática: ${consecutiveLosses} pérdidas consecutivas`, 'blocked');
    logMonitor('Desactiva y activa AutoTrade para continuar', 'info');
    return false;
  }

  // Validar balance mínimo
  if (balance <= 0) {
    logMonitor('Balance insuficiente para operar', 'blocked');
    return false;
  }

  // Calcular y configurar monto
  calcAmount();

  // Validar monto mínimo
  if (currentAmt < 1) {
    logMonitor('Monto mínimo es $1.00', 'blocked');
    currentAmt = 1;
  }

  // Validar que el monto no exceda el balance
  if (currentAmt > balance) {
    logMonitor(`Monto ajustado al balance: $${balance.toFixed(2)}`, 'info');
    currentAmt = balance;
  }

  // SEGURIDAD: Advertencia en cuenta real
  if (!isDemo && currentAmt > balance * 0.1) {
    logMonitor(`⚠️ CUENTA REAL: Trade de ${((currentAmt/balance)*100).toFixed(1)}% del balance`, 'pattern');
  }

  // Configurar monto en la UI del broker
  const amountSet = setTradeAmount(currentAmt);
  if (!amountSet) {
    logMonitor('No se pudo configurar el monto', 'blocked');
  }

  // Actualizar timestamp del último trade
  lastTradeTime = now;

  logMonitor(`Ejecutando ${type.toUpperCase()} - $${currentAmt.toFixed(2)}`, 'success');

  // Ejecutar el trade con retry logic
  executeTradeWithRetry(type, 3);
  return true;
}

function executeTradeWithRetry(type, maxRetries) {
  let retries = 0;

  const attemptClick = () => {
    try {
      // Selectores para los botones del broker Worbit
      const selectors = type === 'call'
        ? ['.buy-button', '[class*="buy"]', 'button:has-text("ARRIBA")']
        : ['.sell-button', '[class*="sell"]', 'button:has-text("ABAJO")'];

      let targetButton = null;

      // Intentar con cada selector
      for (const selector of selectors) {
        try {
          targetButton = document.querySelector(selector);
          if (targetButton && !targetButton.disabled) break;
        } catch (e) {
          // Selector inválido, continuar con el siguiente
        }
      }

      if (targetButton && !targetButton.disabled) {
        // Agregar pequeño delay aleatorio para parecer más humano
        const delay = 50 + Math.random() * 100;
        setTimeout(() => {
          targetButton.click();
          logMonitor(`✅ Trade ejecutado: ${type.toUpperCase()}`, 'success');
        }, delay);
        return true;
      } else if (retries < maxRetries) {
        retries++;
        logMonitor(`Reintentando click (${retries}/${maxRetries})...`, 'info');
        setTimeout(attemptClick, 200);
        return false;
      } else {
        logMonitor(`❌ Botón ${type.toUpperCase()} no encontrado después de ${maxRetries} intentos`, 'blocked');
        return false;
      }
    } catch (e) {
      logMonitor(`❌ Error ejecutando trade: ${e.message}`, 'blocked');
      return false;
    }
  };

  // Iniciar después de un pequeño delay
  setTimeout(attemptClick, 100);
}

// ============= VERIFICACIÓN DE RESULTADOS (V12: PRECIO DE ENTRADA REAL) =============
function checkTradeResults(candle) {
  const toRemove = [];
  pendingTrades.forEach((t, i) => {
    if (t.k === candle.s) {
      // V12: Usar precio de entrada real en lugar del precio de apertura de la vela
      const referencePrice = t.entryPrice || candle.o; // Fallback a candle.o para compatibilidad

      const winCall = t.type === 'call' && candle.c > referencePrice;
      const winPut = t.type === 'put' && candle.c < referencePrice;
      const isWin = winCall || winPut;
      const isDraw = candle.c === referencePrice;

      // V12: Log detallado del resultado
      const priceChange = ((candle.c - referencePrice) / referencePrice * 100).toFixed(4);
      const direction = candle.c > referencePrice ? '↑' : candle.c < referencePrice ? '↓' : '→';

      if (isWin) {
        stats.w++;
        sessionStats.w++;
        consecutiveLosses = 0;  // Resetear contador de pérdidas consecutivas
        mgLevel = 0;
        activeMartingaleTrade = null;
        logMonitor(`✅ GANADA ${direction}${priceChange}% (${referencePrice.toFixed(2)} → ${candle.c.toFixed(2)})`, 'success');
      } else if (!isDraw) {
        consecutiveLosses++;  // Incrementar contador de pérdidas consecutivas
        if (config.useMartingale) {
          const stopLossTrigger = (t.type === 'call' && isStrongMomentum(candles, 'bearish')) ||
                                  (t.type === 'put' && isStrongMomentum(candles, 'bullish'));
          if (stopLossTrigger) {
            stats.l++;
            sessionStats.l++;
            mgLevel = 0;
            activeMartingaleTrade = null;
            logMonitor(`⛔ Momentum en contra - Stop ${direction}${priceChange}%`, 'blocked');
          } else if (mgLevel < config.mgMaxSteps) {
            mgLevel++;
            activeMartingaleTrade = { type: t.type };
            logMonitor(`❌ PERDIDA ${direction}${priceChange}% - Martingala ${mgLevel}/${config.mgMaxSteps}`, 'blocked');
          } else {
            stats.l++;
            sessionStats.l++;
            mgLevel = 0;
            activeMartingaleTrade = null;
            logMonitor(`⛔ Max Martingala - Stop ${direction}${priceChange}%`, 'blocked');
          }
        } else {
          stats.l++;
          sessionStats.l++;
          logMonitor(`❌ PERDIDA ${direction}${priceChange}% (${referencePrice.toFixed(2)} → ${candle.c.toFixed(2)})`, 'blocked');
        }
        // Advertir sobre pérdidas consecutivas
        if (consecutiveLosses >= 3) {
          logMonitor(`⚠️ ${consecutiveLosses} pérdidas consecutivas`, 'pattern');
        }
      } else {
        logMonitor(`↔️ EMPATE @ ${referencePrice.toFixed(2)}`, 'info');
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

/**
 * V12: Actualiza la UI del indicador de warmup
 */
function updateWarmupUI() {
  // Mostrar/ocultar barra de warmup dinámicamente en el signal-box
  if (DOM.warmupContainer) {
    if (isSystemWarmedUp) {
      // Ocultar barra cuando el sistema está listo
      DOM.warmupContainer.style.display = 'none';
    } else if (botActive) {
      // Mostrar barra solo cuando el bot está activo y cargando
      DOM.warmupContainer.style.display = 'block';
    }
  }

  // Actualizar porcentaje
  if (DOM.warmupPct) {
    DOM.warmupPct.textContent = `${systemWarmupLevel}%`;
  }

  // Actualizar barra de progreso
  if (DOM.warmupBarFill) {
    DOM.warmupBarFill.style.width = `${systemWarmupLevel}%`;
  }

  // Actualizar texto de estado
  if (DOM.warmupText) {
    if (isSystemWarmedUp) {
      DOM.warmupText.textContent = 'Listo';
    } else {
      const analysisCandles = getAnalysisCandles();
      DOM.warmupText.textContent = `Velas ${analysisCandles.length}/${TARGET_CANDLES_FULL}`;
    }
  }

  // Actualizar indicadores técnicos en el info-grid
  if (DOM.indEma) {
    if (emaFast !== null && emaSlow !== null) {
      const diff = ((emaFast - emaSlow) / emaSlow * 100).toFixed(2);
      DOM.indEma.textContent = `${diff > 0 ? '+' : ''}${diff}%`;
      DOM.indEma.style.color = diff > 0 ? '#00ff88' : diff < 0 ? '#ff5555' : '#888';
    } else {
      DOM.indEma.textContent = '--';
      DOM.indEma.style.color = '#888';
    }
  }

  if (DOM.indAtr) {
    if (atrValue !== null) {
      DOM.indAtr.textContent = atrValue.toFixed(4);
      DOM.indAtr.style.color = volatilityLevel === 'high' ? '#ff5555' : volatilityLevel === 'low' ? '#888' : '#ff00ff';
    } else {
      DOM.indAtr.textContent = '--';
      DOM.indAtr.style.color = '#888';
    }
  }

  if (DOM.indTrend) {
    DOM.indTrend.textContent = currentTrend.toUpperCase();
    DOM.indTrend.style.color = currentTrend === 'bullish' ? '#00ff88' : currentTrend === 'bearish' ? '#ff5555' : '#ffff00';
  }
}

function readAccount() {
  try {
    let foundBalance = false;
    let foundAccountType = false;
    let newBalance = 0;
    let newIsDemo = isDemo;

    // ============= MÉTODO PRIORITARIO: BUSCAR "Cuenta demo/real $X,XXX.XX" EN HEADER =============
    try {
      // Buscar el texto "Cuenta demo" o "Cuenta real" seguido del saldo
      const headerElements = document.querySelectorAll('header *, [class*="header"] *, [class*="nav"] *');
      for (const el of headerElements) {
        if (el.children.length === 0 || el.tagName === 'SPAN' || el.tagName === 'DIV') {
          const text = el.textContent || '';

          // Buscar patrón "Cuenta demo" o "Cuenta real"
          const accountMatch = text.match(/cuenta\s*(demo|real)/i);
          if (accountMatch) {
            newIsDemo = accountMatch[1].toLowerCase() === 'demo';
            foundAccountType = true;

            // Buscar el saldo cercano (puede estar en el mismo elemento o en un hermano)
            const balanceMatch = text.match(/\$\s*([\d,]+\.?\d*)/);
            if (balanceMatch) {
              let balanceStr = balanceMatch[1].replace(/,/g, '');
              const parsedBalance = parseFloat(balanceStr);
              if (!isNaN(parsedBalance) && parsedBalance > 0) {
                newBalance = parsedBalance;
                foundBalance = true;
                break;
              }
            }

            // Si no encontró saldo en el mismo elemento, buscar en elementos cercanos
            if (!foundBalance) {
              const parent = el.parentElement;
              if (parent) {
                const siblingText = parent.textContent || '';
                const sibBalanceMatch = siblingText.match(/\$\s*([\d,]+\.?\d*)/);
                if (sibBalanceMatch) {
                  let balanceStr = sibBalanceMatch[1].replace(/,/g, '');
                  const parsedBalance = parseFloat(balanceStr);
                  if (!isNaN(parsedBalance) && parsedBalance > 0) {
                    newBalance = parsedBalance;
                    foundBalance = true;
                    break;
                  }
                }
              }
            }
          }
        }
      }
    } catch (e) {
      console.log('Error buscando en header:', e);
    }

    // ============= MÉTODO 2: ZUSTAND STORE (localStorage) =============
    if (!foundBalance || !foundAccountType) {
      try {
        const walletStore = localStorage.getItem('wallet-store');
        if (walletStore) {
          const parsed = JSON.parse(walletStore);
          if (parsed && parsed.state) {
            if (typeof parsed.state.isDemo !== 'undefined' && !foundAccountType) {
              newIsDemo = parsed.state.isDemo;
              foundAccountType = true;
            }

            if (parsed.state.wallets && Array.isArray(parsed.state.wallets) && !foundBalance) {
              const accountType = newIsDemo ? 'DEMO' : 'REAL';
              const wallet = parsed.state.wallets.find(w => w.type === accountType);
              if (wallet && typeof wallet.balance !== 'undefined') {
                let rawBalance = wallet.balance;
                if (typeof rawBalance === 'string') {
                  rawBalance = rawBalance.replace(/[^0-9.-]/g, '');
                }
                let parsedBal = parseFloat(rawBalance) || 0;
                if (parsedBal > 10000 && parsedBal.toString().length >= 6) {
                  parsedBal = parsedBal / 100;
                }
                if (parsedBal > 0) {
                  newBalance = parsedBal;
                  foundBalance = true;
                }
              }
            }
          }
        }
      } catch (e) {}
    }

    // ============= MÉTODO 3: BUSCAR CUALQUIER SALDO VISIBLE EN HEADER =============
    if (!foundBalance) {
      try {
        // Buscar elementos que contengan "$" y números en el header
        const headerArea = document.querySelector('header') || document.querySelector('[class*="header"]');
        if (headerArea) {
          const textContent = headerArea.textContent || '';
          const allBalances = textContent.match(/\$\s*([\d,]+\.?\d*)/g);
          if (allBalances && allBalances.length > 0) {
            // Tomar el primer saldo que parezca razonable (mayor a $1)
            for (const match of allBalances) {
              const numStr = match.replace(/[$,\s]/g, '');
              const num = parseFloat(numStr);
              if (!isNaN(num) && num > 1 && num < 10000000) {
                newBalance = num;
                foundBalance = true;
                break;
              }
            }
          }
        }
      } catch (e) {}
    }

    // ============= MÉTODO 4: SELECTORES ESPECÍFICOS DE WORBIT =============
    if (!foundBalance) {
      try {
        const specificSelectors = [
          '[class*="account-value"]',
          '[class*="balance-value"]',
          '[class*="wallet-balance"]',
          '[class*="_balance_"]',
          '[class*="money-value"]'
        ];

        for (const selector of specificSelectors) {
          const elements = document.querySelectorAll(selector);
          for (const el of elements) {
            const text = el.textContent || '';
            const match = text.match(/([\d,]+\.?\d*)/);
            if (match) {
              const num = parseFloat(match[1].replace(/,/g, ''));
              if (!isNaN(num) && num > 0) {
                newBalance = num;
                foundBalance = true;
                break;
              }
            }
          }
          if (foundBalance) break;
        }
      } catch (e) {}
    }

    // Si no se detectó tipo de cuenta, asumir DEMO por seguridad
    if (!foundAccountType) {
      newIsDemo = true;
    }

    // ============= ACTUALIZAR ESTADO Y UI =============
    // Solo actualizar y loguear si hay cambios o es la primera vez
    const balanceChanged = Math.abs(newBalance - lastLoggedBalance) > 0.01;
    const shouldLog = foundBalance && (!balanceLoaded || balanceChanged);

    if (foundBalance) {
      balance = newBalance;
      isDemo = newIsDemo;

      if (shouldLog) {
        logMonitor(`✓ Cuenta ${isDemo ? 'DEMO' : 'REAL'}: $${balance.toFixed(2)}`, 'success');
        lastLoggedBalance = balance;
        balanceLoaded = true;
      }
    }

    // Actualizar UI siempre
    if (DOM.accType) {
      DOM.accType.textContent = isDemo ? 'DEMO' : 'REAL';
      DOM.accType.style.background = isDemo ? 'rgba(241,196,15,.2)' : 'rgba(0,230,118,.2)';
      DOM.accType.style.color = isDemo ? '#f1c40f' : '#00e676';
    }
    if (DOM.accBal) {
      DOM.accBal.textContent = `$${balance.toFixed(2)}`;
      DOM.accBal.style.color = balance > 0 ? '#fff' : '#ff0080';
    }

    // Log de errores solo la primera vez
    if (!balanceLoaded && !foundBalance) {
      logMonitor('⚠ No se pudo detectar saldo', 'blocked');
    }

  } catch (e) {
    if (!balanceLoaded) {
      logMonitor('❌ Error en readAccount: ' + e.message, 'blocked');
    }
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
        // Contador de velas removido - usar warmup indicator
// if (DOM.uiCnt) DOM.uiCnt.textContent = `${Math.min(processed, TARGET_CANDLES)}/${TARGET_CANDLES}`;
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
#worbit-hud{position:fixed;top:10px;right:20px;width:320px;max-height:calc(100vh - 20px);background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);border-radius:14px;box-shadow:0 0 20px rgba(0,255,255,.4),0 0 40px rgba(0,255,255,.2),0 10px 40px rgba(0,0,0,.6);z-index:999999;font-family:'Segoe UI',system-ui,sans-serif;display:none;border:1px solid rgba(0,255,255,.3);animation:hud-glow 3s ease-in-out infinite;overflow:hidden;display:flex;flex-direction:column}
#worbit-hud.visible{display:flex}
#worbit-hud::-webkit-scrollbar{width:3px}
#worbit-hud::-webkit-scrollbar-track{background:transparent}
#worbit-hud::-webkit-scrollbar-thumb{background:rgba(0,255,255,.2);border-radius:2px}
@keyframes hud-glow{0%,100%{box-shadow:0 0 20px rgba(0,255,255,.4),0 0 40px rgba(0,255,255,.2),0 10px 40px rgba(0,0,0,.6)}50%{box-shadow:0 0 30px rgba(0,255,255,.6),0 0 60px rgba(0,255,255,.3),0 10px 40px rgba(0,0,0,.6)}}
.hud-header{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:linear-gradient(90deg,#0f3460 0%,#16213e 100%);border-bottom:1px solid rgba(0,255,255,.2);cursor:grab}
.hud-title{display:flex;align-items:center;gap:8px;font-weight:700;font-size:13px;color:#fff;text-transform:uppercase;letter-spacing:1px}
.hud-version{font-size:9px;color:#00ffff;font-weight:400;text-shadow:0 0 10px #00ffff}
.dot{width:8px;height:8px;border-radius:50%;background:#e74c3c;box-shadow:0 0 6px #e74c3c;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
.close-btn{background:none;border:none;color:#888;cursor:pointer;font-size:16px;padding:2px 6px;border-radius:4px}
.close-btn:hover{background:rgba(255,255,255,.1);color:#fff}
.hud-body{padding:12px 16px;flex:1;overflow-y:auto;overflow-x:hidden}
.hud-body::-webkit-scrollbar{width:4px}
.hud-body::-webkit-scrollbar-track{background:transparent}
.hud-body::-webkit-scrollbar-thumb{background:rgba(0,255,255,.3);border-radius:2px}
.account-info{display:flex;gap:10px;margin-bottom:12px;align-items:center}
.acc-badge{padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;background:rgba(241,196,15,.2);color:#f1c40f}
.acc-balance{font-size:16px;font-weight:700;color:#fff}
.live-price{font-size:10px;padding:2px 6px;border-radius:4px;margin-left:auto}
.price-up{background:rgba(0,230,118,.2);color:#00e676}
.price-down{background:rgba(231,76,60,.2);color:#e74c3c}
.stats-row{display:flex;gap:8px;margin-bottom:12px}
.stat-item{flex:1;text-align:center;background:rgba(255,255,255,.05);padding:8px 6px;border-radius:8px}
.stat-val{font-size:16px;font-weight:700;color:#fff}
.stat-label{font-size:9px;color:#666;text-transform:uppercase;margin-top:2px}
.stat-val.win{color:#00e676}
.stat-val.loss{color:#e74c3c}
.section-header{display:flex;align-items:center;justify-content:space-between;padding:6px 0;cursor:pointer;border-top:1px solid rgba(255,255,255,.05);margin-top:6px}
.section-title{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px}
.section-toggle{color:#666;font-size:9px;transition:transform .2s}
.section-toggle.open{transform:rotate(180deg)}
.config-panel{display:none;padding:10px 0;max-height:350px;overflow-y:auto}
.config-panel.visible{display:block}
.config-panel::-webkit-scrollbar{width:3px}
.config-panel::-webkit-scrollbar-track{background:transparent}
.config-panel::-webkit-scrollbar-thumb{background:rgba(0,255,255,.2);border-radius:2px}
.config-row{display:flex;align-items:center;gap:6px;margin-bottom:6px}
.config-label{font-size:10px;color:#aaa;flex:1}
.config-input{width:55px;padding:4px 6px;border:1px solid rgba(255,255,255,.1);border-radius:5px;background:rgba(0,0,0,.3);color:#fff;font-size:11px;text-align:center}
.config-input:focus{outline:none;border-color:#00ffff}
.switch-box{display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,.05);padding:8px 12px;border-radius:8px;cursor:pointer;transition:all .2s;margin-bottom:6px}
.switch-box:hover{background:rgba(255,255,255,.1)}
.switch-box.active{background:rgba(0,255,255,.15);border:1px solid rgba(0,255,255,.3)}
.switch-box.active .switch-label{color:#00ffff}
.switch-label{font-size:10px;color:#aaa}
.switch-toggle{width:32px;height:18px;background:rgba(255,255,255,.1);border-radius:9px;position:relative;transition:all .2s}
.switch-toggle::after{content:'';position:absolute;width:14px;height:14px;background:#666;border-radius:50%;top:2px;left:2px;transition:all .2s}
.switch-box.active .switch-toggle{background:rgba(0,255,255,.3)}
.switch-box.active .switch-toggle::after{left:16px;background:#00ffff;box-shadow:0 0 6px #00ffff}
.timer-section{background:rgba(0,0,0,.2);border-radius:10px;padding:10px;margin-bottom:12px}
.timer-header{display:flex;justify-content:space-between;margin-bottom:4px;font-size:10px;color:#aaa}
.session-timer{color:#00ffff;text-shadow:0 0 5px #00ffff}
#timer-bar-bg{height:3px;background:rgba(255,255,255,.1);border-radius:2px;overflow:hidden}
#timer-bar-fill{height:100%;width:0;background:#00ffff;transition:width .3s,background .3s;box-shadow:0 0 8px #00ffff}
.info-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px}
.stat-box{background:rgba(255,255,255,.05);padding:8px 4px;border-radius:8px;text-align:center}
.stat-box .stat-label{font-size:9px;color:#666;text-transform:uppercase;margin-bottom:2px}
.stat-box .stat-val{font-size:11px;font-weight:600;color:#fff}
#signal-box{padding:16px;border-radius:12px;text-align:center;margin-bottom:12px;background:linear-gradient(135deg,rgba(0,0,0,.4) 0%,rgba(0,0,0,.2) 100%);transition:all .3s;border:2px solid transparent;min-height:80px}
.sig-waiting{border:2px dashed rgba(0,255,255,.3);background:linear-gradient(135deg,rgba(0,20,40,.6) 0%,rgba(0,10,30,.4) 100%)}
.sig-anticipation{background:linear-gradient(135deg,rgba(255,0,255,.2) 0%,rgba(0,255,255,.1) 100%);border:2px solid rgba(255,0,255,.5);box-shadow:0 0 20px rgba(255,0,255,.3),inset 0 0 30px rgba(255,0,255,.1)}
.sig-possible-call{background:linear-gradient(135deg,rgba(0,255,136,.25) 0%,rgba(0,255,255,.15) 100%);border:2px solid #00ff88;box-shadow:0 0 25px rgba(0,255,136,.4);animation:neon-call 1.5s ease-in-out infinite}
.sig-possible-put{background:linear-gradient(135deg,rgba(255,0,128,.25) 0%,rgba(255,0,255,.15) 100%);border:2px solid #ff0080;box-shadow:0 0 25px rgba(255,0,128,.4);animation:neon-put 1.5s ease-in-out infinite}
.sig-entry-call{background:linear-gradient(135deg,rgba(0,255,136,.4) 0%,rgba(0,255,255,.2) 100%);border:3px solid #00ff88;box-shadow:0 0 40px rgba(0,255,136,.6),0 0 80px rgba(0,255,136,.3);animation:neon-entry-call .5s ease-in-out infinite}
.sig-entry-put{background:linear-gradient(135deg,rgba(255,0,128,.4) 0%,rgba(255,0,255,.2) 100%);border:3px solid #ff0080;box-shadow:0 0 40px rgba(255,0,128,.6),0 0 80px rgba(255,0,128,.3);animation:neon-entry-put .5s ease-in-out infinite}
@keyframes neon-call{0%,100%{box-shadow:0 0 25px rgba(0,255,136,.4)}50%{box-shadow:0 0 35px rgba(0,255,136,.6)}}
@keyframes neon-put{0%,100%{box-shadow:0 0 25px rgba(255,0,128,.4)}50%{box-shadow:0 0 35px rgba(255,0,128,.6)}}
@keyframes neon-entry-call{0%,100%{box-shadow:0 0 40px rgba(0,255,136,.6)}50%{box-shadow:0 0 60px rgba(0,255,136,.8)}}
@keyframes neon-entry-put{0%,100%{box-shadow:0 0 40px rgba(255,0,128,.6)}50%{box-shadow:0 0 60px rgba(255,0,128,.8)}}
.signal-title{font-size:16px;font-weight:800;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;text-shadow:0 0 15px currentColor}
.signal-subtitle{font-size:10px;opacity:.8}
.anticipation-badge{display:inline-block;padding:6px 14px;background:linear-gradient(135deg,rgba(255,0,255,.4) 0%,rgba(0,255,255,.3) 100%);border-radius:20px;font-size:12px;font-weight:700;color:#fff;text-shadow:0 0 10px #ff00ff;border:1px solid rgba(255,0,255,.5);animation:badge-pulse 1s ease-in-out infinite}
@keyframes badge-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.03)}}
.entry-countdown{margin-top:6px;font-size:12px;font-weight:700;color:#fff;animation:blink .3s infinite;text-shadow:0 0 10px currentColor}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
.warmup-bar{height:4px;background:rgba(255,255,255,.1);border-radius:2px;overflow:hidden;margin:8px 0}
.warmup-bar-fill{height:100%;background:linear-gradient(90deg,#ff00ff 0%,#00ffff 50%,#00ff88 100%);transition:width .3s;border-radius:2px}
.monitor-container{margin-bottom:12px}
#monitor-box{max-height:0;overflow:hidden;transition:max-height .3s;background:rgba(0,0,0,.3);border-radius:8px}
#monitor-box.visible{max-height:200px;overflow-y:auto;padding:8px}
#monitor-box::-webkit-scrollbar{width:3px}
#monitor-box::-webkit-scrollbar-thumb{background:rgba(0,255,255,.2);border-radius:2px}
.monitor-line{font-size:9px;padding:2px 0;border-bottom:1px solid rgba(255,255,255,.03);display:flex;gap:6px}
.monitor-time{color:#666;font-family:monospace}
.monitor-info{color:#aaa}
.monitor-success{color:#00ff88;text-shadow:0 0 5px #00ff88}
.monitor-blocked{color:#ff0080;text-shadow:0 0 5px #ff0080}
.monitor-pattern{color:#ffff00;text-shadow:0 0 5px #ffff00}
.btn-main{width:100%;padding:14px;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;text-transform:uppercase;letter-spacing:1px;transition:all .2s}
.btn-start{background:linear-gradient(135deg,#00ffff 0%,#00ff88 100%);color:#000;box-shadow:0 0 15px rgba(0,255,255,.4)}
.btn-start:hover{background:linear-gradient(135deg,#00ff88 0%,#00ffff 100%);transform:translateY(-1px);box-shadow:0 0 25px rgba(0,255,255,.6)}
.btn-stop{background:linear-gradient(135deg,#ff0080 0%,#ff00ff 100%);color:#fff;box-shadow:0 0 15px rgba(255,0,128,.4)}
.btn-stop:hover{background:linear-gradient(135deg,#ff00ff 0%,#ff0080 100%);box-shadow:0 0 25px rgba(255,0,128,.6)}
.indicator-item{font-size:8px;padding:2px 4px;background:rgba(0,0,0,.3);border-radius:4px;color:#888;border:1px solid rgba(255,255,255,.1)}
.indicator-item.bullish{background:rgba(0,255,136,.15);color:#00ff88;border-color:rgba(0,255,136,.3)}
.indicator-item.bearish{background:rgba(255,0,128,.15);color:#ff0080;border-color:rgba(255,0,128,.3)}
.indicator-item.neutral{background:rgba(255,255,0,.15);color:#ffff00;border-color:rgba(255,255,0,.3)}
.config-section-title{font-size:9px;color:#00ffff;margin:10px 0 6px;padding-bottom:3px;border-bottom:1px solid rgba(0,255,255,.2);text-transform:uppercase;letter-spacing:1px}
.stop-group{margin-left:15px;padding:6px;background:rgba(0,0,0,.2);border-radius:6px;margin-bottom:6px}
.stop-group.disabled-group{opacity:.4;pointer-events:none}
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
    <div class="config-section-title">MODO DE OPERACIÓN</div>
    <div class="switch-box" id="sw-auto">
      <span class="switch-label">Auto Trading</span>
      <div class="switch-toggle"></div>
    </div>
    <div class="switch-box" id="sw-mg">
      <span class="switch-label">Martingala</span>
      <div class="switch-toggle"></div>
    </div>
    <div class="switch-box" id="sw-inv">
      <span class="switch-label">Invertir Señales</span>
      <div class="switch-toggle"></div>
    </div>
    <div class="switch-box" id="sw-confirm">
      <span class="switch-label">Confirmación Extra</span>
      <div class="switch-toggle"></div>
    </div>
    <div class="switch-box" id="sw-next">
      <span class="switch-label">Operar Siguiente Vela</span>
      <div class="switch-toggle"></div>
    </div>
    <div class="switch-box" id="sw-chart">
      <span class="switch-label">Usar Datos del Gráfico</span>
      <div class="switch-toggle"></div>
    </div>

    <div class="config-section-title">PARÁMETROS</div>
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
      <input type="number" class="config-input" id="entry-sec" value="57" min="50" max="59">
    </div>
    <div class="config-row">
      <span class="config-label">Offset Timer (ms)</span>
      <input type="number" class="config-input" id="timer-delay" value="0" min="-5000" max="5000" step="100">
    </div>

    <div class="config-section-title">STOP AUTOMÁTICO</div>
    <div class="switch-box" id="sw-time">
      <span class="switch-label">Por Tiempo</span>
      <div class="switch-toggle"></div>
    </div>
    <div class="stop-group disabled-group" id="grp-time">
      <div class="config-row">
        <span class="config-label">Minutos</span>
        <input type="number" class="config-input" id="session-time" value="60" min="1" max="480">
      </div>
    </div>
    <div class="switch-box" id="sw-risk">
      <span class="switch-label">Por Riesgo</span>
      <div class="switch-toggle"></div>
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
    <div class="switch-box" id="sw-trades">
      <span class="switch-label">Por Trades</span>
      <div class="switch-toggle"></div>
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

  <div class="timer-section">
    <div class="timer-header">
      <span id="timer-text">⏱ Cierre: --s</span>
      <span id="ui-runtime" class="session-timer">00h 00m</span>
    </div>
    <div id="timer-bar-bg"><div id="timer-bar-fill"></div></div>
  </div>

  <div class="info-grid">
    <div class="stat-box"><div class="stat-label">ACTIVO</div><div class="stat-val" id="ui-active" style="color:#00ffff;font-size:9px;text-shadow:0 0 5px #00ffff">--</div></div>
    <div class="stat-box"><div class="stat-label">EMA</div><div class="stat-val" id="ind-ema" style="color:#00ff88">--</div></div>
    <div class="stat-box"><div class="stat-label">ATR</div><div class="stat-val" id="ind-atr" style="color:#ff00ff">--</div></div>
    <div class="stat-box"><div class="stat-label">TREND</div><div class="stat-val" id="ind-trend" style="color:#ffff00">--</div></div>
  </div>
  <div class="info-grid" id="mg-row" style="display:none;grid-template-columns:1fr">
    <div class="stat-box" id="mg-box"><div class="stat-label">NIVEL MG</div><div class="stat-val" id="ui-mg" style="color:#ff00ff;text-shadow:0 0 5px #ff00ff">0</div></div>
  </div>

  <div id="signal-box">
    <div class="warmup-bar-container" id="warmup-container" style="display:none;margin-bottom:8px">
      <div class="warmup-header" style="display:flex;justify-content:space-between;font-size:9px;margin-bottom:3px">
        <span id="warmup-text" style="color:#888">Cargando...</span>
        <span id="warmup-pct" style="color:#00ffff">0%</span>
      </div>
      <div class="warmup-bar-bg" style="height:4px;background:rgba(255,255,255,.1);border-radius:2px;overflow:hidden">
        <div id="warmup-bar-fill" style="width:0%;height:100%;background:linear-gradient(90deg,#00ffff,#00ff88);border-radius:2px;transition:width .3s"></div>
      </div>
    </div>
    <div class="signal-status" id="signal-status" style="font-size:11px;color:#00ffff">INICIAR PARA ANALIZAR</div>
  </div>

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
      // Switches de configuración
      swAuto: $('sw-auto'),
      swMg: $('sw-mg'),
      swInv: $('sw-inv'),
      swConfirm: $('sw-confirm'),
      swNext: $('sw-next'),
      swChart: $('sw-chart'),
      swTime: $('sw-time'),
      swRisk: $('sw-risk'),
      swTrades: $('sw-trades'),
      // Inputs de configuración
      riskPct: $('risk-pct'),
      mgSteps: $('mg-steps'),
      mgFactor: $('mg-factor'),
      entrySec: $('entry-sec'),
      timerDelay: $('timer-delay'),
      // Paneles
      configHeader: $('config-header'),
      configPanel: $('config-panel'),
      configToggle: $('config-toggle'),
      logHeader: $('log-header'),
      logToggle: $('log-toggle'),
      // Stats
      uiW: $('ui-w'),
      uiL: $('ui-l'),
      uiWr: $('ui-wr'),
      // Timer
      timerText: $('timer-text'),
      timerFill: $('timer-bar-fill'),
      uiRuntime: $('ui-runtime'),
      // Info
      uiActive: $('ui-active'),
      uiMg: $('ui-mg'),
      mgBox: $('mg-box'),
      signalBox: $('signal-box'),
      monitorBox: $('monitor-box'),
      mainBtn: $('main-btn'),
      closeBtn: $('close-btn'),
      // Stop groups
      grpTime: $('grp-time'),
      grpRisk: $('grp-risk'),
      grpTrades: $('grp-trades'),
      sessionTime: $('session-time'),
      profitTarget: $('profit-target'),
      stopLoss: $('stop-loss'),
      maxWins: $('max-wins'),
      maxLosses: $('max-losses'),
      // V12: Elementos de warmup (ahora dentro del signal-box)
      warmupContainer: $('warmup-container'),
      warmupText: $('warmup-text'),
      warmupPct: $('warmup-pct'),
      warmupBarFill: $('warmup-bar-fill'),
      signalStatus: $('signal-status'),
      mgRow: $('mg-row'),
      // Indicadores en info-grid
      indEma: $('ind-ema'),
      indAtr: $('ind-atr'),
      indTrend: $('ind-trend')
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
      // Resetear contador de pérdidas consecutivas al activar AutoTrade
      if (config.autoTrade) {
        consecutiveLosses = 0;
        logMonitor('AutoTrade: ON - Contador de pérdidas reseteado', 'success');
      } else {
        logMonitor('AutoTrade: OFF', 'info');
      }
      saveConfigToStorage();
    };
    
    if (DOM.swMg) DOM.swMg.onclick = function() {
      config.useMartingale = !config.useMartingale;
      this.classList.toggle('active', config.useMartingale);
      if (DOM.mgRow) DOM.mgRow.style.display = config.useMartingale ? 'grid' : 'none';
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
    // Switch de confirmación extra
    if (DOM.swConfirm) DOM.swConfirm.onclick = function() {
      config.useConfirmation = !config.useConfirmation;
      this.classList.toggle('active', config.useConfirmation);
      logMonitor(`Confirmación: ${config.useConfirmation ? 'ON' : 'OFF'}`);
      saveConfigToStorage();
    };

    // Switch de operar en siguiente vela
    if (DOM.swNext) DOM.swNext.onclick = function() {
      config.operateOnNext = !config.operateOnNext;
      this.classList.toggle('active', config.operateOnNext);
      logMonitor(`Modo: ${config.operateOnNext ? 'SIGUIENTE VELA' : 'VELA ACTUAL'}`);
      saveConfigToStorage();
    };

    // Stop Config Switches
    if (DOM.swTime) DOM.swTime.onclick = function() {
      config.stopConfig.useTime = !config.stopConfig.useTime;
      this.classList.toggle('active', config.stopConfig.useTime);
      DOM.grpTime.classList.toggle('disabled-group', !config.stopConfig.useTime);
      saveConfigToStorage();
    };
    if (DOM.swRisk) DOM.swRisk.onclick = function() {
      config.stopConfig.useRisk = !config.stopConfig.useRisk;
      this.classList.toggle('active', config.stopConfig.useRisk);
      DOM.grpRisk.classList.toggle('disabled-group', !config.stopConfig.useRisk);
      saveConfigToStorage();
    };
    if (DOM.swTrades) DOM.swTrades.onclick = function() {
      config.stopConfig.useTrades = !config.stopConfig.useTrades;
      this.classList.toggle('active', config.stopConfig.useTrades);
      DOM.grpTrades.classList.toggle('disabled-group', !config.stopConfig.useTrades);
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