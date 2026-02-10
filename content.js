// content.js - WORBIT SNIPER V11.0 - Bridge de Comunicación
// Puente entre injected.js (página) y background.js (extensión)

(function() {
'use strict';

console.log('[CS] Content Script cargado - Worbit Sniper V11.0');

// ============= ESTADO =============
let isInjected = false;
let reconnectAttempts = 0;
let isContextInvalidated = false;
let pingInterval = null;
const MAX_RECONNECT_ATTEMPTS = 5;

// ============= INYECCIÓN DEL SCRIPT PRINCIPAL =============
function injectMainScript() {
  if (isInjected) return;
  
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('injected.js');
  script.onload = function() {
    this.remove();
    isInjected = true;
    console.log('[CS] Script principal inyectado correctamente');
  };
  script.onerror = function() {
    console.error('[CS] Error inyectando script principal');
  };
  (document.head || document.documentElement).appendChild(script);
}

// ============= COMUNICACIÓN CON BACKGROUND =============

// Verificar si el contexto de la extensión es válido
function isExtensionContextValid() {
  try {
    // Acceder a chrome.runtime puede lanzar error si el contexto es inválido
    return !!(chrome && chrome.runtime && !!chrome.runtime.id);
  } catch (e) {
    return false;
  }
}

// Enviar mensaje al background con retry
async function sendToBackground(message, retries = 3) {
  // Si ya sabemos que está invalidado, no hacer nada
  if (isContextInvalidated) return null;

  // Verificar contexto antes de intentar
  if (!isExtensionContextValid()) {
    if (!isContextInvalidated) {
        // Silencioso para evitar ruido en logs de extensión
        console.log('[CS] Contexto invalidado - Deteniendo comunicación');
        isContextInvalidated = true;
        if (pingInterval) clearInterval(pingInterval);
    }
    return null;
  }

  for (let i = 0; i < retries; i++) {
    try {
      const response = await new Promise((resolve, reject) => {
        try {
          chrome.runtime.sendMessage(message, (res) => {
            const err = chrome.runtime.lastError;
            if (err) {
              // Filtrar errores de conexión cerrados que son normales al recargar
              if (err.message && (
                  err.message.includes('closed') || 
                  err.message.includes('port') ||
                  err.message.includes('context invalidated')
              )) {
                reject(new Error('Extension context invalidated'));
              } else {
                reject(err);
              }
            } else {
              resolve(res);
            }
          });
        } catch (syncErr) {
          reject(syncErr);
        }
      });
      return response;
    } catch (e) {
      // Si el contexto se invalidó, no reintentar
      const errMsg = e.message || '';
      if (errMsg.includes('Extension context invalidated') || errMsg.includes('Invocation of form runtime.connect') || errMsg.includes('validating')) {
        if (!isContextInvalidated) {
            console.log('[CS] Extensión recargada/invalidada, deteniendo comunicación');
            isContextInvalidated = true;
            if (pingInterval) clearInterval(pingInterval);
            // Notificar a la página para que deje de enviar mensajes
            window.postMessage({ type: 'SNIPER_EXTENSION_RELOADED' }, '*');
        }
        return null;
      }
      
      if (i === retries - 1) {
        // Solo loguear como warning si no es error de contexto
        if (!isContextInvalidated) {
            console.log('[CS] Fallo conexión background:', errMsg);
        }
        return null;
      }
      await new Promise(r => setTimeout(r, 100 * (i + 1)));
    }
  }
}

// ============= COMUNICACIÓN CON INJECTED.JS =============

// Escuchar mensajes desde injected.js (página)
window.addEventListener('message', async (event) => {
  // Solo aceptar mensajes de la misma página
  if (event.source !== window) return;
  
  const { type, data } = event.data || {};
  if (!type || !type.startsWith('SNIPER_')) return;
  
  switch (type) {
    case 'SNIPER_TOGGLE_UI':
      // Comando desde background o acción de usuario
      break;
      
    case 'SNIPER_WS_DATA':
      // Datos del WebSocket capturados por injected.js
      sendToBackground({ type: 'WS_DATA', data });
      break;
      
    case 'SNIPER_SAVE_CONFIG':
      const saveResult = await sendToBackground({ type: 'SAVE_CONFIG', data });
      window.postMessage({ type: 'SNIPER_CONFIG_SAVED', success: saveResult?.success }, '*');
      break;
      
    case 'SNIPER_LOAD_CONFIG':
      const loadResult = await sendToBackground({ type: 'LOAD_CONFIG' });
      window.postMessage({ 
        type: 'SNIPER_CONFIG_LOADED', 
        config: loadResult?.config,
        success: loadResult?.success 
      }, '*');
      break;
      
    case 'SNIPER_GET_CANDLES':
      const candlesResult = await sendToBackground({ type: 'GET_CANDLES', data });
      window.postMessage({ 
        type: 'SNIPER_CANDLES_LOADED', 
        candles: candlesResult?.candles || [],
        pair: data?.pair
      }, '*');
      break;
      
    case 'SNIPER_SAVE_CANDLES':
      sendToBackground({ type: 'SAVE_CANDLES', data });
      break;
      
    case 'SNIPER_GET_STATUS':
      const statusResult = await sendToBackground({ type: 'GET_STATUS' });
      window.postMessage({ type: 'SNIPER_STATUS', status: statusResult?.status }, '*');
      break;
      
    case 'SNIPER_PING':
      const pingResult = await sendToBackground({ type: 'PING' });
      window.postMessage({ type: 'SNIPER_PONG', timestamp: pingResult?.timestamp }, '*');
      break;
  }
});

// ============= ESCUCHAR MENSAJES DEL BACKGROUND =============
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, data } = message;
  
  switch (type) {
    case 'TOGGLE_PANEL':
      window.postMessage({ type: 'SNIPER_TOGGLE_UI' }, '*');
      sendResponse({ success: true });
      break;
      
    case 'CONNECTION_STATUS':
      window.postMessage({ type: 'SNIPER_CONNECTION_STATUS', connected: data?.connected }, '*');
      sendResponse({ success: true });
      break;
      
    default:
      sendResponse({ success: false });
  }
  
  return true;
});

// ============= KEEP-ALIVE =============
// Ping periódico para mantener la comunicación activa
pingInterval = setInterval(() => {
  if (isContextInvalidated) {
      clearInterval(pingInterval);
      return;
  }

  // No hacer ping si el contexto es inválido
  if (!isExtensionContextValid()) {
    return;
  }

  sendToBackground({ type: 'PING' }).then(response => {
    if (response) {
      reconnectAttempts = 0;
    } else {
      reconnectAttempts++;
      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.warn('[CS] Perdida conexión con background');
        window.postMessage({ type: 'SNIPER_CONNECTION_LOST' }, '*');
      }
    }
  });
}, 10000);

// ============= INICIALIZACIÓN =============
function init() {
  // Esperar a que el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      injectMainScript();
    });
  } else {
    injectMainScript();
  }
  
  // Re-inyectar si la página usa SPA y navega
  const observer = new MutationObserver((mutations) => {
    // Verificar si el HUD existe, si no, podría necesitar re-inyectar
    if (!document.getElementById('worbit-hud') && isInjected) {
      // Página podría haber recargado contenido
      setTimeout(() => {
        if (!document.getElementById('worbit-hud')) {
          isInjected = false;
          injectMainScript();
        }
      }, 1000);
    }
  });
  
  // Observar cambios en el body para detectar navegación SPA
  setTimeout(() => {
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: false });
    }
  }, 2000);
}

init();

})();
