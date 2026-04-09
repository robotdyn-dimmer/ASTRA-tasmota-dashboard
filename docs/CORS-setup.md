# CORS Setup for ASTRA App

## Why CORS is needed

ASTRA runs in a browser and sends HTTP requests directly to Tasmota devices on your local network. Modern browsers (Chrome 98+, Edge, Firefox) block these requests by default due to **Private Network Access** security policy.

Without CORS headers, you will see errors like:
- `CORS blocked — enable SetOption120 1 on device`
- `Access to fetch has been blocked by CORS policy`
- Device shows "Offline" even though it responds to ping

## Quick Setup (standard Tasmota firmware)

Run this command in the **Tasmota console** on each device:

```
SetOption120 1
```

This enables the `Access-Control-Allow-Origin: *` header.

> **Note:** Standard Tasmota firmware does NOT include the `Access-Control-Allow-Private-Network` header required by Chrome 98+. If you experience issues, use the ASTRA custom firmware below.

## ASTRA Custom Firmware (recommended)

The ASTRA-patched Tasmota firmware adds full CORS support including Private Network Access. Two lines were changed in `xdrv_01_9_webserver.ino`.

> **Precompiled binary available.** A ready-to-flash `.bin` for ESP32 is available in [GitHub Releases](https://github.com/robotdyn-dimmer/ASTRA-tasmota-dashboard/releases). Download `tasmota32-cors-patched.bin` and flash via Tasmota OTA update or `esptool.py` — no compilation needed.

### What the patch adds

| Header | Standard Tasmota | ASTRA Patch |
|--------|-----------------|-------------|
| `Access-Control-Allow-Origin: *` | SetOption120 1 | SetOption120 1 |
| `Access-Control-Allow-Private-Network: true` | missing | included |
| `Access-Control-Allow-Headers: content-type` | missing | included |

### How to build

1. Open the Tasmota source code
2. In `tasmota/my_user_config.h`, uncomment and set:
   ```cpp
   #define USE_CORS
     #define CORS_DOMAIN  "*"
   ```
3. Compile and flash as usual

### How to verify

After flashing, run from any terminal:

```bash
curl -s -D - -X OPTIONS "http://<device-ip>/cm" \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Private-Network: true" \
  -o /dev/null
```

You should see in the response headers:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Private-Network: true
```

## Vite Dev Proxy (development only)

During development, ASTRA automatically bypasses CORS using a built-in Vite proxy. All device requests are routed through the Vite dev server (`/device-proxy/<device-ip>/...`), which forwards them from Node.js where browser security restrictions do not apply.

This means **no CORS configuration is needed on the device during development** — just run `npm run dev` and it works.

The proxy handles:

- HTTP requests (port 80) via `/device-proxy/<ip>/<path>`
- SSE connections (port 81) via `/device-sse/<ip>`

> **Production note:** The Vite proxy is only available in dev mode (`npm run dev`). For production builds, devices must have proper CORS headers — use the ASTRA custom firmware or `SetOption120 1`.

## Troubleshooting

### Device shows "Offline" in ASTRA

1. Check that the device IP is correct — open `http://<device-ip>` in a browser tab
2. Run `SetOption120 1` in the Tasmota console
3. If using Chrome — you need the ASTRA custom firmware for full CORS support

### CORS works for GET but POST fails

Standard Tasmota only allows `authorization` in preflight headers. ASTRA sends `Content-Type: application/json` for POST requests. The ASTRA patch adds `content-type` to the allowed headers list.

### Berry endpoints (/astra_cfg, /astra_app, /astra_dash) return 404

Berry scripts need to load after WiFi connects. Try:
1. Open Tasmota console and run `BrRestart`
2. Wait 3 seconds, then retry
3. Check that `autoexec.be` exists on the device filesystem with:
   ```
   load('astra_sse.be')
   load('astra_config.be')
   ```

### Multiple browsers / devices accessing same dashboard

Set a **Config Sync Device** in ASTRA Settings. This stores dashboard config on the Tasmota device itself, so any browser pointing to the same device loads the same layout. Requires the `astra_config.be` Berry script on the device (which registers the `/astra_app` endpoint).
