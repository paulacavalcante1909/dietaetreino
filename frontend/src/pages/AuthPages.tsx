import { motion } from 'framer-motion'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Alert, Button, Field, PasswordField, Logo } from '../components/ui'
import { ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'

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
    <AuthShell title="Bem-vinda de volta" subtitle="Entre para continuar seu dia">
      <form onSubmit={submit} className="space-y-4">
        {error && !error.field('email') && !error.field('password') && <Alert>{error.message}</Alert>}
        <Field label="E-mail" name="email" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} error={error?.field('email')} />
        <PasswordField label="Senha" name="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} error={error?.field('password')} />
        <Button type="submit" loading={loading} className="mt-2">
          Entrar
        </Button>
      </form>
      <p className="mt-8 text-center text-muted">
        Ainda não tem conta?{' '}
        <Link to="/cadastro" className="font-semibold text-primary">
          Criar conta
        </Link>
      </p>
    </AuthShell>
  )
}

export function RegisterPage() {
  const { register } = useAuth()
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
            <Link to="/termos" className="font-semibold text-primary">
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
        <Link to="/entrar" className="font-semibold text-primary">
          Entrar
        </Link>
      </p>
    </AuthShell>
  )
}
