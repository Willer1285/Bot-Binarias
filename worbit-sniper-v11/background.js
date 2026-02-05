// background.js - WORBIT SNIPER V11.0 - Service Worker Optimizado
// Maneja: Estado persistente, Keep-alive, Comunicación con content scripts

// ============= ESTADO GLOBAL =============
let state = {
  isConnected: false,
  lastDataTime: 0,
  tabId: null,
  config: null,
  candles: [],
  currentCandle: null
};

// ============= INICIALIZACIÓN =============
chrome.runtime.onInstalled.addListener(() => {
  console.log('[BG] Extensión instalada/actualizada - V11.0');
  loadConfig();
});

chrome.runtime.onStartup.addListener(() => {
  console.log('[BG] Chrome iniciado');
  loadConfig();
});

// ============= KEEP-ALIVE SYSTEM =============
// Mantiene el service worker activo
const ALARM_NAME = 'keep-alive';

chrome.alarms.create(ALARM_NAME, { periodInMinutes: 0.4 }); // Cada 24 segundos

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    // Verificar estado y reconectar si es necesario
    checkAndBroadcastStatus();
  }
});

function checkAndBroadcastStatus() {
  const now = Date.now();
  const dataAge = now - state.lastDataTime;
  
  // Si no hemos recibido datos en 10 segundos, marcar como desconectado
  if (dataAge > 10000 && state.isConnected) {
    state.isConnected = false;
    broadcastToTabs({ type: 'CONNECTION_STATUS', connected: false });
  }
}

// ============= GESTIÓN DE CONFIGURACIÓN =============
async function loadConfig() {
  try {
    const result = await chrome.storage.local.get('sniperConfig');
    if (result.sniperConfig) {
      state.config = result.sniperConfig;
      console.log('[BG] Configuración cargada:', state.config);
    }
  } catch (e) {
    console.error('[BG] Error cargando configuración:', e);
  }
}

async function saveConfig(config) {
  try {
    state.config = { ...state.config, ...config };
    await chrome.storage.local.set({ sniperConfig: state.config });
    console.log('[BG] Configuración guardada');
    return true;
  } catch (e) {
    console.error('[BG] Error guardando configuración:', e);
    return false;
  }
}

// ============= GESTIÓN DE VELAS =============
async function saveCandles(pair, candles) {
  try {
    const key = `candles_${pair}`;
    await chrome.storage.local.set({ [key]: candles.slice(-200) }); // Máximo 200 velas
  } catch (e) {
    console.error('[BG] Error guardando velas:', e);
  }
}

async function loadCandles(pair) {
  try {
    const key = `candles_${pair}`;
    const result = await chrome.storage.local.get(key);
    return result[key] || [];
  } catch (e) {
    console.error('[BG] Error cargando velas:', e);
    return [];
  }
}

// ============= COMUNICACIÓN =============

// Listener para mensajes del content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse);
  return true; // Indica respuesta asíncrona
});

async function handleMessage(message, sender, sendResponse) {
  const { type, data } = message;
  
  switch (type) {
    case 'TOGGLE_PANEL':
      // Reenviar al content script de la pestaña activa
      if (sender.tab) {
        chrome.tabs.sendMessage(sender.tab.id, { type: 'TOGGLE_PANEL' });
      }
      sendResponse({ success: true });
      break;
      
    case 'WS_DATA':
      // Datos recibidos del WebSocket interceptado
      state.isConnected = true;
      state.lastDataTime = Date.now();
      state.tabId = sender.tab?.id;
      
      // Procesar y almacenar datos
      if (data && data.pair) {
        processMarketData(data);
      }
      sendResponse({ success: true });
      break;
      
    case 'SAVE_CONFIG':
      const saved = await saveConfig(data);
      sendResponse({ success: saved });
      break;
      
    case 'LOAD_CONFIG':
      await loadConfig();
      sendResponse({ success: true, config: state.config });
      break;
      
    case 'GET_CANDLES':
      const candles = await loadCandles(data.pair);
      sendResponse({ success: true, candles });
      break;
      
    case 'SAVE_CANDLES':
      await saveCandles(data.pair, data.candles);
      sendResponse({ success: true });
      break;
      
    case 'GET_STATUS':
      sendResponse({
        success: true,
        status: {
          isConnected: state.isConnected,
          lastDataTime: state.lastDataTime,
          candleCount: state.candles.length
        }
      });
      break;
      
    case 'PING':
      // Keep-alive desde content script
      sendResponse({ success: true, timestamp: Date.now() });
      break;
      
    default:
      sendResponse({ success: false, error: 'Unknown message type' });
  }
}

function processMarketData(data) {
  // Actualizar estado con datos del mercado
  // Este procesamiento mínimo se hace en background para persistencia
  state.lastDataTime = Date.now();
}

// Broadcast a todas las pestañas con la extensión activa
function broadcastToTabs(message) {
  chrome.tabs.query({ url: 'https://broker.worbit.io/*' }, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, message).catch(() => {
        // Tab puede estar cerrada o no tener el content script
      });
    });
  });
}

// ============= CLICK EN ICONO DE EXTENSIÓN =============
chrome.action.onClicked.addListener((tab) => {
  if (tab.url && tab.url.includes('broker.worbit.io')) {
    chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_PANEL' }).catch(err => {
      console.log('[BG] Error enviando mensaje, inyectando script...');
      // Si falla, intentar inyectar el script
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
    });
  } else {
    // Abrir Worbit si no está en la página correcta
    chrome.tabs.create({ url: 'https://broker.worbit.io/' });
  }
});

console.log('[BG] Service Worker inicializado - Worbit Sniper V11.0');
