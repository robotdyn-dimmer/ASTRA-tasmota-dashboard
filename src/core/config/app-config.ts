export interface AppConfig {
  mqtt: {
    brokerUrl: string
    username: string
    password: string
  }
}

export function getAppConfig(): AppConfig {
  return {
    mqtt: {
      brokerUrl: import.meta.env.VITE_MQTT_BROKER_URL || 'ws://localhost:9001',
      username: import.meta.env.VITE_MQTT_USERNAME || '',
      password: import.meta.env.VITE_MQTT_PASSWORD || '',
    },
  }
}
