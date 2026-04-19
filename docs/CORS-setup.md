# CORS Setup for ASTRA App

## Why CORS is needed

ASTRA runs in a browser and sends HTTP requests directly to Tasmota devices on your local network. Two independent browser checks must pass:

1. **CORS** (`Access-Control-Allow-Origin`) — managed by Tasmota's `Cors` command.
2. **Private Network Access (PNA)** — separate Chromium-only check that requires the device to respond with `Access-Control-Allow-Private-Network: true`. **Standard Tasmota does NOT send this header under any setting** — it requires either a firmware patch or running the app in a context that's exempt (Firefox/Safari, localhost dev, or local proxy).

Without these, you will see errors like:

- `CORS blocked — enable Cors on device`
- `Access to fetch has been blocked by CORS policy`
- `The request client is not a secure context and the resource is in more-private address space`
- Device shows "Offline" even though it responds to ping

## Browser compatibility (the short answer)

Whether you need patched firmware depends on which browser you use to open ASTRA:

| Browser | Engine | PNA enforced | With public HTTPS → local IP |
|---------|--------|--------------|------------------------------|
| Chrome desktop/mobile | Blink | Yes (since v98) | ❌ requires patched firmware |
| Edge desktop/mobile | Blink | Yes | ❌ requires patched firmware |
| Opera / Brave / Samsung Internet | Blink | Yes | ❌ requires patched firmware |
| **Firefox** desktop/mobile | Gecko | No (behind flag) | ✅ works with `Cors` command |
| **Safari** desktop/iOS | WebKit | No | ✅ works with `Cors` command |

If you use Firefox or Safari, you can skip the firmware patch entirely — just enable CORS as described below.

## Quick Setup (standard Tasmota — Firefox/Safari)

Run this command in the **Tasmota console** on each device:

```
Cors *
```

Or, for slightly better security, restrict CORS to a specific origin:

```
Cors https://astra-app.rocketcontroller.com
```

> **Security note:** `Cors *` allows any website on the internet to send requests to your device if it can reach it on the local network. If you only use ASTRA from one origin (the hosted app or your local dev server), set that specific origin instead of `*`.

## ASTRA Custom Firmware (required for Chrome/Edge/Brave/Opera)

The ASTRA-patched Tasmota firmware adds the missing `Access-Control-Allow-Private-Network` header so Chromium-based browsers can reach the device from a public HTTPS page.

> **Precompiled binary available.** A ready-to-flash `.bin` for ESP32 is in [GitHub Releases](https://github.com/robotdyn-dimmer/ASTRA-tasmota-dashboard/releases). Download `tasmota32-cors-patched.bin` and flash via Tasmota OTA update or `esptool.py` — no compilation needed.

### What the patch adds

| Header | Standard Tasmota | ASTRA Patch |
|--------|------------------|-------------|
| `Access-Control-Allow-Origin` | `Cors *` | `Cors *` |
| `Access-Control-Allow-Private-Network: true` | missing | included |
| `Access-Control-Allow-Headers: content-type` | missing | included |

### How to build it yourself

The patch is two small additions in `tasmota/tasmota_xdrv_driver/xdrv_01_9_webserver.ino`:

1. In `HttpHeaderCors()` — after the existing `Access-Control-Allow-Origin` header, add `Access-Control-Allow-Private-Network: true` when CORS is enabled.
2. In `HandlePreflightRequest()` — append `content-type` to the `Access-Control-Allow-Headers` list (standard Tasmota only allows `authorization`, but ASTRA sends `Content-Type: application/json` for POST requests to Berry endpoints).

Then compile as usual with the standard build options. `Cors` is part of standard Tasmota — no extra `#define` needed.

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

## Alternatives if you can't patch the firmware

### 1. Use Firefox or Safari

Simplest workaround — open [astra-app.rocketcontroller.com](https://astra-app.rocketcontroller.com) in Firefox or Safari. PNA is not enforced, so standard Tasmota with `Cors *` works.

### 2. Run ASTRA locally

Clone the repo and run `npm run dev` — the Vite dev server includes a built-in proxy that bypasses CORS/PNA entirely. Devices don't need any CORS configuration in this mode.

```bash
git clone https://github.com/robotdyn-dimmer/ASTRA-tasmota-dashboard.git
cd ASTRA-tasmota-dashboard
npm install
npm run dev
```

The proxy handles:

- HTTP requests (port 80) via `/device-proxy/<ip>/<path>`
- SSE connections (port 81) via `/device-sse/<ip>`

### 3. Desktop wrapper (planned)

A Tauri-based desktop build of ASTRA is planned. It runs the app in a webview without CORS/PNA restrictions, and will also work around Mixed Content blocking for `ws://` MQTT brokers. Track progress in the [GitHub issues](https://github.com/robotdyn-dimmer/ASTRA-tasmota-dashboard/issues).

## Troubleshooting

### Device shows "Offline" in ASTRA

1. Check that the device IP is correct — open `http://<device-ip>` in a browser tab.
2. Run `Cors *` in the Tasmota console (or `Cors https://your-origin`).
3. If using Chrome/Edge — you need the ASTRA custom firmware (or open the app in Firefox/Safari instead).

### CORS works for GET but POST fails

Standard Tasmota only allows `authorization` in preflight headers. ASTRA sends `Content-Type: application/json` for POST requests to Berry endpoints. The ASTRA patch adds `content-type` to the allowed headers list.

### Berry endpoints (/astra_cfg, /astra_app, /astra_dash) return 404

Berry scripts need to load after WiFi connects. Try:

1. Open Tasmota console and run `BrRestart`.
2. Wait 3 seconds, then retry.
3. Check that `autoexec.be` exists on the device filesystem with:

   ```
   load('astra_sse.be')
   load('astra_config.be')
   ```

### Multiple browsers / devices accessing same dashboard

Set a **Config Sync Device** in ASTRA Settings. This stores dashboard config on the Tasmota device itself, so any browser pointing to the same device loads the same layout. Requires the `astra_config.be` Berry script on the device (which registers the `/astra_app` endpoint).

For ESP8266 fleets (no Berry), MQTT-based config sync is on the roadmap — see [issue #1](https://github.com/robotdyn-dimmer/ASTRA-tasmota-dashboard/issues/1).
