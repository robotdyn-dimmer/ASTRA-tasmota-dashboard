# ASTRA — Admin System for Tasmota Remote Access

> Browser-based admin panel for Tasmota ESP32 devices

![Status](https://img.shields.io/badge/status-v0.1.0--dev-orange) ![ESP32](https://img.shields.io/badge/platform-ESP32-blue) ![License](https://img.shields.io/badge/license-MIT-green)

**Website:** [www.rocketcontroller.com](https://www.rocketcontroller.com)

![Dashboard](docs/screenshots/dashboard.png)

## Features

- Dashboard with customizable drag-and-drop widgets
- Device management with online/offline monitoring
- Relay / PWM / LED / Sensor / Energy monitoring and control
- Visual Rule Builder with templates
- Timer management (16 slots per device)
- GPIO entity mapping
- Config sync to device (Berry-based storage on ESP32)
- Dark mode
- PWA support (installable, works offline)

## Quick Start

### Prerequisites

- **Node.js 18+**
- **ESP32** with **Tasmota 14+** on the same network
- CORS enabled on device (`SetOption120 1`) — see [CORS setup](docs/CORS-setup.md)

> **ESP32 only.** ESP8266 is not supported — Berry scripting (used for SSE push and config storage) is not available on ESP8266.

### Install and Run

```bash
git clone https://github.com/robotdyn-dimmer/ASTRA-tasmota-dashboard.git
cd ASTRA-tasmota-dashboard
npm install
npm run dev
```

Open `http://localhost:5173` in your browser. The onboarding page will prompt you to enter your first device IP.

### Production Build

```bash
npm run build
npm run preview
```

## Documentation

Full documentation is in the [`docs/`](docs/) folder:

- [User Guide](docs/user-guide.md) — complete walkthrough of all features
- [CORS Setup](docs/CORS-setup.md) — browser security configuration
- [Berry Setup](docs/berry-setup.md) — SSE push and config storage scripts for ESP32

## Tech Stack

React 19 + TypeScript + Vite + Tailwind CSS v4 + shadcn/ui + Zustand + Recharts + react-grid-layout

Communication: HTTP (primary) + MQTT (optional) + SSE (real-time push via Berry)

## License

MIT (TBD)

---

Built by the **RocketController** team
