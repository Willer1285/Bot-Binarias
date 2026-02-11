# Protocolo WebSocket de Worbit - Documentación Técnica

## Resumen

Worbit utiliza **Socket.IO v4** (Engine.IO v4) sobre WebSocket para comunicación en tiempo real.
Hay dos conexiones WebSocket principales:

1. **Price Socket** - Datos de precios en tiempo real
2. **Broker Socket** - Datos de usuario, trades, balance

---

## 1. Price Socket (symbol-prices-api)

### URL
```
wss://symbol-prices-api.mybroker.dev/socket.io/?EIO=4&transport=websocket
```

### Namespace
`/symbol-prices`

### Protocolo de Conexión

```
[Servidor] → 0{"sid":"xxx","upgrades":[],"pingInterval":25000,"pingTimeout":20000,"maxPayload":1000000}
[Cliente]  → 40/symbol-prices,
[Servidor] → 40/symbol-prices,{"sid":"yyy"}
```

### Suscripción a Canal de Precios

La página suscribe al canal automáticamente:
```
[Cliente] → 42/symbol-prices,["last-symbol-price","mybroker-11:ETHUSDT.OTC"]
```

### Mensajes de Precio (symbol.price.update)

```
42/symbol-prices,["message", {"channel": "mybroker-11:ETHUSDT.OTC", "event": "symbol.price.update", "data": {...}}]
```

Estructura del objeto `data`:
```json
{
  "openPrice": 3281.62,
  "closePrice": 3281.64,
  "highPrice": 3281.64,
  "lowPrice": 3281.62,
  "pair": "ETHUSDT.OTC",
  "slot": "mybroker-11",
  "time": 1764550555061,
  "type": "otc",
  "volume": 34.91
}
```

### Ping/Pong (Keep-alive)
```
[Servidor] → 2       (ping cada ~25s)
[Cliente]  → 3       (pong, debe responder antes de pingTimeout)
```
Nota: El cliente Socket.IO de la página maneja esto automáticamente.

---

## 2. Broker Socket (broker-api)

### URL
```
wss://broker-api.mybroker.dev/socket.io/?token=JWT_TOKEN&EIO=4&transport=websocket
```

### Namespace
`/user`

### Protocolo de Conexión
```
[Servidor] → 0{"sid":"xxx","upgrades":[],"pingInterval":25000,"pingTimeout":20000,"maxPayload":1000000}
[Cliente]  → 40/user,
[Servidor] → 40/user,{"sid":"yyy"}
```

### Suscripciones en /user

La página suscribe a múltiples eventos:
```
42/user,["subscribe","trade.opened"]
42/user,["subscribe","trade.closed"]
42/user,["subscribe","trade.pending"]
42/user,["subscribe","user.balance.updated"]
42/user,["subscribe","digit.position.opened"]
42/user,["subscribe","digit.position.closed"]
42/user,["subscribe","profit.zone.opened"]
42/user,["subscribe","profit.zone.closed"]
42/user,["subscribe","mybroker-11:BTCUSDT.OTC"]  ← canal del activo actual
```

### TimeSync (Bidireccional)
```
[Servidor] → 42/user,["timeSync", 1770734899414]      (timestamp del servidor)
[Cliente]  → 42/user,["timeSync","time"]                (respuesta del cliente)
```

### Heartbeat (Nivel de Aplicación)
Separado del ping/pong de Socket.IO:
```
[Servidor] → 42/user,["heartbeat","ping"]
[Cliente]  → (respuesta esperada)
[Servidor] → 42/user,["message","heartbeat"]
```

### Cambio de Activo
Cuando el usuario cambia de activo:
```
42/user,["unsubscribe","mybroker-11:BTCUSDT.OTC"]   ← desuscribir anterior
42/user,["subscribe","mybroker-11:ETHUSDT.OTC"]      ← suscribir nuevo
```

### Ping/Pong (Keep-alive)
Igual que Price Socket:
```
[Servidor] → 2
[Cliente]  → 3
```

---

## 3. Códigos de Protocolo Socket.IO v4

| Código | Tipo | Descripción |
|--------|------|-------------|
| `0`    | OPEN | Handshake del servidor con configuración |
| `1`    | CLOSE | Cierre de conexión |
| `2`    | PING | Ping (servidor → cliente) |
| `3`    | PONG | Pong (cliente → servidor) |
| `4`    | MESSAGE | Mensaje genérico |
| `40`   | CONNECT | Conexión a namespace |
| `41`   | DISCONNECT | Desconexión de namespace |
| `42`   | EVENT | Evento con datos |

### Formato de namespace:
```
40/namespace,{datos_opcionales}
42/namespace,["evento", datos]
```

---

## 4. Configuración del Servidor

De los handshakes observados (varían por endpoint):

### symbol-prices-api:
- **pingInterval**: 25000ms (25 segundos)
- **pingTimeout**: 60000ms (60 segundos)
- **maxPayload**: 1000000 bytes
- **upgrades**: [] (sin upgrades, ya es WebSocket)

### broker-api:
- **pingInterval**: 25000ms (25 segundos)
- **pingTimeout**: 20000ms (20 segundos)
- **maxPayload**: 1000000 bytes
- **upgrades**: [] (sin upgrades, ya es WebSocket)

---

## 5. Notas para el Bot

### REGLA CRÍTICA: Interceptor Pasivo

El bot intercepta los WebSockets de la página para leer datos de precio.
**El interceptor DEBE ser pasivo** - solo observar, NUNCA enviar mensajes de protocolo.

**Motivo**: La página ya tiene su propio cliente Socket.IO que maneja:
- Handshake y conexión a namespaces
- Ping/Pong keep-alive
- Suscripciones a canales
- Reconexión automática

Si el bot envía mensajes de protocolo duplicados (como namespace connects o pongs),
el servidor recibe tráfico duplicado y cierra la conexión con **código 1005**.

### Flujo correcto del bot:
1. Interceptar `window.WebSocket` para capturar conexiones
2. Agregar event listeners pasivos en `message` para leer datos
3. Parsear mensajes `42/symbol-prices,[...]` para extraer precios
4. NUNCA enviar: `40/`, `2`, `3`, `42/` por el socket interceptado
5. Si la conexión se pierde, esperar reconexión automática de Socket.IO
6. Solo intervenir (simular clicks) si no hay reconexión tras ~30 segundos

---

## 6. URLs y Dominios

| Servicio | Dominio |
|----------|---------|
| Precios | `symbol-prices-api.mybroker.dev` |
| Broker API | `broker-api.mybroker.dev` |
| Plataforma | `broker.worbit.io` |

---

*Documento generado para referencia futura del desarrollo del bot Worbit Sniper.*
## 7. Conexiones Totales Observadas

La página crea estas conexiones WebSocket:
1. `symbol-prices-api` x1 - Precios en tiempo real (sin autenticación)
2. `broker-api` x2 - Datos de usuario/trades (con JWT token)

Total: **3 conexiones WebSocket** activas simultáneamente.

Nota: Se observaron hasta 7 entradas en DevTools Network, pero incluyen conexiones
anteriores cerradas y reconexiones normales de Socket.IO.

---

*Última actualización: 2026-02-11*
