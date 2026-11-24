import { AnimatePresence, motion } from 'framer-motion'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Button, Card, Field, PasswordField } from '../components/ui'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { User } from '../lib/types'

function Section({ title, children, open, onToggle }: { title: string; children: ReactNode; open: boolean; onToggle: () => void }) {
  return (
    <Card className="!p-0">
      <button onClick={onToggle} className="flex w-full items-center justify-between px-5 py-4 text-left font-medium">
        {title}
        <motion.span animate={{ rotate: open ? 90 : 0 }} className="text-muted">
          ›
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}

function useSubmit(fn: () => Promise<void>) {
  const [error, setError] = useState<ApiError | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await fn()
      setDone(true)
      setTimeout(() => setDone(false), 2000)
    } catch (err) {
      setError(err as ApiError)
    } finally {
      setLoading(false)
    }
  }
  return { error, loading, done, submit }
}

export function SettingsPage() {
  const { user, setUser, logout, clear } = useAuth()
  const [open, setOpen] = useState<string | null>(null)
  const toggle = (k: string) => setOpen(open === k ? null : k)

  const [profile, setProfile] = useState({ name: user?.name ?? '', email: user?.email ?? '' })
  const profileForm = useSubmit(async () => {
    const r = await api<{ user: User }>('/me', { method: 'PUT', body: profile })
    setUser(r.user)
  })

  const [pwd, setPwd] = useState({ current_password: '', password: '' })
  const pwdForm = useSubmit(async () => {
    await api('/me/password', { method: 'PUT', body: pwd })
    setPwd({ current_password: '', password: '' })
  })

  const [delPwd, setDelPwd] = useState('')
  const delForm = useSubmit(async () => {
    await api('/me', { method: 'DELETE', body: { password: delPwd } })
    clear()
  })

  return (
    <div className="safe-top space-y-3 px-5 pt-6 pb-6">
      <h1 className="mb-2 text-2xl font-bold">Ajustes</h1>

      <Link to="/metas" className="block">
        <Card className="flex items-center justify-between !py-4 transition-transform active:scale-[0.98]">
          <span className="font-medium">Metas diárias</span>
          <span className="text-muted">›</span>
        </Card>
      </Link>

      <Link to="/receitas" className="block">
        <Card className="flex items-center justify-between !py-4 transition-transform active:scale-[0.98]">
          <span className="font-medium">Refeições prontas</span>
          <span className="text-muted">›</span>
        </Card>
      </Link>

      <Link to="/refeicoes" className="block">
        <Card className="flex items-center justify-between !py-4 transition-transform active:scale-[0.98]">
          <span className="font-medium">Refeições</span>
          <span className="text-muted">›</span>
        </Card>
      </Link>

      <Section title="Meus dados" open={open === 'profile'} onToggle={() => toggle('profile')}>
        <form onSubmit={profileForm.submit} className="space-y-3">
          <Field label="Nome" name="name" required value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} error={profileForm.error?.field('name')} />
          <Field label="E-mail" name="email" type="email" required value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} error={profileForm.error?.field('email')} />
          <Button type="submit" loading={profileForm.loading}>
            {profileForm.done ? 'Salvo ✓' : 'Salvar'}
          </Button>
        </form>
      </Section>

      <Section title="Alterar senha" open={open === 'password'} onToggle={() => toggle('password')}>
        <form onSubmit={pwdForm.submit} className="space-y-3">
          <PasswordField label="Senha atual" name="current_password" autoComplete="current-password" required value={pwd.current_password} onChange={(e) => setPwd({ ...pwd, current_password: e.target.value })} error={pwdForm.error?.field('current_password')} />
          <PasswordField label="Nova senha" name="new_password" autoComplete="new-password" minLength={8} required value={pwd.password} onChange={(e) => setPwd({ ...pwd, password: e.target.value })} error={pwdForm.error?.field('password')} />
          <Button type="submit" loading={pwdForm.loading}>
            {pwdForm.done ? 'Senha alterada ✓' : 'Alterar senha'}
          </Button>
        </form>
      </Section>

      <Link to="/termos" className="block">
        <Card className="flex items-center justify-between !py-4">
          <span className="font-medium">Termos e privacidade</span>
          <span className="text-muted">›</span>
        </Card>
      </Link>

      <Button variant="ghost" onClick={logout} className="!mt-6">
        Sair
      </Button>

      <Section title="Excluir conta" open={open === 'delete'} onToggle={() => toggle('delete')}>
        <form onSubmit={delForm.submit} className="space-y-3">
          <p className="text-sm text-muted">Isso apaga sua conta e todos os seus dados para sempre. Não dá para desfazer.</p>
          {delForm.error && !delForm.error.field('password') && <Alert>{delForm.error.message}</Alert>}
          <PasswordField label="Confirme sua senha" name="delete_password" required value={delPwd} onChange={(e) => setDelPwd(e.target.value)} error={delForm.error?.field('password')} />
          <Button type="submit" variant="danger" loading={delForm.loading}>
            Excluir minha conta
          </Button>
        </form>
      </Section>
    </div>
  )
}
