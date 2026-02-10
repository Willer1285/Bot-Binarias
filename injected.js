// injected.js - WORBIT SNIPER V15.0 - ESTRATEGIA BLINDADA + DIAGNÓSTICO PROFUNDO
// Características: Sistema de warmup, Price Action puro, Martingala inteligente, Logs Exhaustivos
(function() {
'use strict';
console.log('%c WORBIT SNIPER V15.0 LOADING...', 'background: #00e676; color: #000; font-size: 14px; padding: 5px;');

// ============= CONSTANTES =============
const VERSION = '15.0';
const TARGET_CANDLES = 2;
const TARGET_CANDLES_FULL = 3;
const MAX_CANDLES = 200;
const MAX_LOGS = 50; // Aumentado para ver más historial
const HEALTH_CHECK_INTERVAL = 3000;
const DATA_TIMEOUT = 8000;
const WS_RECONNECT_DELAYS = [500, 1000, 2000, 3000, 5000];
const WS_MAX_RECONNECT_ATTEMPTS = 9999;
const MIN_TREND_CANDLES = 5;
const MIN_TRADE_INTERVAL = 5000;       // Mínimo 5 segundos entre trades

// ============= HUD HTML & CSS =============
const HUD_HTML = `
<style>
#worbit-hud{position:fixed;top:10px;right:20px;width:320px;max-height:calc(100vh - 20px);background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);border-radius:14px;box-shadow:0 0 20px rgba(0,255,255,.4),0 0 40px rgba(0,255,255,.2),0 10px 40px rgba(0,0,0,.6);z-index:999999;font-family:'Segoe UI',system-ui,sans-serif;display:none !important;border:1px solid rgba(0,255,255,.3);animation:hud-glow 3s ease-in-out infinite;overflow:hidden;flex-direction:column}
#worbit-hud.visible{display:flex !important}
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
.info-grid{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
.stat-box{background:rgba(255,255,255,.05);padding:8px 4px;border-radius:8px;text-align:center;flex:1 1 45%}
.info-grid .stat-box:last-child:nth-child(odd){flex-basis:100%}
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
    <div class="stat-box"><div class="stat-label">ESTRUCTURA</div><div class="stat-val" id="ind-trend" style="color:#ffff00">--</div></div>
  </div>
  <div class="info-grid" id="mg-row" style="display:none;grid-template-columns:1fr">
    <div class="stat-box" id="mg-box"><div class="stat-label">NIVEL MG</div><div class="stat-val" id="ui-mg" style="color:#ff00ff;text-shadow:0 0 0 5px #ff00ff">0</div></div>
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
</div>
`;

// ============= ESTADO GLOBAL =============
let DOM = {};
let isSystemReady = false;
let isVisible = false;
let isRunning = false;
let isStopPending = false;      // Nuevo: Bandera para parada segura
let stopPendingReason = '';     // Nuevo: Razón de la parada pendiente

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

// ============= NUEVO V12: SISTEMA DE WARMUP =============
let systemWarmupLevel = 0;         // 0-100% de preparación
let isSystemWarmedUp = false;      // True cuando está al 100%

// ============= NUEVO V12: PRICE ACTION & TREND =============
let currentTrend = 'neutral';      // 'bullish', 'bearish', 'neutral'
let localHigh = -Infinity;         // Máximo local para microtendencia
let localLow = Infinity;           // Mínimo local para microtendencia

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
let antiIdleInterval = null;

// ============= FUNCIONES ESENCIALES RESTAURADAS =============

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

function readAccount() {
  try {
    let foundBalance = false;
    let foundAccountType = false;
    let newBalance = 0;
    let newIsDemo = isDemo;

    // MÉTODO 1: Selectores específicos de Worbit (más confiable)
    try {
      const accTypeEl = document.querySelector('._account-type_s372q_154, [class*="account-type"]');
      if (accTypeEl) {
        const text = accTypeEl.textContent.toLowerCase();
        newIsDemo = text.includes('demo');
        foundAccountType = true;
      }

      const balEl = document.querySelector('._account-value_s372q_159, [class*="account-value"]');
      if (balEl) {
        const text = balEl.textContent.replace(/[^0-9.,]/g, '').replace(',', '');
        const val = parseFloat(text);
        if (!isNaN(val) && val > 0) {
          newBalance = val;
          foundBalance = true;
        }
      }
    } catch (e) {}

    // MÉTODO 2: Buscar en header elementos con "$"
    if (!foundBalance) {
      try {
        const headerElements = document.querySelectorAll('header *, [class*="header"] *, [class*="nav"] *');
        for (const el of headerElements) {
          if (el.children.length === 0 || el.tagName === 'SPAN' || el.tagName === 'DIV') {
            const text = el.textContent || '';
            const accountMatch = text.match(/cuenta\s*(demo|real|bono)/i);
            if (accountMatch && !foundAccountType) {
              newIsDemo = accountMatch[1].toLowerCase() === 'demo';
              foundAccountType = true;
            }
            const balanceMatch = text.match(/\$\s*([\d,]+\.?\d*)/);
            if (balanceMatch && !foundBalance) {
              let balanceStr = balanceMatch[1].replace(/,/g, '');
              const parsedBalance = parseFloat(balanceStr);
              if (!isNaN(parsedBalance) && parsedBalance > 0) {
                newBalance = parsedBalance;
                foundBalance = true;
              }
            }
            if (foundBalance && foundAccountType) break;
          }
        }
      } catch (e) {}
    }

    // MÉTODO 3: Zustand Store (localStorage)
    if (!foundBalance) {
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
                if (typeof rawBalance === 'string') rawBalance = rawBalance.replace(/[^0-9.-]/g, '');
                let parsedBal = parseFloat(rawBalance) || 0;
                if (parsedBal > 10000 && parsedBal.toString().length >= 6) parsedBal = parsedBal / 100;
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

    if (!foundAccountType) newIsDemo = true;

    // Actualizar estado y UI
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

    if (DOM.accType) {
      DOM.accType.textContent = isDemo ? 'DEMO' : isDemo === false ? 'REAL' : 'DEMO';
      DOM.accType.style.background = isDemo ? 'rgba(241,196,15,.2)' : 'rgba(0,230,118,.2)';
      DOM.accType.style.color = isDemo ? '#f1c40f' : '#00e676';
    }
    if (DOM.accBal) {
      DOM.accBal.textContent = `$${balance.toFixed(2)}`;
    }

    if (!balanceLoaded && !foundBalance) {
      logMonitor('⚠ No se pudo detectar saldo', 'blocked');
    }

  } catch (e) {
    if (!balanceLoaded) {
      logMonitor('❌ Error en readAccount: ' + e.message, 'blocked');
    }
  }
}

function calcAmount() {
  let base = (balance * config.riskPct) / 100;
  let multiplier = 1;
  if (config.useMartingale && mgLevel > 0) {
    multiplier = Math.pow(config.mgFactor, mgLevel);
  }
  currentAmt = Math.max(1, base * multiplier);
}

function getCurrentPrice() {
  if (lastWsData && lastWsData.closePrice) return lastWsData.closePrice;
  if (currentCandle && currentCandle.c) return currentCandle.c;
  return 0;
}

function updateStats() {
  if (DOM.uiW) DOM.uiW.textContent = stats.w;
  if (DOM.uiL) DOM.uiL.textContent = stats.l;
  const total = stats.w + stats.l;
  const wr = total > 0 ? ((stats.w / total) * 100).toFixed(0) : '--';
  if (DOM.uiWr) DOM.uiWr.textContent = `${wr}%`;
  if (DOM.uiMg) DOM.uiMg.textContent = mgLevel;
}

function updateWarmupUI() {
  if (DOM.warmupContainer) {
    if (isSystemWarmedUp) {
      DOM.warmupContainer.style.display = 'none';
    } else if (isRunning) {
      DOM.warmupContainer.style.display = 'block';
    } else {
      DOM.warmupContainer.style.display = 'none';
    }
  }

  if (DOM.warmupPct) DOM.warmupPct.textContent = `${systemWarmupLevel}%`;
  if (DOM.warmupBarFill) DOM.warmupBarFill.style.width = `${systemWarmupLevel}%`;

  if (DOM.warmupText) {
    if (isSystemWarmedUp) {
      DOM.warmupText.textContent = 'Listo';
    } else {
      const analysisCandles = getAnalysisCandles();
      DOM.warmupText.textContent = `Velas ${analysisCandles.length}/${TARGET_CANDLES_FULL}`;
    }
  }

  if (DOM.indTrend) {
    DOM.indTrend.textContent = currentTrend.toUpperCase();
    DOM.indTrend.style.color = currentTrend === 'bullish' ? '#00ff88' : currentTrend === 'bearish' ? '#ff5555' : '#ffff00';
  }
}

function updateTrend() {
  if (candles.length < MIN_TREND_CANDLES) {
    currentTrend = 'neutral';
    return;
  }
  const recent = candles.slice(-MIN_TREND_CANDLES);
  let greens = 0, reds = 0;
  for (let i = 0; i < recent.length; i++) {
    if (recent[i].c > recent[i].o) greens++;
    else if (recent[i].c < recent[i].o) reds++;
  }
  // Verificar cierre progresivo
  const closesRising = recent[recent.length-1].c > recent[0].c;
  const closesFalling = recent[recent.length-1].c < recent[0].c;

  if (greens >= Math.ceil(MIN_TREND_CANDLES * 0.6) && closesRising) {
    currentTrend = 'bullish';
  } else if (reds >= Math.ceil(MIN_TREND_CANDLES * 0.6) && closesFalling) {
    currentTrend = 'bearish';
  } else {
    currentTrend = 'neutral';
  }
}

function setTradeAmount(targetAmount) {
  try {
    const amountInput = document.querySelector('input[type="number"][class*="_input-operator_"]') ||
                        document.querySelector('input[type="number"].ant-input');
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
  if (!config.autoTrade) {
    logMonitor('AutoTrade desactivado', 'info');
    return false;
  }

  if (type !== 'call' && type !== 'put') {
    logMonitor(`Tipo de trade inválido: ${type}`, 'blocked');
    return false;
  }

  if (!wsConnected) {
    logMonitor('⚠️ Sin conexión WebSocket - Trade cancelado', 'blocked');
    return false;
  }

  const now = Date.now();
  if (now - lastTradeTime < MIN_TRADE_INTERVAL) {
    const waitTime = Math.ceil((MIN_TRADE_INTERVAL - (now - lastTradeTime)) / 1000);
    logMonitor(`⏳ Espera ${waitTime}s entre trades`, 'info');
    return false;
  }

  if (balance <= 0) {
    logMonitor('Balance insuficiente para operar', 'blocked');
    return false;
  }

  calcAmount();

  if (currentAmt < 1) {
    logMonitor('Monto mínimo es $1.00', 'blocked');
    currentAmt = 1;
  }

  if (currentAmt > balance) {
    logMonitor(`Monto ajustado al balance: $${balance.toFixed(2)}`, 'info');
    currentAmt = balance;
  }

  if (!isDemo && currentAmt > balance * 0.1) {
    logMonitor(`⚠️ CUENTA REAL: Trade de ${((currentAmt/balance)*100).toFixed(1)}% del balance`, 'pattern');
  }

  const amountSet = setTradeAmount(currentAmt);
  if (!amountSet) {
    logMonitor('No se pudo configurar el monto', 'blocked');
  }

  lastTradeTime = now;

  logMonitor(`Ejecutando ${type.toUpperCase()} - $${currentAmt.toFixed(2)}`, 'success');

  executeTradeWithRetry(type, 3);
  return true;
}

function checkTradeResults(candle) {
  const toRemove = [];
  pendingTrades.forEach((t, i) => {
    if (t.k === candle.s) {
      const referencePrice = t.entryPrice || candle.o;

      const winCall = t.type === 'call' && candle.c > referencePrice;
      const winPut = t.type === 'put' && candle.c < referencePrice;
      const isWin = winCall || winPut;
      const isDraw = candle.c === referencePrice;

      const priceChange = ((candle.c - referencePrice) / referencePrice * 100).toFixed(4);
      const direction = candle.c > referencePrice ? '↑' : candle.c < referencePrice ? '↓' : '→';

      if (isWin) {
        stats.w++;
        sessionStats.w++;
        consecutiveLosses = 0;
        mgLevel = 0;
        activeMartingaleTrade = null;
        logMonitor(`✅ GANADA ${direction}${priceChange}% (${referencePrice.toFixed(2)} → ${candle.c.toFixed(2)})`, 'success');
      } else if (!isDraw) {
        consecutiveLosses++;
        if (config.useMartingale) {
          if (mgLevel < config.mgMaxSteps) {
            mgLevel++;
            activeMartingaleTrade = { type: t.type };
            logMonitor(`❌ PERDIDA ${direction}${priceChange}% - Martingala ${mgLevel}/${config.mgMaxSteps}`, 'blocked');
          } else {
            stats.l++;
            sessionStats.l++;
            mgLevel = 0;
            activeMartingaleTrade = null;
            logMonitor(`⛔ Max Martingala alcanzada - Ciclo perdido ${direction}${priceChange}%`, 'blocked');
          }
        } else {
          stats.l++;
          sessionStats.l++;
          logMonitor(`❌ PERDIDA ${direction}${priceChange}% (${referencePrice.toFixed(2)} → ${candle.c.toFixed(2)})`, 'blocked');
        }
        if (consecutiveLosses >= 3) {
          logMonitor(`⚠️ ${consecutiveLosses} pérdidas consecutivas`, 'pattern');
        }
      } else {
        logMonitor(`↔️ EMPATE @ ${referencePrice.toFixed(2)}`, 'info');
      }

      toRemove.push(i);
      updateStats();
      readAccount(); // Releer balance tras resultado
    }
  });

  toRemove.reverse().forEach(i => pendingTrades.splice(i, 1));
}

function checkSafeStop() {
  if (!isRunning) return;

  // No parar si hay trades pendientes o martingala activa
  if (pendingTrades.length > 0 || activeMartingaleTrade) return;

  // Si ya hay parada pendiente y no hay trades, parar ahora
  if (isStopPending) {
    logMonitor(`🛑 Parada segura: ${stopPendingReason}`, 'blocked');
    stopBot();
    return;
  }

  const sc = config.stopConfig;

  if (sc.useTime && sc.timeMin > 0 && startTime > 0) {
    const elapsedMin = (Date.now() - startTime) / 60000;
    if (elapsedMin >= sc.timeMin) {
      isStopPending = true;
      stopPendingReason = `Tiempo (${sc.timeMin} min)`;
      logMonitor('⏱ Límite de tiempo alcanzado', 'blocked');
      if (pendingTrades.length === 0 && !activeMartingaleTrade) stopBot();
      return;
    }
  }

  if (sc.useRisk && initialBalance > 0) {
    const profit = balance - initialBalance;
    const profitPct = (profit / initialBalance) * 100;
    if (sc.profitPct > 0 && profitPct >= sc.profitPct) {
      isStopPending = true;
      stopPendingReason = `Take Profit (+${profitPct.toFixed(1)}%)`;
      logMonitor(`💰 Take Profit: +${profitPct.toFixed(1)}%`, 'success');
      stopBot();
      return;
    }
    if (sc.stopLossPct > 0 && profitPct <= -sc.stopLossPct) {
      isStopPending = true;
      stopPendingReason = `Stop Loss (${profitPct.toFixed(1)}%)`;
      logMonitor(`⛔ Stop Loss: ${profitPct.toFixed(1)}%`, 'blocked');
      stopBot();
      return;
    }
  }

  if (sc.useTrades) {
    if (sc.maxWins > 0 && sessionStats.w >= sc.maxWins) {
      isStopPending = true;
      stopPendingReason = `Max Wins (${sessionStats.w})`;
      logMonitor(`🎯 Max wins alcanzado: ${sessionStats.w}`, 'success');
      stopBot();
      return;
    }
    if (sc.maxLosses > 0 && sessionStats.l >= sc.maxLosses) {
      isStopPending = true;
      stopPendingReason = `Max Losses (${sessionStats.l})`;
      logMonitor(`⛔ Max losses alcanzado: ${sessionStats.l}`, 'blocked');
      stopBot();
      return;
    }
  }
}

function shouldExecuteMartingale(tradeType) {
  // Martingala siempre se ejecuta si está activa - sin restricciones
  // El ciclo debe completarse según la configuración del usuario
  return true;
}

// ============= SISTEMA ANTI-INACTIVIDAD =============
function startAntiIdle() {
  if (antiIdleInterval) clearInterval(antiIdleInterval);

  // Cada 30 segundos simular actividad humana para evitar que la página detecte inactividad
  antiIdleInterval = setInterval(() => {
    if (!isRunning) return;

    try {
      // 1. Mover el mouse en una posición aleatoria del gráfico
      const chart = document.querySelector('canvas, [class*="chart"], [class*="trading-view"]');
      const target = chart || document.body;
      const rect = target.getBoundingClientRect();
      const x = rect.left + Math.random() * rect.width;
      const y = rect.top + Math.random() * rect.height;

      target.dispatchEvent(new MouseEvent('mousemove', {
        bubbles: true, clientX: x, clientY: y
      }));

      // 2. Simular scroll mínimo (1px) en el cuerpo de la página
      window.scrollBy(0, 1);
      setTimeout(() => window.scrollBy(0, -1), 100);

      // 3. Disparar eventos de actividad que los detectores de inactividad escuchan
      document.dispatchEvent(new Event('mousemove', { bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Shift', code: 'ShiftLeft' }));
      document.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Shift', code: 'ShiftLeft' }));

      // 4. Mantener focus en la ventana
      if (document.hasFocus && !document.hasFocus()) {
        window.focus();
      }

      // 5. Prevenir Page Visibility API timeout
      if (document.hidden) {
        // Forzar un requestAnimationFrame para mantener el tab "activo"
        requestAnimationFrame(() => {});
      }

    } catch(e) {}
  }, 30000); // Cada 30 segundos

  // Interceptar y bloquear beforeunload (evitar que la página se recargue sola)
  window.addEventListener('beforeunload', function(e) {
    if (isRunning) {
      // Si el bot está corriendo, intentar prevenir la recarga
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // Override del Page Visibility API para que la página crea que siempre está visible
  try {
    Object.defineProperty(document, 'hidden', { value: false, writable: false });
    Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: false });
  } catch(e) {}
}

function stopAntiIdle() {
  if (antiIdleInterval) {
    clearInterval(antiIdleInterval);
    antiIdleInterval = null;
  }
}

function startBot() {
  if (isRunning) return;

  isRunning = true;
  isStopPending = false;
  stopPendingReason = '';
  startTime = Date.now();
  initialBalance = balance;
  sessionStats = { w: 0, l: 0 };
  mgLevel = 0;
  tradeExecutedThisCandle = false;
  lastTradeType = null;
  activeMartingaleTrade = null;
  pendingSignal = null;
  pendingTrades = [];
  consecutiveLosses = 0;

  setupWebSocketInterceptor();

  // Health check
  if (healthCheckInterval) clearInterval(healthCheckInterval);
  healthCheckInterval = setInterval(() => {
    if (!isRunning) return;
    const elapsed = Date.now() - lastTickTime;
    if (elapsed > DATA_TIMEOUT && lastTickTime > 0) {
      logMonitor('⚠ Sin datos. Verificando...', 'blocked');
      updateConnectionUI(false);
    }
  }, HEALTH_CHECK_INTERVAL);

  startUIUpdateLoop();
  startAntiIdle();

  // Diagnóstico inicial con pequeño delay
  setTimeout(() => runDiagnostics(), 500);

  if (DOM.mainBtn) {
    DOM.mainBtn.textContent = 'DETENER SISTEMA';
    DOM.mainBtn.classList.remove('btn-start');
    DOM.mainBtn.classList.add('btn-stop');
  }

  readAccount();
  if (balance > 0) initialBalance = balance;
  calcAmount();

  logMonitor('🟢 Sistema iniciado', 'success');
  logMonitor(`Balance: $${balance.toFixed(2)} | Riesgo: ${config.riskPct}% | Monto: $${currentAmt.toFixed(2)}`, 'info');
  logMonitor(`AutoTrade: ${config.autoTrade ? 'ON' : 'OFF'} | MG: ${config.useMartingale ? 'ON' : 'OFF'}`, 'info');
}

// ============= FUNCIONES DE ESTADO (Movidias arriba para evitar ReferenceError) =============
function checkWarmupStatus() {
  const currentCandles = candles.length;
  // Usamos TARGET_CANDLES_FULL (3) como objetivo para estar listos
  // ya que necesitamos prev2 (3 velas: actual, prev, prev2) para patrones
  const target = TARGET_CANDLES_FULL; 
  
  if (target <= 0) {
      systemWarmupLevel = 100;
      isSystemWarmedUp = true;
      return true;
  }
  
  systemWarmupLevel = Math.min(100, Math.floor((currentCandles / target) * 100));
  isSystemWarmedUp = currentCandles >= target;
  
  return isSystemWarmedUp;
}

function stopBot(force = false) {
  if (!isRunning && !force) return;
  
  isRunning = false;
  isStopPending = false;
  stopPendingReason = '';
  
  // Limpiar intervalos
  if (healthCheckInterval) {
      clearInterval(healthCheckInterval);
      healthCheckInterval = null;
  }

  stopAntiIdle();
  stopUIUpdateLoop();
  
  // Resetear estados visuales
  if (DOM.mainBtn) {
    DOM.mainBtn.textContent = 'INICIAR SISTEMA';
    DOM.mainBtn.classList.remove('btn-stop');
    DOM.mainBtn.classList.add('btn-start');
  }
  
  // Resetear caja de señales
  if (DOM.signalBox) {
      DOM.signalBox.className = 'sig-waiting';
      DOM.signalStatus.innerHTML = `
        <div class="signal-title" style="color:#00ffff;font-size:11px">SISTEMA DETENIDO</div>
        <div class="signal-subtitle" style="color:#888;font-size:9px">Presiona INICIAR para continuar</div>`;
  }
  
  if (DOM.warmupContainer) {
      DOM.warmupContainer.style.display = 'none';
  }

  logMonitor('🔴 Sistema detenido', 'blocked');
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
      hud.innerHTML = HUD_HTML;
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
    if (DOM.mainBtn) DOM.mainBtn.onclick = () => isRunning ? stopBot(true) : startBot();
    
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
    
    // Asegurar que inicie oculto
    if (!isVisible && DOM.hud) {
        DOM.hud.classList.remove('visible');
        DOM.hud.style.display = 'none';
    }
    
    updateStats();
    readAccount();
    loadConfigFromStorage();
    setInterval(readAccount, 3000);
    
    console.log('%c WORBIT SNIPER V11.0 READY', 'color: #00e676; font-weight: bold; font-size: 12px;');
    
  } catch (e) {
    console.error('Init Error:', e);
  }
}

// ============= NUEVO: ACCESO AL GRÁFICO =============

/**
 * Obtiene las velas para análisis (Solo WebSocket)
 */
function getAnalysisCandles() {
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

// ============= WORBIT STORE ACCESS (Simplificado) =============
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

// ============= WEBSOCKET INTERCEPTOR CON PROTOCOLO SOCKET.IO V4 =============
let originalWebSocket = null;
let wsReconnectTimeout = null;
let lastWsUrl = null;
let lastWsProtocols = null;
let sioConfig = { pingInterval: 25000, pingTimeout: 5000 }; // Defaults Socket.IO
let sioPingTimer = null;          // Timer para enviar pings propios
let sioNamespaceConnected = false; // Si ya nos conectamos al namespace /symbol-prices
let lastSubscribedChannel = null;  // Último canal suscrito para re-suscripción
let activeBrokerSocket = null;     // WebSocket del broker-api (para mantenerlo vivo también)

function setupWebSocketInterceptor() {
  if (originalWebSocket) return;

  originalWebSocket = window.WebSocket;

  window.WebSocket = function(url, protocols) {
    const ws = new originalWebSocket(url, protocols);

    const isPriceSocket = url.includes('symbol-prices');
    const isBrokerSocket = url.includes('broker-api');

    if (isPriceSocket) {
      lastWsUrl = url;
      lastWsProtocols = protocols;
      activeWebSocket = ws;
      sioNamespaceConnected = false;
    }

    if (isBrokerSocket) {
      activeBrokerSocket = ws;
    }

    ws.addEventListener('open', () => {
      if (isPriceSocket) {
        lastTickTime = Date.now();
        lastWsMessageTime = Date.now();
        wsReconnectAttempt = 0;
        logMonitor('✓ WebSocket conectado (esperando handshake)', 'success');
        updateConnectionUI(true);
        // NO marcar wsConnected=true aún - esperar handshake completo
      } else if (isBrokerSocket) {
        logMonitor('✓ Broker API conectado', 'info');
      }
    });

    ws.addEventListener('close', (event) => {
      if (isPriceSocket) {
        wsConnected = false;
        sioNamespaceConnected = false;
        activeWebSocket = null;
        stopSioPing();
        logMonitor(`⚠ WebSocket cerrado (código: ${event.code})`, 'blocked');
        updateConnectionUI(false);
        scheduleReconnect();
      }
      if (isBrokerSocket) {
        activeBrokerSocket = null;
      }
    });

    ws.addEventListener('error', () => {
      if (isPriceSocket) {
        logMonitor('⚠ Error WebSocket', 'blocked');
        updateConnectionUI(false);
      }
    });

    ws.addEventListener('message', (event) => {
      lastWsMessageTime = Date.now();

      if (isPriceSocket) {
        handlePriceSocketMessage(ws, event.data);
      } else if (isBrokerSocket) {
        handleBrokerSocketMessage(ws, event.data);
      }
    });

    return ws;
  };

  window.WebSocket.prototype = originalWebSocket.prototype;
  Object.keys(originalWebSocket).forEach(key => {
    if (key !== 'prototype') {
      try { window.WebSocket[key] = originalWebSocket[key]; } catch(e) {}
    }
  });

  setInterval(checkWsHealth, 5000);
}

// ============= PROTOCOLO SOCKET.IO V4 =============
// Códigos: 0=open, 1=close, 2=ping, 3=pong, 4=message
// 40=CONNECT namespace, 42=EVENT

function handlePriceSocketMessage(ws, data) {
  if (typeof data !== 'string') return;

  // --- HANDSHAKE INICIAL: Servidor envía configuración ---
  // Mensaje tipo: 0{"sid":"xxx","upgrades":[],"pingInterval":25000,"pingTimeout":5000}
  if (data.startsWith('0{')) {
    try {
      const config = JSON.parse(data.substring(1));
      if (config.pingInterval) sioConfig.pingInterval = config.pingInterval;
      if (config.pingTimeout) sioConfig.pingTimeout = config.pingTimeout;
      logMonitor(`✓ Handshake OK (ping: ${sioConfig.pingInterval/1000}s)`, 'info');

      // Conectar al namespace /symbol-prices
      wsSafeSend(ws, '40/symbol-prices,');
    } catch(e) {}
    return;
  }

  // --- RESPUESTA DE CONEXIÓN A NAMESPACE ---
  // Mensaje tipo: 40/symbol-prices,{"sid":"xxx"}
  if (data.startsWith('40/symbol-prices')) {
    sioNamespaceConnected = true;
    wsConnected = true;
    updateConnectionUI(true);
    startSioPing(ws);
    logMonitor('✓ Namespace /symbol-prices conectado', 'success');

    // Suscribirse al canal de precios del activo actual
    subscribeToCurrentSymbol(ws);
    return;
  }

  // --- PING DEL SERVIDOR: Responder con PONG ---
  // Socket.IO v4: servidor envía "2", cliente responde "3"
  if (data === '2') {
    wsSafeSend(ws, '3');
    return;
  }

  // --- PONG DEL SERVIDOR (respuesta a nuestro ping) ---
  if (data === '3') {
    return; // OK, conexión viva
  }

  // --- MENSAJES DE DATOS (42/symbol-prices,...) ---
  processWebSocketMessage(data);
}

function handleBrokerSocketMessage(ws, data) {
  if (typeof data !== 'string') return;

  // Handshake del broker-api
  if (data.startsWith('0{')) {
    try {
      // Conectar a namespaces del broker
      wsSafeSend(ws, '40/user,');
    } catch(e) {}
    return;
  }

  // Responder ping del broker-api también
  if (data === '2') {
    wsSafeSend(ws, '3');
    return;
  }

  // Procesar mensajes de balance/wallet
  processWebSocketMessage(data);
}

function wsSafeSend(ws, msg) {
  try {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
      return true;
    }
  } catch(e) {}
  return false;
}

// --- SISTEMA DE PING PROPIO ---
function startSioPing(ws) {
  stopSioPing();
  // Enviar ping cada pingInterval (normalmente 25s)
  // Usamos 80% del intervalo para tener margen
  const interval = Math.floor(sioConfig.pingInterval * 0.8);
  sioPingTimer = setInterval(() => {
    if (!wsSafeSend(ws, '2')) {
      stopSioPing();
      // Si no se pudo enviar, el socket probablemente está muerto
      if (wsConnected) {
        wsConnected = false;
        sioNamespaceConnected = false;
        updateConnectionUI(false);
        scheduleReconnect();
      }
    }
  }, interval);
}

function stopSioPing() {
  if (sioPingTimer) {
    clearInterval(sioPingTimer);
    sioPingTimer = null;
  }
}

// --- SUSCRIPCIÓN A CANAL DE PRECIOS ---
function subscribeToCurrentSymbol(ws) {
  try {
    // Obtener el símbolo actual del store de Worbit
    let channel = null;
    const symbolStore = localStorage.getItem('symbol-store');
    if (symbolStore) {
      const parsed = JSON.parse(symbolStore);
      const symbol = parsed?.state?.symbolSelected;
      if (symbol) {
        // Construir canal: slot:ticker (ej: "mybroker-11:ETHUSDT.OTC")
        // Buscar el slot del tenant
        const tenantStore = localStorage.getItem('tenant-store');
        let slot = 'mybroker-11'; // Default
        if (tenantStore) {
          try {
            const tp = JSON.parse(tenantStore);
            if (tp?.state?.slug) slot = tp.state.slug;
          } catch(e) {}
        }
        channel = `${slot}:${symbol}`;
      }
    }

    // Fallback: usar el par actual si lo tenemos
    if (!channel && currentPair) {
      channel = `mybroker-11:${currentPair}`;
    }

    // Fallback: usar último canal conocido
    if (!channel && lastSubscribedChannel) {
      channel = lastSubscribedChannel;
    }

    if (channel) {
      const msg = `42/symbol-prices,["last-symbol-price","${channel}"]`;
      wsSafeSend(ws, msg);
      lastSubscribedChannel = channel;
      logMonitor(`✓ Suscrito a ${channel}`, 'success');
    }
  } catch(e) {
    logMonitor('⚠ Error al suscribirse al canal', 'blocked');
  }
}

/**
 * V12: Monitorea la salud del WebSocket y detecta conexiones zombies
 */
function checkWsHealth() {
  if (!isRunning) return;

  // Verificar si el WebSocket de precios sigue abierto
  if (activeWebSocket && activeWebSocket.readyState === WebSocket.OPEN) {
    // Socket abierto - verificar si el namespace está conectado
    if (!sioNamespaceConnected) {
      wsSafeSend(activeWebSocket, '40/symbol-prices,');
    }
    return;
  }

  // Socket cerrado o no existe
  if (wsConnected) {
    logMonitor('⚠ Conexión perdida - reconectando...', 'pattern');
    wsConnected = false;
    sioNamespaceConnected = false;
    updateConnectionUI(false);
  }

  if (!wsReconnectTimeout) {
    scheduleReconnect();
  }

  // También verificar el broker-api socket
  if (activeBrokerSocket && activeBrokerSocket.readyState !== WebSocket.OPEN) {
    activeBrokerSocket = null;
  }
}

function startWsHeartbeat() {
  // El heartbeat ahora está manejado por startSioPing en el protocolo Socket.IO
  // Esta función se mantiene para compatibilidad
}

function processWebSocketMessage(data) {
  if (typeof data !== 'string') return;

  // Procesar actualizaciones de precios
  if (data.includes('symbol.price.update')) {
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
  
  // Procesar posibles actualizaciones de balance (experimental)
  if (data.includes('wallet') || data.includes('balance') || data.includes('user.update')) {
    try {
        // Intentar extraer números que parezcan balances
        const matches = data.match(/"balance":\s*([\d.]+)/);
        if (matches && matches[1]) {
            const bal = parseFloat(matches[1]);
            if (!isNaN(bal)) {
                balance = bal;
                balanceLoaded = true;
                logMonitor(`✓ Saldo actualizado (WS): $${balance.toFixed(2)}`, 'success');
                if (DOM.accBal) DOM.accBal.textContent = `$${balance.toFixed(2)}`;
            }
        }
    } catch(e) {}
  }
}

/**
 * V12: Sistema de reconexión instantánea con backoff exponencial
 * No recarga la página, crea una nueva conexión WebSocket directamente
 */
function scheduleReconnect() {
  if (wsReconnectTimeout) return;

  // Determinar delay basado en el intento actual (máx 5s)
  const delayIndex = Math.min(wsReconnectAttempt, WS_RECONNECT_DELAYS.length - 1);
  const delay = WS_RECONNECT_DELAYS[delayIndex];

  wsReconnectTimeout = setTimeout(() => {
    wsReconnectTimeout = null;
    if (wsConnected) {
      wsReconnectAttempt = 0;
      return;
    }

    wsReconnectAttempt++;
    logMonitor(`🔄 Reconectando (intento ${wsReconnectAttempt})...`, 'info');

    // Estrategia escalonada:
    // 1-5: Reconexión directa con URL guardada
    // 6-10: Buscar WebSocket activo en la página y clonar su URL
    // 11+: Forzar que la página recree el WebSocket navegando al activo
    if (wsReconnectAttempt <= 5) {
      attemptDirectReconnect();
    } else if (wsReconnectAttempt <= 10) {
      attemptDiscoverReconnect();
    } else {
      attemptForcePageReconnect();
      wsReconnectAttempt = 0; // Reiniciar ciclo
    }
  }, delay);
}

/**
 * V12: Intenta reconectar directamente creando un nuevo WebSocket
 */
function attemptDirectReconnect() {
  if (lastWsUrl) {
    try {
      const urlObj = new URL(lastWsUrl);
      urlObj.searchParams.set('_t', Date.now());
      new window.WebSocket(urlObj.toString(), lastWsProtocols);
      return;
    } catch (e) {}
  }
  // Si no hay URL, pasar a siguiente estrategia
  scheduleReconnect();
}

/**
 * Estrategia 2: Buscar WebSockets activos en la página y clonar su configuración
 */
function attemptDiscoverReconnect() {
  try {
    // Buscar en el store de Worbit la URL del WS actual
    const symbolStore = localStorage.getItem('symbol-store');
    if (symbolStore) {
      const parsed = JSON.parse(symbolStore);
      const symbol = parsed?.state?.symbolSelected;
      if (symbol) {
        logMonitor(`🔍 Redescubriendo WS para ${symbol}...`, 'info');
        // Forzar cambio de símbolo para que la página recree el WS
        // Hacer click en el activo actual para refrescar la suscripción
        const activeItem = document.querySelector('[class*="symbol-item"][class*="active"], [class*="pair-item"][class*="selected"]');
        if (activeItem) {
          activeItem.click();
          return;
        }
      }
    }
  } catch(e) {}
  scheduleReconnect();
}

/**
 * Estrategia 3: Forzar que la página recree sus conexiones WebSocket
 */
function attemptForcePageReconnect() {
  logMonitor('🔄 Forzando reconexión de página...', 'pattern');
  try {
    // Método 1: Recargar iframe del gráfico
    const chartFrames = document.querySelectorAll('iframe');
    for (const frame of chartFrames) {
      if (frame.src && (frame.src.includes('chart') || frame.src.includes('tradingview'))) {
        frame.src = frame.src;
        logMonitor('✓ Gráfico recargado', 'success');
        return;
      }
    }

    // Método 2: Simular cambio de activo para forzar nueva suscripción WS
    const pairItems = document.querySelectorAll('[class*="symbol-item"], [class*="pair-item"], [class*="asset-item"]');
    if (pairItems.length > 1) {
      // Click en otro activo y luego volver al original
      const otherItem = pairItems[1];
      otherItem.click();
      setTimeout(() => {
        pairItems[0].click();
        logMonitor('✓ Activo refrescado', 'success');
      }, 2000);
      return;
    }

    logMonitor('⚠ Reconexión forzada sin resultado - reintentando...', 'info');
  } catch(e) {}
  scheduleReconnect();
}

function updateConnectionUI(connected) {
  if (DOM.dot) {
    DOM.dot.style.background = connected ? '#00e676' : '#e74c3c';
    DOM.dot.style.boxShadow = connected ? '0 0 8px #00e676' : '0 0 8px #e74c3c';
  }
}

// ============= CARGA DE DATOS HISTÓRICOS =============
// API Histórica eliminada. El bot operará exclusivamente con datos en tiempo real (Warmup).
async function loadHistoricalData(pair) {
  return [];
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
    // Merge profundo cuidadoso para stopConfig
    if (c.stopConfig) {
        config.stopConfig = { ...config.stopConfig, ...c.stopConfig };
        delete c.stopConfig; // Ya procesado
    }
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

  // Inputs numéricos
  if (DOM.riskPct) DOM.riskPct.value = config.riskPct;
  if (DOM.mgSteps) DOM.mgSteps.value = config.mgMaxSteps;
  if (DOM.mgFactor) DOM.mgFactor.value = config.mgFactor;
  if (DOM.entrySec) DOM.entrySec.value = config.entrySec;
  if (DOM.timerDelay) DOM.timerDelay.value = config.timeOffset;
  // Corregido: Mostrar/ocultar la fila completa del contador de Martingala
  if (DOM.mgRow) DOM.mgRow.style.display = config.useMartingale ? 'grid' : 'none';

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

// ============= RECONOCIMIENTO DE PATRONES DE VELAS (PDF COMPLETO) =============

// --- Funciones Auxiliares de Velas ---
const isDoji = c => getBody(c) <= (c.h - c.l) * 0.1;

const isSpinningTop = c => {
  const body = getBody(c);
  const total = c.h - c.l;
  if (total === 0) return false;
  return body > total * 0.1 && body < total * 0.5 && getUpperWick(c) > body && getLowerWick(c) > body;
};

const isMarubozu = c => {
  const body = getBody(c);
  const total = c.h - c.l;
  if (total === 0) return false;
  return body > total * 0.85; // Cuerpo ocupa más del 85%
};

// Martillo / Hombre Colgado (cuerpo pequeño arriba, mecha abajo larga)
const isHammerLike = c => {
  const body = getBody(c);
  const lower = getLowerWick(c);
  const upper = getUpperWick(c);
  return lower >= body * 2 && upper <= body * 0.5;
};

// Estrella Fugaz / Martillo Invertido (cuerpo pequeño abajo, mecha arriba larga)
const isInvertedHammerLike = c => {
  const body = getBody(c);
  const lower = getLowerWick(c);
  const upper = getUpperWick(c);
  return upper >= body * 2 && lower <= body * 0.5;
};

const hasGapUp = (curr, prev) => curr.o > prev.c;
const hasGapDown = (curr, prev) => curr.o < prev.c;
const getBodyMiddle = c => (c.o + c.c) / 2;

// --- Detección de Patrones ---

/**
 * Analiza patrones de 1 vela
 */
function checkSingleCandlePattern(c, trend) {
  if (isDoji(c)) {
      // Libélula Doji (Dragonfly)
      if (getLowerWick(c) > getBody(c) * 3 && getUpperWick(c) < getBody(c)) return { name: 'Libélula Doji', type: 'call', score: 3 };
      // Lápida Doji (Gravestone)
      if (getUpperWick(c) > getBody(c) * 3 && getLowerWick(c) < getBody(c)) return { name: 'Lápida Doji', type: 'put', score: 3 };
      return { name: 'Doji (Indecisión)', type: 'neutral', score: 1 };
  }
  
  if (isSpinningTop(c)) return { name: 'Peonza (Indecisión)', type: 'neutral', score: 1 };
  
  if (isMarubozu(c)) {
    return { name: isGreen(c) ? 'Marubozu Alcista' : 'Marubozu Bajista', type: isGreen(c) ? 'call' : 'put', score: 3 };
  }
  
  // Patrones de cambio dependientes de tendencia
  if (isHammerLike(c)) {
    if (trend === 'bearish') return { name: 'Martillo', type: 'call', score: 4 }; 
    if (trend === 'bullish') return { name: 'Hombre Colgado', type: 'put', score: 3 };
  }
  
  if (isInvertedHammerLike(c)) {
    if (trend === 'bearish') return { name: 'Martillo Invertido', type: 'call', score: 2 }; 
    if (trend === 'bullish') return { name: 'Estrella Fugaz', type: 'put', score: 4 };
  }
  
  // Velas de onda alta (High Wave) - Indecisión fuerte
  if (getUpperWick(c) > getBody(c)*2 && getLowerWick(c) > getBody(c)*2) {
      return { name: 'Vela de Onda Alta', type: 'neutral', score: 1 };
  }

  return null;
}

/**
 * Analiza patrones de 2 velas
 */
function checkTwoCandlePattern(curr, prev, trend) {
  // Engulfing (Envolvente)
  if (isRed(prev) && isGreen(curr) && curr.c > prev.o && curr.o < prev.c) {
    return { name: 'Envolvente Alcista', type: 'call', score: 5 };
  }
  if (isGreen(prev) && isRed(curr) && curr.c < prev.o && curr.o > prev.c) {
    return { name: 'Envolvente Bajista', type: 'put', score: 5 };
  }
  
  // Harami
  if (isRed(prev) && isGreen(curr) && curr.h < prev.o && curr.l > prev.c) {
     return { name: 'Harami Alcista', type: 'call', score: 3 };
  }
  if (isGreen(prev) && isRed(curr) && curr.h < prev.c && curr.l > prev.o) {
     return { name: 'Harami Bajista', type: 'put', score: 3 };
  }
  
  // Piercing Line (Pauta Penetrante)
  if (trend === 'bearish' && isRed(prev) && isGreen(curr) && 
      curr.o < prev.l && curr.c > getBodyMiddle(prev) && curr.c < prev.o) {
    return { name: 'Pauta Penetrante', type: 'call', score: 4 };
  }
  
  // Dark Cloud Cover (Cubierta Nube Oscura)
  if (trend === 'bullish' && isGreen(prev) && isRed(curr) && 
      curr.o > prev.h && curr.c < getBodyMiddle(prev) && curr.c > prev.o) {
    return { name: 'Cubierta Nube Oscura', type: 'put', score: 4 };
  }
  
  // Tweezers (Pinzas)
  const tolerance = (curr.h - curr.l) * 0.05;
  if (Math.abs(curr.l - prev.l) < tolerance && trend === 'bearish') {
    return { name: 'Suelo en Pinzas', type: 'call', score: 4 };
  }
  if (Math.abs(curr.h - prev.h) < tolerance && trend === 'bullish') {
    return { name: 'Techo en Pinzas', type: 'put', score: 4 };
  }

  // Coz (Kicking)
  if (isMarubozu(prev) && isMarubozu(curr)) {
      if (isRed(prev) && isGreen(curr) && hasGapUp(curr, prev)) return { name: 'Coz Alcista', type: 'call', score: 5};
      if (isGreen(prev) && isRed(curr) && hasGapDown(curr, prev)) return { name: 'Coz Bajista', type: 'put', score: 5};
  }

  // On Neck Line (Bajista)
  if (trend === 'bearish' && isRed(prev) && isGreen(curr) && 
      hasGapDown(curr, prev) && Math.abs(curr.c - prev.l) < tolerance) {
      return { name: 'On Neck Line', type: 'put', score: 3 }; // Continuación bajista
  }

  // Separadas (Separating Lines) - Continuación
  if (trend === 'bullish' && isRed(prev) && isGreen(curr) && Math.abs(curr.o - prev.o) < tolerance) {
      return { name: 'Separadas Alcistas', type: 'call', score: 3 };
  }
  if (trend === 'bearish' && isGreen(prev) && isRed(curr) && Math.abs(curr.o - prev.o) < tolerance) {
      return { name: 'Separadas Bajistas', type: 'put', score: 3 };
  }
  
  return null;
}

/**
 * Analiza patrones de 3 velas
 */
function checkThreeCandlePattern(curr, prev, prev2, trend) {
  // Morning Star (Estrella de la Mañana)
  if (isRed(prev2) && getBody(prev2) > getAvgBody([prev2]) && 
      getBody(prev) < getBody(prev2) * 0.4 && // Vela media pequeña
      isGreen(curr) && curr.c > getBodyMiddle(prev2)) {
      return { name: 'Estrella de la Mañana', type: 'call', score: 5 };
  }
  
  // Evening Star (Estrella Vespertina)
  if (isGreen(prev2) && getBody(prev2) > getAvgBody([prev2]) && 
      getBody(prev) < getBody(prev2) * 0.4 && 
      isRed(curr) && curr.c < getBodyMiddle(prev2)) {
      return { name: 'Estrella Vespertina', type: 'put', score: 5 };
  }
  
  // Three White Soldiers
  if (trend === 'bearish' && 
      isGreen(prev2) && isGreen(prev) && isGreen(curr) &&
      prev.c > prev2.c && curr.c > prev.c &&
      prev.o > prev2.o && prev.o < prev2.c &&
      curr.o > prev.o && curr.o < prev.c &&
      !isDoji(prev2) && !isDoji(prev) && !isDoji(curr)) {
      return { name: 'Tres Soldados Blancos', type: 'call', score: 5 };
  }
  
  // Three Black Crows
  if (trend === 'bullish' && 
      isRed(prev2) && isRed(prev) && isRed(curr) &&
      prev.c < prev2.c && curr.c < prev.c &&
      prev.o < prev2.o && prev.o > prev2.c &&
      curr.o < prev.o && curr.o > prev.c &&
      !isDoji(prev2) && !isDoji(prev) && !isDoji(curr)) {
      return { name: 'Tres Cuervos Negros', type: 'put', score: 5 };
  }
  
  // Variantes Doji Star
  if (isRed(prev2) && isDoji(prev) && isGreen(curr) && curr.c > getBodyMiddle(prev2)) {
      return { name: 'Estrella Doji de la Mañana', type: 'call', score: 5 };
  }
  if (isGreen(prev2) && isDoji(prev) && isRed(curr) && curr.c < getBodyMiddle(prev2)) {
      return { name: 'Estrella Doji Vespertina', type: 'put', score: 5 };
  }

  // Bebé Abandonado (Gaps claros a ambos lados del Doji)
  if (isRed(prev2) && isDoji(prev) && isGreen(curr) && 
      prev.h < prev2.l && prev.h < curr.l) { 
      return { name: 'Bebé Abandonado Alcista', type: 'call', score: 6 };
  }
  if (isGreen(prev2) && isDoji(prev) && isRed(curr) && 
      prev.l > prev2.h && prev.l > curr.h) { 
      return { name: 'Bebé Abandonado Bajista', type: 'put', score: 6 };
  }

  // Three Inside Up/Down (Confirmación de Harami)
  // Up: Harami Alcista + 3ra vela verde cierra mas arriba
  if (isRed(prev2) && isGreen(prev) && isGreen(curr) && 
      prev.h < prev2.o && prev.l > prev2.c && // Harami
      curr.c > prev2.o) { // Confirmación
      return { name: 'Tres Velas Interiores Alcistas', type: 'call', score: 5 };
  }
  // Down: Harami Bajista + 3ra vela roja cierra mas abajo
  if (isGreen(prev2) && isRed(prev) && isRed(curr) && 
      prev.h < prev2.c && prev.l > prev2.o && // Harami
      curr.c < prev2.o) { // Confirmación
      return { name: 'Tres Velas Interiores Bajistas', type: 'put', score: 5 };
  }

  // Three Outside Up/Down (Confirmación de Engulfing)
  // Up: Engulfing Alcista + 3ra vela verde
  if (isRed(prev2) && isGreen(prev) && prev.c > prev2.o && prev.o < prev2.c && // Engulfing
      isGreen(curr) && curr.c > prev.c) {
      return { name: 'Tres Velas Exteriores Alcistas', type: 'call', score: 5 };
  }
  // Down: Engulfing Bajista + 3ra vela roja
  if (isGreen(prev2) && isRed(prev) && prev.c < prev2.o && prev.o > prev2.c && // Engulfing
      isRed(curr) && curr.c < prev.c) {
      return { name: 'Tres Velas Exteriores Bajistas', type: 'put', score: 5 };
  }

  return null;
}

// ============= DETECCIÓN DE SEÑALES (MEJORADA V13 - PDF + MOMENTUM + BREAKOUTS) =============
function detectSignal(liveCandle) {
  // LOGS DE DEPURACIÓN DE BLOQUEOS
  if (isStopPending) {
      if (Math.random() < 0.05) logMonitor('🚫 Señales bloqueadas: Stop Pendiente', 'info');
      return null;
  }
  if (pendingTrades.length > 0) {
      if (!tradeExecutedThisCandle && Math.random() < 0.05) logMonitor(`⏳ Esperando resultado trade (${pendingTrades.length})...`, 'info');
      return null;
  }
  if (activeMartingaleTrade) {
      // Prioridad MG
      return null;
  }

  // V12: Verificar estado de warmup
  checkWarmupStatus();

  // V12: No operar si el sistema no está 100% listo
  if (!isSystemWarmedUp) {
    return null;
  }

  const baseCandles = getAnalysisCandles();
  const analysisCandles = [...baseCandles];

  if (liveCandle && !config.operateOnNext) {
    analysisCandles.push(liveCandle);
  }

  if (analysisCandles.length < 5) return null;

  const i = analysisCandles.length - 1;
  const now = analysisCandles[i];
  const prev = analysisCandles[i - 1];
  const prev2 = analysisCandles[i - 2];

  const currentTime = Date.now();
  if (!isCandleClosed(prev, currentTime)) {
    return null;
  }

  const { supports, resistances } = getLevels(analysisCandles, i);
  const nearSupport = isNearLevel(now.l, supports);
  const nearResistance = isNearLevel(now.h, resistances);

  // Detectar Momentum
  const momentumBullish = isStrongMomentum(analysisCandles, 'bullish');
  const momentumBearish = isStrongMomentum(analysisCandles, 'bearish');

  let signal = null;
  let strategy = '';
  
  // --- 1. DETECCIÓN DE PATRONES DE VELA (REVERSIÓN) ---
  
  // 3 Velas
  const p3 = checkThreeCandlePattern(now, prev, prev2, currentTrend);
  if (p3) {
      signal = p3.type;
      strategy = p3.name;
  }
  
  // 2 Velas
  if (!signal) {
      const p2 = checkTwoCandlePattern(now, prev, currentTrend);
      if (p2) {
          signal = p2.type;
          strategy = p2.name;
      }
  }
  
  // 1 Vela (Solo con S/R)
  if (!signal) {
      const p1 = checkSingleCandlePattern(now, currentTrend);
      if (p1) {
          if ((p1.type === 'call' && nearSupport) || (p1.type === 'put' && nearResistance)) {
              signal = p1.type;
              strategy = p1.name + ' (en Zona)';
          }
      }
  }

  // Falsa Ruptura (Price Action)
  if (!signal) {
    if (supports.some(s => now.l < s && now.c > s && isRed(prev))) {
      signal = 'call'; strategy = 'Falsa Ruptura Soporte';
    } else if (resistances.some(r => now.h > r && now.c < r && isGreen(prev))) {
      signal = 'put'; strategy = 'Falsa Ruptura Resistencia';
    }
  }

  // === FILTRO DE MOMENTUM PARA REVERSIONES ===
  // Si detectamos una señal de reversión, verificamos que no vayamos contra un tren fuerte
  if (signal) {
      if (signal === 'call' && momentumBearish) {
          logMonitor(`⚠️ Señal CALL anulada por Momentum Bajista`, 'info');
          signal = null;
      } else if (signal === 'put' && momentumBullish) {
          logMonitor(`⚠️ Señal PUT anulada por Momentum Alcista`, 'info');
          signal = null;
      }
  }

  // --- 2. DETECCIÓN DE RUPTURAS VÁLIDAS (CONTINUACIÓN) ---
  // Si no hay señal de reversión, buscamos Breakouts a favor del movimiento
  if (!signal) {
      const avgBody = getAvgBody(baseCandles);
      
      // Ruptura de Resistencia (CALL)
      // Buscamos una resistencia que haya sido cruzada y cerrada por encima
      const brokenRes = resistances.find(r => prev.c <= r && now.c > r); 
      if (brokenRes) {
          const bodySize = getBody(now);
          // Validar fuerza: Cuerpo grande, cierra cerca del máximo
          if (bodySize > avgBody * 1.2 && getUpperWick(now) < bodySize * 0.3) {
              signal = 'call';
              strategy = 'Ruptura de Resistencia (Breakout)';
          }
      }

      // Ruptura de Soporte (PUT)
      const brokenSup = supports.find(s => prev.c >= s && now.c < s);
      if (brokenSup) {
          const bodySize = getBody(now);
          // Validar fuerza: Cuerpo grande, cierra cerca del mínimo
          if (bodySize > avgBody * 1.2 && getLowerWick(now) < bodySize * 0.3) {
              signal = 'put';
              strategy = 'Ruptura de Soporte (Breakout)';
          }
      }
  }
  
  if (signal) {
    let displayType = signal;
    let note = '';
    if (config.invertTrade) {
      displayType = signal === 'call' ? 'put' : 'call';
      note = ' (INV)';
    }

    const trendTag = currentTrend !== 'neutral' ? ` [${currentTrend.toUpperCase()}]` : '';
    logMonitor(`🚀 ${strategy} → ${displayType.toUpperCase()}${note}${trendTag}`, 'pattern');

    return { d: signal, strategy: strategy };
  }
  return null;
}

// ============= PROCESAMIENTO DE TICKS =============
function onTick(data) {
  if (!isRunning) return;
  
  updateConnectionUI(true);
  
  if (DOM.uiPrice) {
    DOM.uiPrice.textContent = data.closePrice.toFixed(2);
    DOM.uiPrice.className = currentCandle && data.closePrice > currentCandle.o ? 'live-price price-up' : 'live-price price-down';
  }
  if (DOM.uiActive) DOM.uiActive.textContent = data.pair;
  
  // Actualizar warmup UI
  updateWarmupUI();

  // Validación de Tiempo (Time Violation Protection)
  if (currentCandle && data.time < currentCandle.s) {
      // Ignorar tick del pasado para evitar corrupción de velas
      return;
  }
  
  // Cambio de activo
  if (currentPair !== data.pair) {
    currentPair = data.pair;
    candles = [];
    currentCandle = null;
    pendingTrades = [];
    processed = 0;
    logMonitor(`Activo: ${currentPair}`, 'info');
    
    // Cargar histórico para el nuevo activo (Ahora vacío por eliminación de API)
    loadHistoricalData(currentPair).then(hist => {
      if (hist.length > 0) {
        candles = hist;
        processed = hist.length;
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
    
    updateTrend(); // Actualizar tendencia con cada vela cerrada
    checkTradeResults(currentCandle);
    checkSafeStop(); // Verificar si podemos parar después de cerrar vela y procesar resultados
    
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
    // NOTA: Si isStopPending es true, AÚN ASÍ ejecutamos martingala para intentar recuperar
    if (activeMartingaleTrade && config.useMartingale) {
      // Prioridad absoluta a la Martingala: No buscar nuevas señales
      pendingSignal = null;
      
      // Mostrar en UI que estamos evaluando Martingala
      if (DOM.signalBox) {
         DOM.signalBox.className = 'sig-waiting';
         DOM.signalStatus.innerHTML = `
           <div class="signal-title" style="color:#ffff00;font-size:12px">EVALUANDO MARTINGALA</div>
           <div class="signal-subtitle" style="color:#fff;font-size:10px">Verificando probabilidad...</div>`;
      }

      // Ejecutar martingala directamente - sin restricciones
      logMonitor(`⚡ Ejecutando Martingala Nivel ${mgLevel}`, 'success');
      if (config.autoTrade) {
          // Pequeño delay para asegurar apertura de vela
          const mgType = activeMartingaleTrade.type;
          activeMartingaleTrade = null; // Consumir antes del timeout
          setTimeout(() => {
              executeTrade(mgType);
              const entryPrice = getCurrentPrice();
              pendingTrades.push({ k: currentCandle.s, type: mgType, entryPrice: entryPrice });
              tradeExecutedThisCandle = true;
              lastTradeType = mgType;
          }, 500);
      } else {
           activeMartingaleTrade = null;
      }
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

  // Comprobación de trade activo (vela actual o pendiente)
  if (tradeExecutedThisCandle || pendingTrades.length > 0) {
    const isCall = lastTradeType === 'call';
    DOM.signalBox.className = isCall ? 'sig-possible-call' : 'sig-possible-put';
    DOM.signalStatus.innerHTML = `
      <div class="signal-title" style="color:${isCall ? '#00ff88' : '#ff0080'};font-size:14px">${isCall ? '▲ COMPRA' : '▼ VENTA'}</div>
      <div class="signal-subtitle" style="font-size:10px">ESPERANDO RESULTADO...</div>`;
    return;
  }

  if (pendingSignal) {
    let type = pendingSignal.d;
    if (config.invertTrade) type = type === 'call' ? 'put' : 'call';

    const isCall = type === 'call';
    const triggerSec = 60 - config.entrySec;
    const windowSize = config.entryWindowSec || 3;

    if (sec <= triggerSec && sec > (triggerSec - windowSize)) {
      DOM.signalBox.className = isCall ? 'sig-entry-call' : 'sig-entry-put';
      DOM.signalStatus.innerHTML = `
        <div class="signal-title" style="color:${isCall ? '#00ff88' : '#ff0080'};font-size:16px">${isCall ? '▲▲ COMPRA ▲▲' : '▼▼ VENTA ▼▼'}</div>
        <div class="entry-countdown" style="color:${isCall ? '#00ff88' : '#ff0080'}">¡¡ ENTRAR AHORA !!</div>
        <div style="font-size:9px;margin-top:4px;color:#fff">${currentTrend.toUpperCase()}</div>`;

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
        <div style="font-size:9px;margin-top:2px;color:#aaa">ESPERANDO OPORTUNIDAD</div>`;
    }
  } else {
    // Si hay parada pendiente, mostrar en UI
    if (isStopPending) {
        DOM.signalBox.className = 'sig-waiting';
        DOM.signalStatus.innerHTML = `
        <div class="signal-title" style="color:#ffff00;font-size:11px">FINALIZANDO</div>
        <div class="signal-subtitle" style="color:#fff;font-size:9px">Cerrando ciclo...</div>`;
    } else {
        DOM.signalBox.className = 'sig-waiting';
        DOM.signalStatus.innerHTML = `
        <div class="signal-title" style="color:#00ffff;font-size:11px">ANALIZANDO MERCADO</div>
        <div class="signal-subtitle" style="color:#888;font-size:9px">Buscando oportunidades...</div>`;
    }
  }
}

// ============= ACTUALIZACIÓN PERIÓDICA DE UI =============
let uiUpdateInterval = null;

function updateBotUI() {
  if (!isRunning) {
    // Bot detenido - mostrar mensaje inicial
    if (DOM.signalBox && DOM.signalStatus) {
      DOM.signalBox.className = 'sig-waiting';
      DOM.signalStatus.innerHTML = `
        <div class="signal-title" style="color:#00ffff;font-size:11px">INICIAR PARA ANALIZAR</div>
        <div class="signal-subtitle" style="color:#888;font-size:9px">Presiona el botón para comenzar</div>`;
    }
    return;
  }

  // Bot corriendo - verificar estado de warmup y actualizar UI
  checkWarmupStatus(); // Actualizar nivel de warmup
  updateWarmupUI();

  // Actualizar timer
  const now = Date.now() + config.timeOffset;
  const sec = Math.ceil((60000 - (now % 60000)) / 1000);

  if (DOM.timerText) {
    DOM.timerText.textContent = `⏱ Cierre: ${sec}s`;
  }
  if (DOM.timerFill) {
    const pct = ((60 - sec) / 60) * 100;
    DOM.timerFill.style.width = `${pct}%`;
    DOM.timerFill.style.background = sec <= 5 ? '#ff0080' : sec <= 15 ? '#ffff00' : '#00ffff';
  }

  // Actualizar runtime
  if (DOM.uiRuntime && startTime > 0) {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const h = Math.floor(elapsed / 3600);
    const m = Math.floor((elapsed % 3600) / 60);
    DOM.uiRuntime.textContent = `${h.toString().padStart(2,'0')}h ${m.toString().padStart(2,'0')}m`;
  }

  // Actualizar Signal Box basado en estado
  if (DOM.signalBox && DOM.signalStatus) {
    if (isStopPending && !tradeExecutedThisCandle && pendingTrades.length === 0 && !activeMartingaleTrade) {
         // Stop pending sin operaciones -> Esperando que checkSafeStop actúe, pero visualmente útil
         // (Aunque checkSafeStop debería detenerlo casi inmediatamente)
    } else if (!isSystemWarmedUp) {
      // Sistema cargando
      DOM.signalBox.className = 'sig-waiting';
      const analysisCandles = getAnalysisCandles();
      DOM.signalStatus.innerHTML = `
        <div class="signal-title" style="color:#ff00ff;font-size:12px">CARGANDO SISTEMA</div>
        <div class="signal-subtitle" style="color:#00ffff;font-size:9px">${systemWarmupLevel}% - ${analysisCandles.length}/${TARGET_CANDLES_FULL} velas</div>`;
    } else if (tradeExecutedThisCandle || pendingTrades.length > 0) {
      // Trade en progreso
      const isCall = lastTradeType === 'call';
      DOM.signalBox.className = isCall ? 'sig-possible-call' : 'sig-possible-put';
      DOM.signalStatus.innerHTML = `
        <div class="signal-title" style="color:${isCall ? '#00ff88' : '#ff0080'};font-size:14px">${isCall ? '▲ COMPRA' : '▼ VENTA'}</div>
        <div class="signal-subtitle" style="font-size:10px">ESPERANDO RESULTADO...</div>`;
    } else if (pendingSignal) {
      // Hay señal pendiente - esto se manejará en updateSignalUI con los segundos correctos
      // No hacer nada aquí para no sobreescribir
    } else {
        // Estado normal o Stop Pending visualizado en updateSignalUI
    }
  }
}

function startUIUpdateLoop() {
  if (uiUpdateInterval) clearInterval(uiUpdateInterval);
  // Actualizar UI cada 500ms para respuesta rápida
  uiUpdateInterval = setInterval(updateBotUI, 500);
  // También actualizar inmediatamente
  updateBotUI();
}

function stopUIUpdateLoop() {
  if (uiUpdateInterval) {
    clearInterval(uiUpdateInterval);
    uiUpdateInterval = null;
  }
  // Actualizar UI una última vez para mostrar estado detenido
  updateBotUI();
}

// ============= FUNCIÓN DE DIAGNÓSTICO EXHAUSTIVO V15 =============
function runDiagnostics() {
  logMonitor('🔍 === DIAGNÓSTICO PROFUNDO ===', 'info');
  
  // 1. ANÁLISIS DE BOTONES DE TRADING
  logMonitor('🖱️ Analizando Botones de Trading...', 'info');
  
  const buttons = Array.from(document.querySelectorAll('button'));
  const buyBtn = buttons.find(b => b.classList.contains('buy-button') || b.textContent.includes('ARRIBA'));
  const sellBtn = buttons.find(b => b.classList.contains('sell-button') || b.textContent.includes('ABAJO'));
  
  if (buyBtn) {
      const rect = buyBtn.getBoundingClientRect();
      const isVisible = rect.width > 0 && rect.height > 0;
      const isDisabled = buyBtn.disabled || buyBtn.getAttribute('aria-disabled') === 'true';
      logMonitor(`✅ Botón CALL encontrado:`, 'success');
      logMonitor(`   Clases: ${buyBtn.className}`, 'info');
      logMonitor(`   Visible: ${isVisible} | Disabled: ${isDisabled}`, isVisible && !isDisabled ? 'success' : 'blocked');
      // Auto-Test de Hover
      buyBtn.dispatchEvent(new MouseEvent('mouseover', {bubbles:true}));
  } else {
      logMonitor('❌ CRÍTICO: Botón CALL NO encontrado en DOM', 'blocked');
  }

  if (sellBtn) {
      const rect = sellBtn.getBoundingClientRect();
      const isVisible = rect.width > 0 && rect.height > 0;
      const isDisabled = sellBtn.disabled || sellBtn.getAttribute('aria-disabled') === 'true';
      logMonitor(`✅ Botón PUT encontrado:`, 'success');
      logMonitor(`   Clases: ${sellBtn.className}`, 'info');
      logMonitor(`   Visible: ${isVisible} | Disabled: ${isDisabled}`, isVisible && !isDisabled ? 'success' : 'blocked');
  } else {
      logMonitor('❌ CRÍTICO: Botón PUT NO encontrado en DOM', 'blocked');
  }

  // 2. ESTADO INTERNO DEL BOT
  logMonitor('🧠 Estado Lógico del Bot:', 'info');
  logMonitor(`   AutoTrade: ${config.autoTrade ? 'ON' : 'OFF'}`, config.autoTrade ? 'success' : 'blocked');
  logMonitor(`   Stop Pendiente: ${isStopPending ? 'SÍ' : 'NO'}`, isStopPending ? 'blocked' : 'success');
  logMonitor(`   Trades Pendientes: ${pendingTrades.length}`, pendingTrades.length > 0 ? 'pattern' : 'info');
  logMonitor(`   Martingala Activa: ${activeMartingaleTrade ? 'SÍ' : 'NO'}`, activeMartingaleTrade ? 'pattern' : 'info');
  logMonitor(`   Warmup: ${systemWarmupLevel}% (${isSystemWarmedUp ? 'Listo' : 'Cargando'})`, isSystemWarmedUp ? 'success' : 'pattern');

  // 3. DATOS DE MERCADO
  logMonitor('📈 Datos de Mercado:', 'info');
  logMonitor(`   Velas procesadas: ${candles.length}`, 'info');
  if (currentCandle) {
      logMonitor(`   Vela Actual: O:${currentCandle.o} C:${currentCandle.c}`, 'info');
  }
  
  logMonitor('=================================', 'info');
}

// ============= HELPER DE EJECUCIÓN CON LOGS =============
function executeTradeWithRetry(type, maxRetries) {
  logMonitor(`⚡ INICIANDO PROTOCOLO DE EJECUCIÓN: ${type.toUpperCase()}`, 'info');
  
  const selector = type === 'call' ? '.buy-button' : '.sell-button';
  
  const attemptClick = (retriesLeft) => {
      // DIAGNÓSTICO EN TIEMPO REAL
      const allButtons = document.querySelectorAll('button');
      const btn = document.querySelector(selector);
      
      if (!btn) {
          logMonitor(`🔍 Búsqueda ${type}: Selector '${selector}' falló. Total botones en pág: ${allButtons.length}`, 'blocked');
      }
      
      if (btn) {
          // Estado visual del botón
          const rect = btn.getBoundingClientRect();
          const isVisible = rect.width > 0 && rect.height > 0;
          
          if (!isVisible) {
              logMonitor(`⚠️ ALERTA: Botón ${type} encontrado pero invisible (0x0)`, 'blocked');
          }
          
          if (btn.disabled) {
              logMonitor(`⚠️ ALERTA: Botón ${type} deshabilitado (disabled attr)`, 'blocked');
          }

          logMonitor(`🎯 Botón ${type.toUpperCase()} DETECTADO y LISTO. Clickeando...`, 'success');
          
          try {
              btn.style.border = '2px solid yellow'; // Feedback visual debug
              btn.focus();

              // Click único nativo - Ant Design/React responde a este evento
              btn.click();
              
              setTimeout(() => btn.style.border = '', 500); // Limpiar debug
              
              logMonitor(`✅ COMANDO DE CLICK ENVIADO A ${type.toUpperCase()}`, 'success');
              return true;
          } catch(e) {
              logMonitor(`⚠️ EXCEPCIÓN AL CLICKEAR: ${e.message}`, 'blocked');
          }
      } else {
          if (retriesLeft > 0) {
              logMonitor(`⏳ Reintentando buscar botón ${type}... (${retriesLeft})`, 'info');
              setTimeout(() => attemptClick(retriesLeft - 1), 500);
          } else {
              logMonitor(`❌ ERROR FATAL: No se pudo clickear ${type.toUpperCase()} tras varios intentos.`, 'blocked');
              
              // Fallback Texto
              logMonitor('🔄 Intentando fallback por TEXTO...', 'info');
              const textToFind = type === 'call' ? 'ARRIBA' : 'ABAJO';
              const fallbackBtn = Array.from(document.querySelectorAll('button'))
                  .find(b => b.textContent.includes(textToFind));
                  
              if (fallbackBtn) {
                  logMonitor(`⚠️ Botón por texto encontrado. Clickeando...`, 'pattern');
                  fallbackBtn.click();
              } else {
                  logMonitor(`❌ Fallback también falló. Revisar DOM.`, 'blocked');
              }
          }
      }
  };
  
  attemptClick(maxRetries);
}

// ============= MESSAGE HANDLERS =============
window.addEventListener('message', e => {
  if (e.data.type === 'SNIPER_TOGGLE_UI') {
    if (!isSystemReady) initSystem();
    
    isVisible = !isVisible;
    if (DOM.hud) {
        DOM.hud.classList.toggle('visible', isVisible);
        DOM.hud.style.display = isVisible ? 'flex' : 'none';
    }
    
    if (isVisible) readAccount();
    else stopBot(true);
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
