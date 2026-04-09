export interface HttpAuth {
  username: string
  password: string
}

export interface HttpResult {
  ok:        boolean
  data:      Record<string, unknown>
  status:    number
  timestamp: number
}

export type HttpErrorType =
  | 'timeout'     // request timed out (AbortError)
  | 'cors'        // CORS blocked — SetOption120 1 not set
  | 'auth'        // 401 Unauthorized — wrong password
  | 'network'     // device unreachable / DNS failure
  | 'parse'       // response not valid JSON
  | 'server'      // HTTP 5xx from device

export class HttpError extends Error {
  readonly type:   HttpErrorType
  readonly status: number | undefined

  constructor(type: HttpErrorType, message: string, status?: number) {
    super(message)
    this.name   = 'HttpError'
    this.type   = type
    this.status = status
  }
}
