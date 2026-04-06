export const TasmotaCommands = {
  power: (relay?: number) => relay ? `POWER${relay}` : 'POWER',
  powerOn: (relay?: number) => `${TasmotaCommands.power(relay)} ON`,
  powerOff: (relay?: number) => `${TasmotaCommands.power(relay)} OFF`,
  powerToggle: (relay?: number) => `${TasmotaCommands.power(relay)} TOGGLE`,

  status: (sub?: number) => sub !== undefined ? `STATUS ${sub}` : 'STATUS',
  status0: () => 'STATUS 0',
  statusNetwork: () => 'STATUS 5',
  statusSensor: () => 'STATUS 8',
  statusEnergy: () => 'STATUS 9',

  dimmer: (value: number) => `DIMMER ${Math.max(0, Math.min(100, value))}`,
  colorTemp: (value: number) => `CT ${Math.max(153, Math.min(500, value))}`,
  color: (hex: string) => `COLOR ${hex}`,

  backlog: (commands: string[]) => `BACKLOG ${commands.join('; ')}`,

  restart: () => 'RESTART 1',
  reset: () => 'RESET 1',

  teleperiod: (seconds: number) => `TELEPERIOD ${seconds}`,
  timezone: (tz: string) => `TIMEZONE ${tz}`,
  friendlyName: (name: string, index?: number) =>
    index ? `FRIENDLYNAME${index} ${name}` : `FRIENDLYNAME ${name}`,
} as const
