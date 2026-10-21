const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'

export class ApiError extends Error {
  readonly status: number
  readonly detail: unknown

  constructor(status: number, detail: unknown) {
    super(ApiError.messageFrom(status, detail))
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }

  // FastAPI errors are `{"detail": "..."}`, or a list of field errors for 422
  private static messageFrom(status: number, detail: unknown): string {
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail) && typeof detail[0]?.msg === 'string') return detail[0].msg
    return `HTTP ${status}`
  }
}

interface RequestOptions {
  method?: string
  token?: string | null
  /** Sent as JSON */
  json?: unknown
  /** Sent as is, e.g. URLSearchParams for form-encoded bodies */
  body?: BodyInit
}

export async function request<T>(
  path: string,
  { method = 'GET', token, json, body }: RequestOptions = {},
): Promise<T> {
  const headers = new Headers()
  if (json !== undefined) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(json)
  }
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(`${API_URL}${path}`, { method, headers, body })

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new ApiError(response.status, data?.detail)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}
