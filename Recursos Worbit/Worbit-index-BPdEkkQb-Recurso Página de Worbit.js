// --- Imports ---
// This imports various functions and objects from a vendor bundle.
// The renaming (e.g., 'a' as 'e', 'c' as 't') suggests this code has been minified.
import {
  a as e, // Likely Zustand store creator function (e.g., create)
  c as t, // Possibly React.createElement or another utility
  p as r, // Likely Zustand persist middleware
  D as o, // Likely Luxon DateTime object
  l as a, // Likely Socket.IO client constructor
  s as i, // Likely Ant Design notification object
  r as n, // Likely React hooks (useState, useEffect, etc.)
  u as s, // Likely react-router-dom hooks
  j as l, // Likely React's jsx runtime function
  L as c, // Likely Ant Design Spin component
  C as d, // Likely Ant Design ConfigProvider component
  S as g, // Likely Ant Design Space component
  R as p, // Likely Ant Design Icon component
  b as u, // Likely Ant Design Typography object
  O as m, // Likely Ant Design Modal component
  d as h, // Likely react-router-dom hook
  M as f, // Likely Ant Design Button component
  e as b, // Likely Ant Design message object
  f as S, // Likely Ant Design Statistic object
  T as y, // Likely Ant Design Paragraph component
  F as v, // Likely Ant Design Flex component
  g as w, // Likely React's Fragment component
  h as C, // Likely Ant Design theme objects
  t as T, // Likely Ant Design theme algorithm
  i as P, // Likely react-i18next translation function
  k as _, // Likely React Router's Router component
  m as E  // Likely ReactDOM's createRoot function
} from "./vendor-DTKMZfiH.js";

// --- Module Preload Polyfill ---
// Checks if browser supports modulepreload, otherwise fetches links manually.
!function () {
  const e = document.createElement("link").relList;
  if (!(e && e.supports && e.supports("modulepreload"))) {
    for (const e of document.querySelectorAll('link[rel="modulepreload"]')) t(e);
    new MutationObserver(e => {
      for (const r of e)
        if ("childList" === r.type)
          for (const e of r.addedNodes)
            "LINK" === e.tagName && "modulepreload" === e.rel && t(e)
    }).observe(document, { childList: !0, subtree: !0 })
  }

  function t(e) {
    if (e.ep) return;
    e.ep = !0;
    const t = function (e) {
      const t = {};
      return e.integrity && (t.integrity = e.integrity),
        e.referrerPolicy && (t.referrerPolicy = e.referrerPolicy),
        "use-credentials" === e.crossOrigin ? t.credentials = "include" :
          "anonymous" === e.crossOrigin ? t.credentials = "omit" : t.credentials = "same-origin",
        t
    }(e);
    fetch(e.href, t)
  }
}();

// --- API Client Factory ---
const k = t => {
  const r = {};
  r["x-timestamp"] = Date.now();
  return e.create({
    baseURL: t,
    headers: { ...r },
    timeout: 3e4 // 30 seconds
  });
};

// --- Settings Store (Zustand) ---
// Manages application settings like OTC URLs, colors, language, server time.
const D = t()(
  r(
    e => ({
      secondIntervalTimer: 0,
      setSecondIntervalTimer: t => { e({ secondIntervalTimer: t }) },
      otcApiUrl: "",
      otcApiKey: "",
      otcWsUrl: "",
      disabledFeatures: [],
      serverTime: (new Date).getTime(),
      setServerTime: t => { e({ serverTime: t }) },
      setOtcApiUrl: t => { e({ otcApiUrl: t }) },
      setOtcApiKey: t => { e({ otcApiKey: t }) },
      setOtcWsUrl: t => { e({ otcWsUrl: t }) },
      bgSelected: "default_chart_bg.png",
      setBgSelected: t => { e({ bgSelected: t }) },
      upColor: void 0,
      downColor: void 0,
      backgroundColorGraphic: void 0,
      colorIconGraphic: void 0,
      colorActiveHover: void 0,
      setUpColor: t => { e({ upColor: t }) },
      setDownColor: t => { e({ downColor: t }) },
      setBackgroundColorGraphic: t => { e({ backgroundColorGraphic: t }) },
      setColorIconGraphic: t => { e({ colorIconGraphic: t }) },
      setColorActiveHover: t => { e({ colorActiveHover: t }) },
      language: "en",
      setLanguage: t => { e({ language: t }) }
    }),
    { name: "setting-store", partialize: e => ({ otcApiUrl: e.otcApiUrl, otcApiKey: e.otcApiKey, otcWsUrl: e.otcWsUrl, language: e.language }) } // Persists specific settings
  )
);

// --- OTC Data API Class ---
// Provides methods to fetch OTC symbol information and historical prices via HTTP.
class O {
  static symbols(e) { // Fetches available symbols for a given slot
    const { otcApiUrl: t, otcApiKey: r } = D.getState();
    if (!t || !r) { throw new Error("OTC API URL or API Key is not set") }
    return k(t).get("/symbols", { params: { slot: e, active: !0 }, headers: { "api-key": r } })
  }

  static async fetchAllOtcData(e, t, r, o, a, i) { // Fetches historical data, handles pagination
    const { otcApiUrl: n, otcApiKey: s } = D.getState();
    if (!n || !s) { throw new Error("OTC API URL or API Key is not set") }
    const l = [];
    let c = 0, d = !0;
    while (d) {
      try {
        const g = await k(n).get("aggregated-prices/prices", {
          headers: { "api-key": s },
          params: { slot: e, pair: a, startTime: r, endTime: o, type: i, interval: t, skip: c, limit: 500 }
        });
        if (g.data.length === 0) {
          d = false; // No more data
        } else {
          l.push(...g.data);
          if (g.data.length < 500) d = false; // Reached last page
          c += 500;
        }
      } catch (g) {
        d = false; // Stop on error
      }
    }
    return l;
  }
}

// --- Chart UI State Store (Zustand) ---
// Manages loading states, drawer visibility, historic view state.
const I = t()(
  (e, t) => ({
    otcApiUrl: void 0,
    otcApiKey: void 0,
    otcWsUrl: void 0,
    loadingCandles: !1,
    setLoadingCandles: t => { e({ loadingCandles: t }) },
    loading: !0,
    setLoading: t => { e({ loading: t }) },
    showDrawer: !1,
    setShowDrawer: r => { e({ showDrawer: void 0 !== r ? r : !t().showDrawer }) },
    openHistoric: !1,
    setOpenHistoric: t => { e({ openHistoric: t }) },
    loadingTrade: !1,
    setLoadingTrade: t => { e({ loadingTrade: t }) }
  })
);

// --- Selected Symbol Store (Zustand) ---
// Stores currently selected symbol and hover states for buy/sell buttons.
const L = t()(
  r(
    e => ({
      lastSymbolPrice: 0,
      setLastSymbolPrice: t => { e({ lastSymbolPrice: t }) },
      isHoveringSellButton: !1,
      isHoveringBuyButton: !1,
      setHoveringSellButton: t => { e({ isHoveringSellButton: t }) },
      setHoveringBuyButton: t => { e({ isHoveringBuyButton: t }) },
      symbolSlot: void 0,
      setSymbolSlot: t => { e({ symbolSlot: t }) },
      symbolSelected: void 0,
      setSymbolSelected: t => { e({ symbolSelected: t }) }
    }),
    { name: "symbol-store" }
  )
);

// --- Maps for Caching/Tracking ---
const M = new Map; // Stores latest price for each symbol ticker

// --- Helper Functions ---

// Fetches and sets the selected symbol by ticker and slot
async function N(e, t) {
  const r = await async function (e, t) { // Inner helper to find symbol data
    const { data: r } = await O.symbols(e);
    return r.find(e => e.ticker === t)
  }(e, t);
  if (!r) return;
  const { setSymbolSelected: o } = L.getState();
  o(r)
}

// Gets the cached price for a symbol
function F(e) {
  return M.get(e) || 0
}

// Resolution mapping (e.g., "5S" -> "5s")
const B = new Map; // Maps subscription IDs to WebSocket instances
const U = { "5S": "5s", "30S": "30s", 1: "1m", 2: "2m", 5: "5m", 15: "15m", 30: "30m", 60: "1h", 720: "12h", "1D": "1d" };
const A = new Map; // Maps subscription IDs to callback objects

// --- TradingView Datafeed Interface ---
// Implements the interface expected by TradingView's charting library.
// This is the core of how the app feeds data into the chart.
const x = (e, t) => ({
  supports_time: true,
  onReady: t => {
    setTimeout(() => {
      t((e => ({
        exchanges: [{ value: e.exchangeDisplay, name: e.exchangeDisplay, desc: e.exchangeDisplay }],
        supported_resolutions: e.supportedResolutions,
        symbols_types: [{ name: e.type, value: e.type }]
      }))(e))
    }, 0)
  },
  searchSymbols: async (e, t, r, o) => { o([]) }, // Currently returns empty array
  resolveSymbol: async (t, r, o) => {
    try {
      r({
        symbol: t, ticker: t, name: t, full_name: t, description: e.name, exchange: e.exchange, listed_exchange: e.exchange,
        type: e.type, currency_code: t, session: "24x7", timezone: "UTC",
        minmovement: 2, minmov: 1, minmovement2: 0, minmov2: 0,
        enabled_features: ["seconds_resolution", "tick_resolution"],
        has_seconds: true, pricescale: e.priceScale, supported_resolutions: e.supportedResolutions,
        has_intraday: true, has_daily: true, has_weekly_and_monthly: true, data_status: "streaming"
      })
    } catch (a) {
      o("cannot resolve symbol")
    }
  },
  getBars: async (r, a, n, s, l = e => { }) => { // Fetches historical bars
    try {
      const { setLastSymbolPrice: r } = L.getState();
      const { setLoadingCandles: d } = I.getState();
      const { from: g, to: p } = n;
      let u = [];

      const m = U[a]; // Convert resolution key
      const h = Math.floor(1e3 * g);
      const f = Math.floor(1e3 * p);

      try {
        d(true); // Start loading indicator
        if ("1m" === m) {
          // Handle 1-minute data with weekly chunks to avoid API limits
          const r = o.fromMillis(h);
          const a = o.fromMillis(f);
          const i = a.diff(r, "days").days;
          if (i > 7) {
            const o = Math.ceil(i / 7);
            for (let i = 0; i < o; i++) {
              const n = r.plus({ days: 7 * i });
              const s = i === o - 1 ? a : n.plus({ days: 7 });
              const l = await O.fetchAllOtcData(t, m, n.toMillis(), s.toMillis(), e.ticker, e.type);
              u.push(...l);
            }
          } else {
            u = await O.fetchAllOtcData(t, m, h, f, e.ticker, e.type);
          }
        } else {
          // Handle other resolutions with monthly chunks
          const r = o.fromMillis(h);
          const a = o.fromMillis(f);
          const i = a.diff(r, "days").days;
          if (i > 30) {
            const o = Math.ceil(i / 30);
            for (let i = 0; i < o; i++) {
              const n = r.plus({ days: 30 * i });
              const s = i === o - 1 ? a : n.plus({ days: 30 });
              const l = await O.fetchAllOtcData(t, m, n.toMillis(), s.toMillis(), e.ticker, e.type);
              u.push(...l);
            }
          } else {
            u = await O.fetchAllOtcData(t, m, h, f, e.ticker, e.type);
          }
        }
      } catch (c) {
        const e = function (e) { // Format error message
          let t = "";
          if (e) {
            let r = e.response?.data?.data?.message || e.response?.data?.message || e.response?.data.data || e.message || e;
            if (typeof r === "object") r = JSON.stringify(r);
            t = r;
          }
          return t;
        }(c);
        i.error({ message: "Error fetching Symbol data", description: e, placement: "topRight" });
        l(new Error(e));
        return; // Exit on error
      } finally {
        d(false); // Stop loading indicator
      }

      if (!u.length) return void s([], { noData: true });

      const b = u.sort((e, t) => +e.time - +t.time).map(e => ({ // Format data for TV
        time: +e.time, open: +e.openPrice, high: +e.highPrice, low: +e.lowPrice, close: +e.closePrice, volume: 0
      }));

      if (b.length) r(b[b.length - 1].close); // Update last price
      s(b, { noData: 0 === b.length }); // Send data back to TV
    } catch (c) {
      l(c) // Pass error back to TV
    }
  },
  subscribeBars: (r, o, i, n) => { // Sets up real-time updates via WebSocket
    const { otcWsUrl: s } = D.getState();
    if (!s) { throw new Error("OTC WS URL is not set") }

    const l = a(`${s}/symbol-prices`, { // Create WebSocket connection
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 5e3,
      reconnectionAttempts: 10,
      reconnectionDelayMax: 1e4,
      transports: ["websocket"]
    });

    A.set(n, { onRealtimeCallback: i, ws: l }); // Store callbacks
    B.set(n, l); // Store socket instance

    window.postMessage({ type: "apply-style", data: { resolution: o } }); // Notify parent iframe

    let c = null; // Holds previous bar for smooth interpolation

    l.on("connect", () => { // On successful connection
      window.postMessage({ type: "apply-style", data: { resolution: o } });
      window.postMessage({ type: "chart-ready" });
      window.parent.postMessage({ type: "chart-ready" }, "*");
      I.getState().setLoadingTrade(false);
      l.emit("last-symbol-price", `${t}:${e.ticker}`);
    });

    l.on("message", t => { // Handle incoming price messages
      if ("symbol.price.update" !== t.event) return;
      const [, r] = t.channel.split(":"); // Extract ticker from channel
      if (r === e.ticker && (t.data && t.data.pair === e.ticker)) {
        const e = { // Format the new bar
          time: +t.data.time, open: +t.data.openPrice, high: +t.data.highPrice, low: +t.data.lowPrice, close: +t.data.closePrice, volume: 0
        };

        const o = r;
        const a = +t.data.closePrice;
        M.set(o, a); // Cache the new price
        window.parent.postMessage({ type: "last-symbol-price", data: { ticker: r, time: +t.data.time, price: +t.data.closePrice } }, "*");

        const s = A.get(n); // Get the callback for this subscription
        if (s) {
          if (c) {
            // Smooth interpolation between previous and new bar
            ((e, t, r, o) => {
              const a = Date.now();
              const n = () => {
                if (t.time <= e.time || "visible" !== document.visibilityState) return;
                const i = Date.now() - a;
                if (i >= r) return o(t), void (c = t);
                const s = i / r;
                const l = {
                  time: t.time, open: e.open + s * (t.open - e.open), high: e.high + s * (t.high - e.high),
                  low: e.low + s * (t.low - e.low), close: e.close + s * (t.close - e.close), volume: t.volume
                };
                o(l);
                requestAnimationFrame(n)
              };
              if ("visible" !== document.visibilityState && e.time < t.time) return i(t), c = t, void o(t);
              n()
            })(c, e, 300, s.onRealtimeCallback);
          } else {
            s.onRealtimeCallback(e); // Send the new bar directly
            c = e; // Set it as the previous bar
          }
        }
      }
    });
  },
  unsubscribeBars: e => { // Clean up WebSocket subscription
    const t = A.get(e);
    const { setLastSymbolPrice: r } = L.getState();
    r(0); // Reset last price
    if (t) {
      t.ws.close();
      A.delete(e);
    }
  },
  getServerTime: e => { // Attempts to get server time (currently uses local time)
    try {
      setTimeout(() => {
        const t = D.getState().serverTime;
        const r = o.fromMillis(t).toUnixInteger();
        e(r)
      }, 1500)
    } catch (t) { }
  }
});

// --- TradingView Chart Storage Store (Zustand) ---
// Handles saving/loading chart layouts, drawings, and shapes.
const G = t()(
  r(
    (e, t) => ({
      charts: [],
      orderShapes: [],
      resultShapes: [],
      addResultShape: r => { e({ resultShapes: [...t().resultShapes, r] }) },
      removeResultShape: r => { e({ resultShapes: t().resultShapes.filter(e => e.orderId !== r) }) },
      addOrderShape: r => { e({ orderShapes: [...t().orderShapes, r] }) },
      removeOrderShape: r => { e({ orderShapes: t().orderShapes.filter(e => e.orderId !== r) }) },
      saveChart: r => { e({ charts: [...t().charts.filter(e => e.symbol !== r.symbol), r] }) },
      removeChart: r => { e({ charts: t().charts.filter(e => e.id !== r) }) }
    }),
    { name: "tradingview-storage", partialize: e => ({ charts: e.charts }) } // Persists charts
  )
);

// --- Chart Utility Functions ---

// Adjusts chart visible range based on resolution
const R = e => {
  const t = { "5S": 2, "30S": 10, 1: 40, 5: 80, "5m": 160, 15: 320, 30: 740, 60: 1440, 720: 17280, "1D": 34560 }[e];
  if (t) {
    const e = o.now().minus({ minutes: t }).toSeconds();
    const r = o.now().plus({ minutes: t / 2 }).toSeconds();
    window.tvWidget.activeChart().setVisibleRange({ from: e, to: r })
  }
};

// Applies custom styles and configurations to the TradingView chart widget
const W = e => {
  if (window.tvWidget && window.tvWidget && window.tvWidget.activeChart()) {
    window.tvWidget.activeChart().getTimeScale().setBarSpacing(3.5);
    if (e) R(e);
    window.tvWidget.activeChart().onIntervalChanged().subscribe(null, e => { R(e) });

    const { upColor: t, downColor: r, backgroundColorGraphic: o, colorIconGraphic: a, colorActiveHover: i } = D.getState();
    // Apply series style overrides
    window.tvWidget.activeChart().getSeries().setChartStyleProperties(1, {
      upColor: t || "#08C58A", downColor: r || "#FF025C",
      borderUpColor: t || "#08C58A", borderDownColor: r || "#FF025C",
      wickUpColor: t || "#08C58A", wickDownColor: r || "#FF025C",
      backgroundColorGraphic: o || "#141418", colorIconGraphic: a || "#FFFFFF", colorActiveHover: i || "#FFFFFF"
    });

    // Apply general chart overrides
    window.tvWidget.activeChart().applyOverrides({
      showCountdown: true,
      "paneProperties.backgroundType": "solid",
      "paneProperties.separatorColor": "#141418",
      "mainSeriesProperties.lineStyle.linewidth": 0,
      "paneProperties.topMargin": 30,
      "paneProperties.bottomMargin": 20,
      "paneProperties.vertGridProperties.color": "#ffffff05",
      "paneProperties.vertGridProperties.style": 0,
      "paneProperties.horzGridProperties.color": "#ffffff05",
      "paneProperties.horzGridProperties.style": 0,
      "scalesProperties.textColor": "#FFFFFF",
      "scalesProperties.fontSize": 14,
      "paneProperties.background": "rgba(0, 0, 0, 0)",
      "paneProperties.backgroundGradientStartColor": "rgba(0, 0, 0, 0)",
      "paneProperties.backgroundGradientEndColor": "rgba(0, 0, 0, 0)",
      "mainSeriesProperties.candleStyle.upColor": t || "#00FF00",
      "mainSeriesProperties.candleStyle.downColor": r || "#FF0000",
      "mainSeriesProperties.candleStyle.wickUpColor": t || "#00FF00",
      "mainSeriesProperties.candleStyle.wickDownColor": r || "#FF0000",
      "mainSeriesProperties.candleStyle.barColorsOnPrevClose": false,
      "mainSeriesProperties.esdShowEarnings": false,
      "paneProperties.legendProperties.showLegend": true,
      "paneProperties.legendProperties.showLogo": false,
      "paneProperties.legendProperties.showSeriesTitle": false,
      "paneProperties.legendProperties.showSeriesOHLC": false,
      "paneProperties.legendProperties.showBarChange": false,
      "paneProperties.legendProperties.showVolume": false
    });
  }
};

// --- Initializes the TradingView Widget ---
// Creates the main TradingView widget instance with the datafeed and settings.
const H = (e, t, r, o) => {
  const { symbolSelected: a, symbolSlot: i } = L.getState();
  if (!a || !i) return;

  const n = x(a, i); // Get the datafeed instance
  const s = Intl.DateTimeFormat().resolvedOptions().timeZone;

  if (t) try { localStorage.removeItem("tradingview.ChartDrawingToolbarWidget.visible") } catch (l) { }

  window.tvWidget = new window.TradingView.widget({
    container: "chartContainer",
    auto_save_delay: 1,
    locale: o || "en",
    library_path: "/charting_library/",
    custom_css_url: "/charting_library/custom.css",
    datafeed: n,
    symbol: a.ticker,
    timezone: s,
    interval: e,
    theme: "dark",
    allow_symbol_change: false,
    details: false,
    hotlist: false,
    withdateranges: false,
    hide_side_toolbar: !t,
    calendar: false,
    enabled_features: [
      t ? "hide_left_toolbar_by_default" : "", "left_toolbar", "use_localstorage_for_settings",
      "seconds_resolution", "edit_object", "edit_object_dialog", "hide_symbol_legend_by_default",
      "custom_resolutions", "iframe_loading_compatibility_mode"
    ],
    chartsStorageApiVersion: "1.1",
    client_id: "tradingview.com",
    user_id: "public_user_id",
    charts_storage_url: "teste", // Note: Placeholder URL
    load_last_chart: true,
    auto_save: true,
    show_volume: false,
    time_frames: [],
    disabled_features: [
      t ? "legend_widget" : "", "header_settings", "timeframes_toolbar", "header_undo_redo",
      "header_compare", "remove_library_container_border", "header_fullscreen_button",
      "header_screenshot", "header_settings", "header_symbol_search", "logo_background",
      "widget_logo", "tradingview_copyright", "copyright_labels"
    ],
    height: "100%",
    width: "100%",
    overrides: {
      showCountdown: true,
      "background.": "rgba(0, 0, 0, 0)",
      "paneProperties.background": "rgba(0, 0, 0, 0)",
      "paneProperties.separatorColor": "rgba(0, 0, 0, 0)",
      "scalesProperties.fontSize": 10,
      "paneProperties.backgroundType": "gradient",
      "paneProperties.backgroundGradientStartColor": "rgba(0, 0, 0, 0)",
      "paneProperties.backgroundGradientEndColor": "rgba(0, 0, 0, 0)",
      "paneProperties.topMargin": 5,
      "paneProperties.bottomMargin": 5
    },
    toolbar_bg: "#141418",
    loading_screen: { backgroundColor: "#000305", foregroundColor: "#00060A" },
    debug: false,
    save_load_adapter: { // Custom adapter for saving/loading charts using Zustand/G
      charts: G.getState().charts.filter(e => e.symbol === a.name),
      getAllCharts: function () { return Promise.resolve(this.charts) },
      removeChart: function (e) { return G.getState().removeChart(e), Promise.resolve(e) },
      saveChart: function (e) {
        if (!e.id) e.id = Math.random().toString();
        const t = { ...e, id: e.id, timestamp: Math.round(Date.now() / 1e3), symbol: a.name };
        return G.getState().saveChart(t), Promise.resolve(e.id)
      },
      getChartContent: function (e) { return Promise.resolve(G.getState().charts.find(t => t.id === e)?.content) }
    }
  });

  window.tvWidget.onChartReady(function () {
    // Post-processing after chart loads
    const e = document.querySelector("#chartContainer");
    if (e) {
      const t = e.children[0]?.contentWindow?.document;
      if (!t) return;
      const r = D.getState().bgSelected;
      const o = D.getState().backgroundColorGraphic;
      const a = D.getState().colorIconGraphic;
      const i = D.getState().colorActiveHover;

      j(t, r); // Apply background image
      Q(t, o, [".group-MBOVGQRI", ".layout-with-border-radius", /* ... other selectors */ ]); // Apply background colors
      K(t, a, [".button", ".button-KTgbfaP5", /* ... other selectors */ ]); // Apply icon/text colors
      z(t, i, [".button-KTgbfaP5.isActive-KTgbfaP5 .bg-KTgbfaP5", /* ... other selectors */ ]); // Apply hover/active colors

      // Disable default interactions on iframe content
      const n = () => { };
      t.onload = n; t.onmousemove = n; t.onmousedown = n; t.ontouchstart = n; t.onclick = n; t.onkeydown = n;
    }

    // Load saved chart layout if exists
    const o = G.getState().charts.find(e => e.symbol === a.name);
    if (o) {
      const e = JSON.parse(JSON.parse(o.content).content);
      window.tvWidget.load(e, { name: o.name, uid: o.id });
    }

    const i = window.tvWidget;
    // Resize chart on window resize
    window.addEventListener("resize", () => {
      if (t && !r) {
        const e = Math.max(window.innerHeight - 200, 300);
        i.resize(e, "100%")
      }
    });

    setTimeout(() => {
      // Auto-save chart to Zustand storage
      i.subscribe("onAutoSaveNeeded", () => {
        i.saveChartToServer(e => { }, e => { }, { defaultChartName: a.name });
      });
      setTimeout(() => {
        try { i.saveChartToServer(e => { }, e => { }, { defaultChartName: a.name }) } catch (e) { }
      }, 1e3);
    }, 1e3);
  });
};

// --- Styling Helper Functions ---
// These apply custom CSS styles to elements within the TradingView iframe's document.

// Applies background image
const j = (e, t) => {
  if (!e || !t) return;
  const r = e.querySelector(".chart-container-border");
  if (r) {
    const e = t.startsWith("http") ? `url('${t}')` : `url('/${t}')`;
    r.style.backgroundImage = e;
    r.style.backgroundRepeat = "no-repeat";
    r.style.backgroundPosition = "center center";
    r.style.backgroundSize = "cover";
  }
};

// Applies background color to elements matching selectors
const Q = (e, t, r = []) => {
  e && t && r.forEach(r => {
    if (r.endsWith("::before") || r.endsWith("::after")) {
      // Handle pseudo-elements
      const o = `dynamic-pseudo-color-${r.replace(/::(before|after)$/, "").replace(/[^a-zA-Z0-9]/g, "")}`;
      let a = e.getElementById(o);
      if (!a) {
        a = e.createElement("style");
        a.id = o;
        e.head.appendChild(a);
      }
      a.innerHTML = `\n        ${r} {\n          color: ${t} !important;\n          background-color: ${t} !important;\n        }\n      `;
    } else {
      e.querySelectorAll(r).forEach(e => { e.style.backgroundColor = t });
    }
  });
};

// Applies text color to elements matching selectors
const K = (e, t, r = []) => {
  if (!e || !t) return;
  const o = e.querySelector(".chart-container-border");
  if (o) o.style.setProperty("color", t, "important");
  r.forEach(r => { e.querySelectorAll(r).forEach(e => { e.style.setProperty("color", t, "important") }) });
};

// Applies background color via dynamic style tag for complex selectors
const z = (e, t, r = []) => {
  e && t && r.length && r.forEach(r => {
    const o = `dynamic-style-${r.replace(/[^a-zA-Z0-9]/g, "")}`;
    let a = e.getElementById(o);
    if (!a) {
      a = e.createElement("style");
      a.id = o;
      a.type = "text/css";
      e.head.appendChild(a);
    }
    a.innerHTML = `\n      ${r} {\n        background-color: ${t} !important;\n      }\n    `;
  });
};

// --- Enums and Formatting Utilities ---

// Trade directions
var V = (e => (e.BUY = "BUY", e.SELL = "SELL", e.LONG = "LONG", e.SHORT = "SHORT", e))(V || {});

// Trade results
var $ = (e => (e.WON = "WON", e.LOST = "LOST", e.DRAW = "DRAW", e.PENDING = "PENDING", e.HOLD = "HOLD", e.OPENED = "OPENED", e))($ || {});

// Expiration types
var J = (e => (e.TIME_FIXED = "TIME_FIXED", e.CANDLE_CLOSE = "CANDLE_CLOSE", e.NEXT_CANDLE = "NEXT_CANDLE", e))(J || {});

// Expiration times
var q = (e => (e.FIVE_SECONDS = "00:05", e.TEN_SECONDS = "00:10", e.THIRTY_SECONDS = "00:30", e.ONE_MINUTE = "01:00", e.TWO_MINUTES = "02:00", e.FIVE_MINUTES = "05:00", e.FIFTEEN_MINUTES = "15:00", e.THIRTY_MINUTES = "30:00", e.ONE_HOUR = "1:00:00", e))(q || {});

// Formats number as USD currency string
function Y(e, t) {
  e = e || 0; // Default to 0 if falsy
  return e.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: t });
}

// Gets current server time from Zustand store or local time
const Z = () => {
  const e = D.getState().serverTime;
  return e || (new Date).getTime();
};

// --- Expiration Logic Variables ---
let X; // Close type (e.g., CANDLE_CLOSE, NEXT_CANDLE)
let ee; // Expiration type

function te(e) { X = e; }
function re() { return X; }

// Calculates the expiration time for a trade based on current time, close type, and configured duration
function oe() {
  const e = re(); // Duration
  const t = ee; // Type
  const r = o.fromMillis(Z()).toJSDate();
  let a = o.fromMillis(Z()).toJSDate(); // Default expiration time
  const i = ie(e); // Duration in milliseconds
  const n = o.fromJSDate(ae(r.getTime(), i)); // Rounded start time
  const s = o.fromMillis(n.toMillis() + i); // End of current candle period
  const l = o.fromMillis(s.toMillis() + i); // End of next candle period

  if (t === J.CANDLE_CLOSE) {
    // Expires 30s before candle closes (current or next depending on proximity)
    const c = o.fromMillis(n.toMillis() + i);
    const d = o.fromJSDate(r);
    const g = c.diff(d, "seconds");
    a = g.seconds > 30 ? c.minus({ seconds: 30 }).toJSDate() : l.minus({ seconds: 30 }).toJSDate();
  } else if (t !== J.NEXT_CANDLE && t !== J.TIME_FIXED) {
    // Default case (should likely be TIME_FIXED)
    a = c.toJSDate();
  } else {
    // NEXT_CANDLE or TIME_FIXED
    a = c.toJSDate();
  }
  return a;
}

// Rounds a timestamp down to the nearest multiple of a given interval
function ae(e, t) {
  return new Date(Math.floor(e / t) * t);
}

// Converts string duration to milliseconds
function ie(e) {
  return {
    [q.FIVE_SECONDS]: 5e3, [q.TEN_SECONDS]: 1e4, [q.THIRTY_SECONDS]: 3e4,
    [q.ONE_MINUTE]: 6e4, [q.TWO_MINUTES]: 12e4, [q.FIVE_MINUTES]: 3e5,
    [q.FIFTEEN_MINUTES]: 9e5, [q.THIRTY_MINUTES]: 18e5, [q.ONE_HOUR]: 36e5
  }[e];
}

// Margin modes
var ne = (e => (e.ISOLATED = "isolated", e.CROSSED = "crossed", e))(ne || {});

// Calculates profit/loss for futures trades
function se(e, t, r, o, a, i) {
  let n = 0, s = 0;
  n = i === V.LONG ? o - r : r - o; // Price difference
  const l = e * a * n; // Raw PnL

  if (t === ne.ISOLATED) {
    const t = e * a * n / r; // PnL based on entry margin
    s = t;
    if (t < 0 && Math.abs(t) > e) s = -e; // Cap loss to initial margin
  }
  if (t === ne.CROSSED) {
    s = l; // PnL based on total position size
  }
  return s;
}

// --- Localization ---
const le = {
  en: { candleTime: "Candle Time", priceProjection: "Price Projection", /* ... */ },
  pt: { candleTime: "Tempo da Vela", priceProjection: "Projeção de Preço", /* ... */ },
  es: { candleTime: "Tiempo de Vela", priceProjection: "Proyección de Precio", /* ... */ }
};
const ce = (e, t = "en") => le[t]?.[e] || le.en[e] || e;

// --- Order/Result Shape Management Variables ---
let de = [], ge = [], pe = []; // Arrays to hold IDs of temporary chart entities

// Check if TradingView widget is ready
const ue = () => !!window?.tvWidget?._ready && !!window?.tvWidget?.activeChart();

// Updates order line quantities (e.g., PnL countdown for CFDs, final PnL for Futures)
const me = () => {
  const e = G.getState().orderShapes;
  const t = Z();
  for (const { order: r, shape: o } of e) {
    if (r.orderType === "FUTURES") {
      const e = F(r.symbol); // Get latest price
      const t = se(r.amount, r.marginMode, r.openPrice, e, r.leverage, r.direction); // Calculate PnL
      o?.setQuantity(`${Y(t)}`); // Update quantity display
    } else {
      const e = Pe(r); // Get countdown string
      o?.setQuantity(`${e}`); // Update quantity display
      if (r.closeTime && t >= r.closeTime) fe(r.id); // Remove shape if trade closed
    }
  }
};

// Find an order shape by its ID
function he(e) {
  return G.getState().orderShapes.find(t => t.orderId === e);
}

// Remove an order shape from the chart and store
function fe(e) {
  if (!ue()) return;
  const t = he(e);
  if (t) {
    t.shape.remove();
    G.getState().removeOrderShape(e);
  }
}

// Get all result shapes
function be() {
  return G.getState().resultShapes;
}

// Find a result shape by its ID
function Se(e) {
  return be().find(t => t.orderId === e);
}

// Determine color for order line based on status/direction
function ye(e, t, r) {
  const o = { PENDING: "rgb(255, 158, 31)", BUY: "rgb(30, 161, 85)", LONG: "rgb(30, 161, 85)", SELL: "rgb(233, 92, 78)", SHORT: "rgb(233, 92, 78)", HOLD: "rgb(128, 128, 128)" };
  if (e !== "FUTURES") {
    if (t === $.PENDING) return o.PENDING;
    if (t === $.HOLD) return o.HOLD;
  }
  return o[r];
}

// Color map for result shapes
const ve = { BUY: "white", SELL: "white", WON: "green", LOST: "red" };

// Process an opened future position (updates its visual representation)
const we = e => { Ee(e) };

// Process a closed trade/future (shows PnL callout and removes shape later)
const Ce = e => {
  if (e.fromCopy) return;
  const t = `Result P/L: \n\n ${Y(e.pnl)}`;
  const r = {
    id: e.id, idAux: "calloutId", shape: "callout", text: t,
    coordinates: [{ time: e.closeTime, price: e.closePrice }, { time: e.closeTime, price: e.closePrice }],
    overrides: {
      fontsize: 12, textColor: ve[e.result], size: 5,
      backgroundColor: { [$.LOST]: "rgb(233, 92, 78)", [$.DRAW]: "rgb(0, 165, 254)", [$.WON]: "rgb(30, 161, 85)", [$.PENDING]: "rgb(255, 158, 31)", [$.OPENED]: "rgb(255, 158, 31)", [$.HOLD]: "rgb(128, 128, 128) }[e.result],
      color: "white", bold: true, drawBorder: false
    }
  };
  Te(r); // Add the callout shape
  setTimeout(() => {
    (function (e) { // Remove the callout after 4 seconds
      if (!ue()) return;
      const t = Se(e);
      if (t) {
        window.tvWidget.activeChart().removeEntity(t.shapeId);
        G.getState().removeResultShape(e);
      }
    })(e.id)
  }, 4e3);
};

// Add a result shape (like a PnL callout) to the chart
const Te = e => {
  if (Se(e.id)) return; // Don't add duplicates
  const t = be().length; // Offset Y position slightly
  e.coordinates = e.coordinates.map(e => {
    if (!e.price) return e;
    const r = e.price * (t / 30) / 100; // Calculate offset
    const o = e.price - r;
    return { time: Math.floor(e.time / 1e3), price: o };
  });

  const r = window.tvWidget.activeChart().createMultipointShape(e.coordinates, {
    lock: true, zOrder: "top", disableSelection: true, disableSave: true, disableUndo: true, filled: true, ...e
  });

  window.tvWidget.activeChart().getShapeById(r).setUserEditEnabled(false); // Make non-editable
  const o = { orderId: e.id, shapeId: r };
  G.getState().addResultShape(o); // Track in store
  return r;
};

// Calculate countdown string for pending/open trades
const Pe = e => {
  let t = e.openTime, r = e.closeTime;
  if (e.result === $.PENDING) { t = e.requestTime; r = e.openTime; } // Countdown until open
  const a = D.getState().serverTime;
  const i = (r - t) / 1e3; // Total duration in seconds
  const n = (o.fromMillis(a).toMillis() - t) / 1e3; // Elapsed time in seconds
  const s = Math.round(i - n); // Remaining seconds
  const l = Math.floor(s / 60);
  const c = s - 60 * l;
  if (l < 0) return "00:00"; // Expired
  return `${l < 10 ? "0" + l : l}:${c < 10 ? "0" + c : c}`;
};

// Show temporary indicator (arrow + rectangle) when hovering buy/sell button
const _e = () => {
  const { lastSymbolPrice: e, isHoveringBuyButton: t, isHoveringSellButton: r } = L.getState();
  if (!ue()) return;

  if (pe.length) { pe.forEach(e => { window.tvWidget.activeChart().removeEntity(e) }); pe = []; } // Clear old indicators
  if (!t && !r) return; // Only show if hovering

  const a = window.tvWidget.activeChart();
  const i = o.fromMillis(Z());
  const n = Math.floor(i.startOf("minute").toMillis() / 1e3); // Start of current minute in seconds

  let s = 0, l = "", c = "";
  if (t) { // Hovering Buy
    s = e + e * 5e-4; // Slightly above current price
    l = "#08ae65"; c = "⬊";
  } else { // Hovering Sell
    s = e - e * 0; // Same price (or slightly below if needed)
    l = "#e95c4e"; c = "⬊";
  }

  const d = a.createShape({ time: n, price: s }, { shape: "text", text: `${c}`, lock: true, disableSelection: true, disableSave: true, overrides: { fontsize: 50, color: l } });

  const g = Math.floor(i.startOf("minute").minus({ hour: 3 }).toMillis() / 1e3);
  const p = Math.floor(i.startOf("minute").plus({ hour: 3 }).toMillis() / 1e3);
  const u = a.getSeries().priceScale().getVisiblePriceRange();
  let m = u.from, h = u.to, f = "";
  if (r) { // Sell
    h = e; f = "rgba(255, 0, 0, 0.2)";
  } else { // Buy
    m = e; f = "rgba(8, 174, 101, 0.2)";
  }
  const b = a.createMultipointShape([{ time: g, price: m }, { time: p, price: h }], { shape: "rectangle", lock: true, disableSelection: true, disableSave: true, overrides: { backgroundColor: f } });

  pe = [d, b]; // Store IDs
};

// Process a new trade/future creation message (adds order line to chart)
const Ee = e => {
  try {
    const t = he(e.id); // Check if already exists
    const { symbolSelected: r } = L.getState();
    if (!r || e.symbol !== r.ticker) return; // Ignore if not for current symbol
    if (t) fe(e.id); // Remove existing shape if found
    if (e.fromCopy) return; // Ignore copy signals

    const o = Oe(e); // Create the order line shape
    if (!o) return;

    G.getState().addOrderShape({ shape: o, orderId: e.id, order: e }); // Store shape reference
  } catch (t) { console.error("Error adding order shape:", t); }
};

// Show temporary vertical line and time labels when hovering buy/sell (pending state)
const ke = () => {
  if (!ue()) return;

  const e = window.tvWidget.activeChart();
  if (ge.length) { ge.forEach(e => { window.tvWidget.activeChart().removeEntity(e) }); ge = []; } // Clear old
  const { isHoveringBuyButton: t, isHoveringSellButton: r } = L.getState();
  if (!t && !r) return; // Only show if hovering

  const a = e.getSeries().priceScale().getVisiblePriceRange();
  const i = o.fromJSDate(oe()); // Get calculated expiration time
  const n = o.fromMillis(Z());
  const s = i.diff(n).toFormat("mm:ss"); // Format remaining time
  const l = Math.floor(i.startOf("minute").toMillis() / 1e3);

  const c = e.createShape({ time: l }, { shape: "vertical_line", lock: true, disableSelection: true, disableSave: true, fontsize: 12, overrides: { linecolor: "#FFFFFF", linestyle: 2, linewidth: .5, fontsize: 12, size: 5, backgroundColor: "rgba(20, 20, 24, 0.8)", color: "white" } });
  const d = a.to;
  const g = a.to - .05 * (a.to - a.from);
  const p = e.createShape({ time: l, price: g }, { shape: "horizontal_line", lock: true, disableSelection: true, disableSave: true, overrides: { linecolor: "white", linestyle: 0, linewidth: 1, showLabel: true, labelText: `${s}`, labelColor: "white", labelBackgroundColor: "rgba(20, 20, 24, 0.8)", labelFontSize: 15, labelPosition: "left", extendLeft: true, extendRight: false } });
  const u = e.createShape({ time: l, price: d }, { shape: "text", text: ce("purchaseTime", D.getState().language), lock: true, disableSelection: true, disableSave: true, overrides: { fontsize: 15, color: "white" } });

  ge = [c, p, u]; // Store IDs
};

// Show temporary vertical line and time labels when *not* hovering (countdown to expiration)
const De = () => {
  if (!ue()) return;

  if (de.length) { de.forEach(e => { window.tvWidget.activeChart().removeEntity(e) }); de = []; } // Clear old
  const { isHoveringBuyButton: e, isHoveringSellButton: t } = L.getState();
  if (e || t) return; // Don't show if hovering

  const r = window.tvWidget.activeChart();
  const a = r.getSeries()?.priceScale()?.getVisiblePriceRange();
  const i = a.to;
  const n = a.to - .05 * (a.to - a.from);

  const s = function () { // Get start of current candle period
    const e = ie(re());
    const t = Z();
    return o.fromJSDate(ae(t, e)).toJSDate();
  }();
  const l = o.fromJSDate(s);
  const c = oe(); // Get expiration time
  const d = o.fromJSDate(c);
  const g = Math.floor(l.startOf("minute").toMillis() / 1e3);
  const p = o.fromMillis(Z());

  let u = d.diff(p).toFormat("mm:ss"); // Format remaining time
  if (d.diff(p, "seconds").seconds < 0) u = "00:00"; // Expired

  const m = r.createShape({ time: g }, { shape: "vertical_line", text: "asdasdasdas", lock: true, disableSelection: true, disableSave: true, fontsize: 12, overrides: { linecolor: "#FFFFFF", linestyle: 2, linewidth: 1, fontsize: 12, size: 5, backgroundColor: "rgba(20, 20, 24, 0.8)", color: "white" } });
  const h = r.createShape({ time: g, price: n }, { shape: "text", text: `${u}`, lock: true, disableSelection: true, disableSave: true, overrides: { fontsize: 15, color: "white" } });
  const f = r.createShape({ time: g, price: i }, { shape: "text", text: ce("candleTime", D.getState().language), lock: true, disableSelection: true, disableSave: true, overrides: { fontsize: 15, color: "white" } });

  de = [m, h, f]; // Store IDs
};

// Create an order line shape for a given order object
const Oe = e => {
  try {
    if (!ue()) return;
    let t = "", r = "";

    if (e.orderType === "FUTURES") {
      t = Y(0); // Initial PnL is 0
      r = `${e.direction.toUpperCase()} ${Y(e.amount)}`;
    } else {
      const o = Pe(e); // Get countdown
      r = `${e.direction.toUpperCase()} ${Y(e.amount)}`;
      t = o; // Display countdown in quantity
    }

    return window.tvWidget.activeChart().createOrderLine()
      .setText(r)
      .setLineLength(6)
      .setLineStyle(3)
      .setQuantity(t)
      .setLineColor(ye(e.orderType, e.result, e.direction)) // Color based on status/dir
      .setQuantityBorderColor(ye(e.orderType, e.result, e.direction))
      .setQuantityBackgroundColor(ye(e.orderType, e.direction))
      .setBodyBorderColor(ye(e.orderType, e.result, e.direction))
      .setBodyTextActiveBuyColor(ye(e.orderType, e.result, e.direction))
      .setBodyBackgroundColor("rgb(20, 20, 24)")
      .setPrice(e.openPrice); // Set the execution price
  } catch (t) { console.error("Error creating order shape:", t); }
};

// --- Message Listener ---
// Handles messages sent from the parent window (likely containing trade data, settings, etc.)
window.addEventListener("message", e => {
  switch (e.data.type) {
    case "apply-style":
      W(e.data.data.resolution);
      break;
    case "iframe.trade.pending":
      Ee(e.data.data);
      break;
    case "iframe.trade.opened":
    case "iframe.future.position.opened":
      we(e.data.data);
      break;
    case "iframe.trade.error":
      fe(e.data.data.id);
      break;
    case "iframe.trade.closed":
      Ce(e.data.data);
      break;
    case "iframe.future.position.closed":
      fe(e.data.data.id); // Treat closed futures same as trades
      break;
    case "iframe.server-time":
      D.getState().setServerTime(e.data.data);
      break;
    case "iframe.close-type":
      te(e.data.data.closeType);
      break;
  }
}, !1);

// --- Device Detection Store (Zustand) ---
const Ie = t()(
  e => ({
    isMobile: !0,
    isDesktop: !0,
    isLandscape: !1,
    platform: "mobile",
    updatePlatforms: () => {
      e({
        platform: window.innerWidth <= 991 ? "mobile" : "web",
        isLandscape: !1,
        isMobile: window.innerWidth <= 991,
        isDesktop: window.innerWidth > 991
      })
    }
  })
);

// --- Main Chart Component (React) ---
const Le = "_tenantChartLogo_1hh2i_30"; // CSS class name
const Me = () => {
  document.title = "TradingView Iframe";

  // Zustand store accessors
  const { setBgSelected: e, setUpColor: t, setDownColor: r, setBackgroundColorGraphic: o, setColorIconGraphic: a, setColorActiveHover: i, setLanguage: u } = D();
  const m = L(e => e.symbolSelected);
  const h = L(e => e.symbolSlot);
  const f = Ie(e => e.isMobile);
  const b = Ie(e => e.isLandscape);
  const S = D(e => e.secondIntervalTimer);

  const [y, v] = n.useState(!0); // State to show/hide logo
  const { setLoadingTrade: w, loadingCandles: C } = I(); // Access loading states
  const { setOtcApiUrl: T, setOtcWsUrl: P, setOtcApiKey: _ } = D(); // Access API setters

  const [E] = s(); // Access URLSearchParams hook

  const k = async () => { // Initialize from URL parameters
    const n = ["symbolApiUrl", "symbolApiKey", "symbolWsUrl", "ticker", "slot"].filter(e => !E.has(e));
    if (n.length) return void alert(`Missing required params: ${n.join(", ")}`);

    const s = E.get("symbolApiUrl");
    const l = E.get("symbolApiKey");
    const c = E.get("symbolWsUrl");
    const d = E.get("ticker");
    const g = E.get("slot");
    const p = E.get("closeType");
    const m = E.get("expirationType");
    const h = E.get("hiddenChartLogo");
    const f = E.get("alterBg");
    const b = E.get("urlBg");
    const S = E.get("upColor");
    const y = E.get("downColor");
    const w = E.get("backgroundColorGraphic");
    const C = E.get("colorIconGraphic");
    const k = E.get("colorActiveHover");
    const D = E.get("language");

    // Apply settings from URL
    if (s) T(s);
    if (l) _(l);
    if (c) P(c);
    if (f === "true") e("alter_chart_bg.png");
    if (b) e(b);
    if (S) t(S);
    if (y) r(y);
    if (w) o(w);
    if (C) a(C);
    if (k) i(k);
    if (d) await N(g, d); // Fetch and set symbol
    if (g) L.getState().setSymbolSlot(g);
    if (p) te(p); // Set close type
    if (m) ee = m; // Set expiration type
    if (h) v(h === "true"); // Hide logo
    if (D) u(D); // Set language
  };

  n.useEffect(() => { k(); }, []); // Run init once on mount

  n.useEffect(() => { // Update shapes periodically based on timer
    me();
    (() => { try { _e(); De(); ke(); } catch (e) { } })();
  }, [S]);

  n.useEffect(() => { // Load chart when symbol/slot are set
    if (h && m) {
      (async () => {
        if (!m) return;
        w(true); // Set loading state
        if (!m.ticker) return;

        let e = "1"; // Default resolution
        if (m.type === "forex") e = "1";
        if (m.type === "crypto") e = "1";
        // Could handle other types here

        const t = E.get("language"); // Get locale from URL
        H(e, f, b, t || undefined); // Initialize TradingView widget
      })();
    }
  }, [h, m]); // Re-run if symbol/slot changes

  // Render the chart container, spinner, and optional logo
  return l.jsx("div", {
    children: l.jsx(c, {
      children: l.jsxs(d, {
        id: "content", className: "content-web content-mobile",
        children: [
          l.jsx(g, { spinning: C, indicator: l.jsx(p, { style: { fontSize: 60, color: "#FFFFFF75" }, spin: !0 }), fullscreen: !0 }),
          l.jsx("span", { children: l.jsx("span", { id: "chartContainer" }) }),
          y && l.jsx("div", {
            children: f ? null : l.jsx("a", {
              href: "https://www.mybroker.dev  ",
              target: "_blank",
              rel: "noreferrer",
              children: l.jsx("img", { alt: "logo", src: "/logos/mybroker-only-logo-black.png", className: Le })
            })
          })
        ]
      })
    })
  });
};

// --- Root App Component (React) ---
const Ne = () => {
  const { t: e } = u(); // Get translation function
  window.t = e; // Attach to global window for potential external use

  const t = Ie().updatePlatforms; // Function to update device detection
  const { setSecondIntervalTimer: r } = D(); // Function to update timer

  const o = () => { t() }; // Callback to update platforms

  // Set up a 1-second interval timer that updates the Zustand store
  n.useEffect(() => {
    const e = setInterval(() => { r(Date.now()) }, 1e3);
    return () => { clearInterval(e) }; // Cleanup interval on unmount
  }, []);

  // Set up resize listener to update device detection
  n.useMemo(() => (
    o(),
    window.addEventListener("resize", o),
    () => { window.removeEventListener("resize", o) }
  ), []);

  return l.jsx(l.Fragment, {
    children: l.jsx("div", {
      style: { display: "block" },
      children: l.jsx(m, {}) // Renders the router component
    })
  });
};

// --- Routing Configuration (React Router) ---
const Fe = w([ // Assuming 'w' is 'createBrowserRouter' from react-router-dom
  {
    path: "", element: l.jsx(Ne, {}),
    ErrorBoundary: () => {
      const e = h(); // Get error from route context
      const { t: t } = u();
      return l.jsx(f, { // Render modal error
        open: !0, footer: !1, closable: !1, centered: !0,
        children: l.jsx(b, {
          status: "500",
          title: e.status === 503 ? t("pages.error.under-maintenance") : t("pages.error.error"),
          subTitle: l.jsx(S, { style: { marginTop: 8 }, children: /* Error message based on status */ })
        })
      })
    },
    children: [
      { path: "", element: l.jsx(Me, {}) } // Main chart component
    ]
  }
]);

// --- Top-Level App Component (React) ---
const Be = () => {
  const e = { en: P }; // Locale object (assuming P holds English translations)

  // Apply background color from settings to root HTML element
  n.useEffect(() => {
    const { backgroundColorGraphic: e } = D.getState();
    document.documentElement.style.setProperty("--app-background-color", e || "#141418");
    document.documentElement.style.setProperty("--color-bg", e || "#141418");
  }, []);

  // Wrap everything in Ant Design's ConfigProvider for theming
  return l.jsx(C, {
    locale: e.en,
    theme: { /* ... theme configuration ... */ },
    children: l.jsx(_, { router: Fe }) // Pass the configured router
  });
};

// --- Application Entry Point ---
// Attach notification utility globally and render the root component
window.notification = i;
E.createRoot(document.getElementById("root")).render(l.jsx(Be, {}));
