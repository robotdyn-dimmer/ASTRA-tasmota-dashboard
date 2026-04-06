export const MQTT_TOPIC_PREFIXES = {
  COMMAND: 'cmnd',
  STATUS: 'stat',
  TELEMETRY: 'tele',
} as const

export const MQTT_SUFFIXES = {
  LWT: 'LWT',
  RESULT: 'RESULT',
  STATE: 'STATE',
  SENSOR: 'SENSOR',
  STATUS: 'STATUS',
  STATUS0: 'STATUS0',
  INFO1: 'INFO1',
  INFO2: 'INFO2',
  INFO3: 'INFO3',
} as const

export const MQTT_DEFAULTS = {
  KEEPALIVE: 60,
  RECONNECT_PERIOD: 5000,
  CONNECT_TIMEOUT: 30000,
  MESSAGE_BUFFER_INTERVAL: 1000,
  QOS: 0 as const,
}

export const TASMOTA_DEFAULTS = {
  TELEMETRY_PERIOD: 300,
  HTTP_TIMEOUT: 5000,
  HTTP_USERNAME: 'admin',
  POLL_INTERVAL: 2345,
}

export const APP_DEFAULTS = {
  SIDEBAR_WIDTH: 260,
  HEADER_HEIGHT: 56,
  GRID_COLS: { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 },
  GRID_BREAKPOINTS: { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 },
  GRID_ROW_HEIGHT: 80,
}
