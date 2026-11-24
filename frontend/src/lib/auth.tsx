import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, setUnauthorizedHandler, tokenStore } from './api'
import type { Goal, Session, User } from './types'

interface AuthState {
  user: User | null
  goal: Goal | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (data: { name: string; email: string; password: string; terms: boolean }) => Promise<void>
  logout: () => Promise<void>
  setUser: (u: User) => void
  setGoal: (g: Goal) => void
  clear: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [goal, setGoal] = useState<Goal | null>(null)
  const [loading, setLoading] = useState(!!tokenStore.get())

  const clear = useCallback(() => {
    tokenStore.clear()
    setUser(null)
    setGoal(null)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(clear)
    if (!tokenStore.get()) return
    api<{ user: User; goal: Goal | null }>('/me')
      .then((r) => {
        setUser(r.user)
        setGoal(r.goal)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [clear])

  const applySession = (s: Session) => {
    tokenStore.set(s.token)
    setUser(s.user)
    setGoal(s.goal)
  }

  const value: AuthState = {
    user,
    goal,
    loading,
    login: async (email, password) => applySession(await api<Session>('/auth/login', { method: 'POST', body: { email, password } })),
    register: async (data) => applySession(await api<Session>('/auth/register', { method: 'POST', body: data })),
    logout: async () => {
      await api('/auth/logout', { method: 'POST' }).catch(() => {})
      clear()
    },
    setUser,
    setGoal,
    clear,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth fora do AuthProvider')
  return ctx
}
