import type { HttpConfig, TasmotaCommandResult } from './types'
import { TASMOTA_DEFAULTS } from '@/core/config/constants'

export class TasmotaHttpClient {
  private config: HttpConfig

  constructor(config: HttpConfig) {
    this.config = {
      ...config,
      username: config.username ?? TASMOTA_DEFAULTS.HTTP_USERNAME,
      timeout: config.timeout ?? TASMOTA_DEFAULTS.HTTP_TIMEOUT,
    }
  }

  async sendCommand(command: string): Promise<TasmotaCommandResult> {
    const url = `${this.config.baseUrl}/cm?cmnd=${encodeURIComponent(command)}`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

    try {
      const headers: Record<string, string> = {}
      if (this.config.username && this.config.password) {
        headers['Authorization'] = `Basic ${btoa(`${this.config.username}:${this.config.password}`)}`
      }

      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      })

      const rawResponse = await response.text()
      let data: Record<string, unknown>

      try {
        data = JSON.parse(rawResponse)
      } catch {
        data = { _raw: rawResponse }
      }

      return {
        success: response.ok,
        data,
        rawResponse,
        timestamp: Date.now(),
      }
    } catch (error) {
      return {
        success: false,
        data: { error: error instanceof Error ? error.message : 'Unknown error' },
        rawResponse: '',
        timestamp: Date.now(),
      }
    } finally {
      clearTimeout(timeoutId)
    }
  }

  async getFullStatus(): Promise<TasmotaCommandResult> {
    return this.sendCommand('STATUS 0')
  }

  async getSensorStatus(): Promise<TasmotaCommandResult> {
    return this.sendCommand('STATUS 8')
  }

  async backlog(commands: string[]): Promise<TasmotaCommandResult> {
    return this.sendCommand(`BACKLOG ${commands.join('; ')}`)
  }
}
