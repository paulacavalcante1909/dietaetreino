import { motion } from 'framer-motion'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, Button, Field, PasswordField, Logo } from '../components/ui'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useTheme } from '../lib/theme'

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="safe-top mx-auto flex min-h-full max-w-sm flex-col justify-center px-6 py-10">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }}>
        <div className="mb-8 flex flex-col items-center text-center">
          <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }}>
            <Logo size={72} />
          </motion.div>
          <h1 className="mt-5 text-2xl font-bold">{title}</h1>
          <p className="mt-1 text-muted">{subtitle}</p>
        </div>
        {children}
      </motion.div>
    </div>
  )
}

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<ApiError | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await login(email, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err as ApiError)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Que bom te ver de novo" subtitle="Entre para continuar seu dia">
      <form onSubmit={submit} className="space-y-4">
        {error && !error.field('email') && !error.field('password') && <Alert>{error.message}</Alert>}
        <Field label="E-mail" name="email" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} error={error?.field('email')} />
        <PasswordField label="Senha" name="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} error={error?.field('password')} />
        <div className="-mt-1 text-right">
          <Link to="/esqueci-senha" className="text-sm font-semibold text-link">
            Esqueci minha senha
          </Link>
        </div>
        <Button type="submit" loading={loading} className="mt-2">
          Entrar
        </Button>
      </form>
      <p className="mt-8 text-center text-muted">
        Ainda não tem conta?{' '}
        <Link to="/cadastro" className="font-semibold text-link">
          Criar conta
        </Link>
      </p>
    </AuthShell>
  )
}

export function RegisterPage() {
  const { register } = useAuth()
  const { setTheme } = useTheme()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', terms: false })
  const [error, setError] = useState<ApiError | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await register(form)
      // Conta nova começa no tema padrão (Neutro), mesmo se o aparelho tinha outro tema escolhido
      setTheme('neutro')
      navigate('/metas/inicio', { replace: true })
    } catch (err) {
      setError(err as ApiError)
    } finally {
      setLoading(false)
    }
  }

  const fieldErrors = ['name', 'email', 'password', 'terms']

  return (
    <AuthShell title="Criar conta" subtitle="Leva menos de um minuto">
      <form onSubmit={submit} className="space-y-4">
        {error && !fieldErrors.some((f) => error.field(f)) && <Alert>{error.message}</Alert>}
        <Field label="Nome" name="name" autoComplete="given-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={error?.field('name')} />
        <Field label="E-mail" name="email" type="email" autoComplete="email" inputMode="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={error?.field('email')} />
        <PasswordField
          label="Senha"
          name="password"
          autoComplete="new-password"
          placeholder="Mínimo de 8 caracteres"
          required
          minLength={8}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          error={error?.field('password')}
        />
        <label className="flex items-start gap-3 pt-1 text-sm text-muted">
          <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-primary" checked={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.checked })} />
          <span>
            Li e aceito os{' '}
            <Link to="/termos" className="font-semibold text-link">
              Termos de Uso e a Política de Privacidade
            </Link>
            .
          </span>
        </label>
        {error?.field('terms') && <p className="text-sm text-danger">{error.field('terms')}</p>}
        <Button type="submit" loading={loading} className="mt-2">
          Criar conta
        </Button>
      </form>
      <p className="mt-8 text-center text-muted">
        Já tem conta?{' '}
        <Link to="/entrar" className="font-semibold text-link">
          Entrar
        </Link>
      </p>
    </AuthShell>
  )
}

/** Pedir o link de redefinição por e-mail. */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState<string | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const r = await api<{ message: string }>('/auth/forgot', { method: 'POST', body: { email } })
      setSent(r.message)
    } catch (err) {
      setError(err as ApiError)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Esqueci minha senha" subtitle="Enviamos um link para você criar uma nova">
      {sent ? (
        <div className="space-y-5 text-center">
          <p className="rounded-2xl bg-soft p-4 text-sm">{sent}</p>
          <p className="text-sm text-muted">Confira também a caixa de spam. O link vale por 60 minutos.</p>
          <Link to="/entrar" className="font-semibold text-link">Voltar para o login</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && !error.field('email') && <Alert>{error.message}</Alert>}
          <Field label="E-mail da conta" name="email" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} error={error?.field('email')} />
          <Button type="submit" loading={loading}>Enviar link</Button>
          <p className="pt-2 text-center text-sm">
            <Link to="/entrar" className="font-semibold text-link">Voltar para o login</Link>
          </p>
        </form>
      )}
    </AuthShell>
  )
}

/** Criar nova senha a partir do link recebido por e-mail. */
export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') ?? ''
  const email = params.get('email') ?? ''
  const [password, setPassword] = useState('')
  const [error, setError] = useState<ApiError | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const r = await api<{ message: string }>('/auth/reset', { method: 'POST', body: { token, email, password } })
      setDone(r.message)
      setTimeout(() => navigate('/entrar', { replace: true }), 2500)
    } catch (err) {
      setError(err as ApiError)
    } finally {
      setLoading(false)
    }
  }

  if (!token || !email) {
    return (
      <AuthShell title="Link incompleto" subtitle="Abra o link exatamente como chegou no e-mail">
        <p className="text-center"><Link to="/esqueci-senha" className="font-semibold text-link">Pedir um novo link</Link></p>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Nova senha" subtitle={email}>
      {done ? (
        <p className="rounded-2xl bg-soft p-4 text-center text-sm">{done} Levando você ao login…</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && <Alert>{error.field('token') ?? error.field('password') ?? error.message}</Alert>}
          <PasswordField label="Nova senha" name="password" autoComplete="new-password" placeholder="Mínimo de 8 caracteres" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button type="submit" loading={loading}>Salvar nova senha</Button>
          {error?.field('token') && (
            <p className="text-center text-sm"><Link to="/esqueci-senha" className="font-semibold text-link">Pedir um novo link</Link></p>
          )}
        </form>
      )}
    </AuthShell>
  )
}
