export interface HttpConfig {
  baseUrl: string
  username?: string
  password?: string
  timeout?: number
}

export interface TasmotaCommandResult {
  success: boolean
  data: Record<string, unknown>
  rawResponse: string
  timestamp: number
}
