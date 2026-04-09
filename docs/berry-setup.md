# Berry Scripts Setup

Berry scripts run on the ESP32 to provide real-time SSE push and config storage for ASTRA. These are optional but recommended for the best experience.

> **ESP32 only.** ESP8266 does not support Berry scripting.

## What the Scripts Do

| Script | Purpose | Endpoint(s) |
|--------|---------|-------------|
| `astra_sse.be` | Real-time push via Server-Sent Events (port 81) | `/astra/sse` |
| `astra_config.be` | Stores/retrieves all ASTRA config JSON on device flash | `/astra_cfg`, `/astra_app`, `/astra_dash` |
| `autoexec.be` | Loads all scripts on device boot | — |

> **Important:** Berry's `webserver.on()` overwrites all prior handlers when called from different scripts, so all HTTP endpoints must be registered in a single script. That is why `astra_config.be` registers all three endpoints.

### SSE Push Details

The SSE script uses Berry's `tcpserver` on port 81 to stream device state changes (relay toggles, sensor updates) to the browser in real time, without polling. It checks for power state changes every 100ms.

### Config Storage Details

`astra_config.be` exposes three HTTP endpoints that accept GET (read) and POST (write) requests. Data is stored as JSON files on the ESP32 filesystem:

- `/astra_cfg` — per-device config (relay labels, notes)
- `/astra_app` — full app config (devices, dashboards, settings)
- `/astra_dash` — dashboard subset

## Files to Upload

You need three Berry script files on the device filesystem. They are included in the [GitHub Release](https://github.com/robotdyn-dimmer/ASTRA-tasmota-dashboard/releases) and also available in the [`public/berry/`](https://github.com/robotdyn-dimmer/ASTRA-tasmota-dashboard/tree/main/public/berry) folder of the repository.

```
astra_sse.be
astra_config.be
autoexec.be
```

### autoexec.be

The `autoexec.be` file must load both scripts. If you already have an `autoexec.be`, add these lines to it:

```berry
load('astra_sse.be')
load('astra_config.be')
```

## How to Upload

### Option A: Tasmota Web UI File Manager

1. Open `http://<device-ip>` in your browser
2. Go to **Consoles > Manage File System**
3. Upload each `.be` file using the file upload form
4. Restart the device or run `BrRestart` in the console

### Option B: Tasmota Console

You can paste Berry code directly in the console, but this is only practical for small files. For larger scripts, use the file manager (Option A).

To verify scripts loaded:

```
BrRestart
```

Wait 3 seconds, then check the console output for any errors.

## Verifying the Endpoints

After uploading and restarting, test each endpoint:

### SSE endpoint (port 81)

```bash
curl -N http://<device-ip>:81/astra/sse
```

You should see SSE data frames like:

```
data: {"Power1":"ON","Uptime":"0T01:23:45"}
```

Press `Ctrl+C` to stop.

### Config endpoint (`/astra_cfg`)

```bash
# Read per-device config (returns {} if empty)
curl http://<device-ip>/astra_cfg

# Write per-device config
curl -X POST http://<device-ip>/astra_cfg \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

### App endpoint (`/astra_app`)

```bash
# Read app state
curl http://<device-ip>/astra_app

# Write app state
curl -X POST http://<device-ip>/astra_app \
  -H "Content-Type: application/json" \
  -d '{"devices": []}'
```

### Dashboard endpoint (`/astra_dash`)

```bash
# Read dashboard config
curl http://<device-ip>/astra_dash
```

All three endpoints should return HTTP 200 with JSON content.

## Troubleshooting

### Endpoints return 404

- Scripts are not loaded. Check that `autoexec.be` exists and contains the `load()` calls for both scripts.
- Run `BrRestart` in the Tasmota console and wait 3 seconds.

### SSE connection fails or times out

- The SSE server runs on **port 81**, not the standard Tasmota port 80.
- Check that port 81 is not blocked by your firewall.
- Only one SSE client can connect per device at a time (Berry `tcpserver` limitation).

### "Out of memory" errors in console

- Berry scripts use device RAM. On devices with limited free memory, the SSE script may fail to start.
- Check free memory with `print(tasmota.getfreeheap())` in the Berry console.
- Minimum recommended: 30KB free heap after boot.

### Scripts not loading on boot

- Ensure `autoexec.be` is in the root of the device filesystem (not in a subdirectory).
- Check the Tasmota console output during boot for Berry compilation errors.
