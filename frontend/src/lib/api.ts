const TOKEN_KEY = 'dt_token'

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

export class ApiError extends Error {
  status: number
  errors: Record<string, string[]>

  constructor(status: number, message: string, errors: Record<string, string[]> = {}) {
    super(message)
    this.status = status
    this.errors = errors
  }

  /** Primeira mensagem de erro de um campo. */
  field(name: string): string | undefined {
    return this.errors[name]?.[0]
  }
}

let onUnauthorized: () => void = () => {}
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn
}

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = tokenStore.get()
  if (token) headers.Authorization = `Bearer ${token}`
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'

  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'Sem conexão com a internet. Tente novamente.')
  }

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized()
    const message =
      res.status === 429
        ? 'Muitas tentativas. Aguarde um minuto e tente de novo.'
        : res.status >= 500
          ? 'Algo deu errado no servidor. Tente novamente.'
          : (data.message ?? 'Não foi possível concluir.')
    throw new ApiError(res.status, message, data.errors ?? {})
  }

  return data as T
}

/** Envio multipart (fotos). Não define Content-Type: o navegador monta o boundary. */
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = tokenStore.get()
  if (token) headers.Authorization = `Bearer ${token}`
  let res: Response
  try {
    res = await fetch(`/api${path}`, { method: 'POST', headers, body: form })
  } catch {
    throw new ApiError(0, 'Sem conexão com a internet. Tente novamente.')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized()
    const message = res.status === 413 ? 'A foto é muito grande.' : res.status >= 500 ? 'Algo deu errado no servidor. Tente novamente.' : (data.message ?? 'Não foi possível concluir.')
    throw new ApiError(res.status, message, data.errors ?? {})
  }
  return data as T
}
