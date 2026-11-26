import { AnimatePresence, motion } from 'framer-motion'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { Alert, Button, Card, Field, PasswordField } from '../components/ui'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { User } from '../lib/types'
import { useToast } from '../components/Toast'
import { APP_VERSION, checkForUpdate, hardRefresh } from '../lib/pwa'
import { THEMES, useTheme } from '../lib/theme'

function Section({ title, children, open, onToggle }: { title: string; children: ReactNode; open: boolean; onToggle: () => void }) {
  return (
    <Card className="!p-0">
      <button onClick={onToggle} className="flex w-full items-center justify-between px-5 py-4 text-left font-medium">
        {title}
        <motion.span animate={{ rotate: open ? 90 : 0 }} className="text-muted">
          <ChevronRight className="size-5" />
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

      <SectionTitle>Aparência</SectionTitle>
      <ThemePicker />

      <SectionTitle>Nutrição</SectionTitle>

      <Link to="/metas" className="block">
        <Card className="flex items-center justify-between !py-4 transition-transform active:scale-[0.98]">
          <span>
            <span className="block font-medium">Metas diárias</span>
            <span className="block text-xs text-muted">Calorias, macros, água e treino na meta</span>
          </span>
          <ChevronRight className="size-5 text-muted" />
        </Card>
      </Link>

      <Link to="/receitas" className="block">
        <Card className="flex items-center justify-between !py-4 transition-transform active:scale-[0.98]">
          <span>
            <span className="block font-medium">Refeições prontas</span>
            <span className="block text-xs text-muted">Combinações e receitas para adicionar com 1 toque</span>
          </span>
          <ChevronRight className="size-5 text-muted" />
        </Card>
      </Link>

      <Link to="/refeicoes" className="block">
        <Card className="flex items-center justify-between !py-4 transition-transform active:scale-[0.98]">
          <span>
            <span className="block font-medium">Organizar refeições do dia</span>
            <span className="block text-xs text-muted">Renomear, reordenar, ocultar ou criar</span>
          </span>
          <ChevronRight className="size-5 text-muted" />
        </Card>
      </Link>

      <SectionTitle>Conta</SectionTitle>
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

      <Button variant="ghost" onClick={logout}>
        Sair da conta
      </Button>

      <SectionTitle>Sobre</SectionTitle>
      <AppVersionCard />
      <Link to="/termos" className="block">
        <Card className="flex items-center justify-between !py-4 transition-transform active:scale-[0.98]">
          <span>
            <span className="block font-medium">Termos e privacidade</span>
            <span className="block text-xs text-muted">LGPD, seus dados e fontes</span>
          </span>
          <ChevronRight className="size-5 text-muted" />
        </Card>
      </Link>

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

/** Versão instalada + atualizar manualmente (o app também atualiza sozinho ao abrir). */
function AppVersionCard() {
  const toast = useToast()
  const [busy, setBusy] = useState<'check' | 'reset' | null>(null)

  const check = async () => {
    setBusy('check')
    try {
      const found = await checkForUpdate()
      toast({ text: found ? 'Versão nova encontrada, atualizando…' : 'Você já está na versão mais recente ✓' })
    } catch {
      toast({ text: 'Sem conexão. Tente de novo com internet.' })
    } finally {
      setBusy(null)
    }
  }

  const reset = async () => {
    if (!confirm('Apagar o cache do app e recarregar? Seu login e seus dados continuam salvos.')) return
    setBusy('reset')
    await hardRefresh()
  }

  return (
    <Card className="!py-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">Versão do app</p>
          <p className="text-xs text-muted">{APP_VERSION} · atualiza sozinho ao abrir</p>
        </div>
        <button onClick={check} disabled={!!busy} className="shrink-0 rounded-full bg-soft px-4 py-2 text-sm font-semibold text-primary disabled:opacity-50">
          {busy === 'check' ? 'Buscando…' : 'Buscar atualização'}
        </button>
      </div>
      <button onClick={reset} disabled={!!busy} className="mt-3 text-xs font-medium text-muted underline underline-offset-2">
        Problemas? Limpar cache e recarregar
      </button>
    </Card>
  )
}

/** Escolha do tema: cores, mascote, logo e favicon. */
function ThemePicker() {
  const { theme, setTheme } = useTheme()
  return (
    <Card className="!p-4">
      <p className="mb-3 font-medium">Tema</p>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tema do app">
        {THEMES.map((t) => {
          const active = t.id === theme.id
          return (
            <button
              key={t.id}
              role="radio"
              aria-checked={active}
              onClick={() => setTheme(t.id)}
              className={`relative overflow-hidden rounded-2xl border-2 p-2 text-left transition-all active:scale-95 ${active ? 'border-primary shadow-md' : 'border-line'}`}
              style={{ background: t.preview.bg }}
            >
              <img src={`${t.assets}/mascote.png`} alt="" className="mx-auto size-14 rounded-full" />
              <div className="mt-2 flex justify-center gap-1" aria-hidden>
                <span className="h-1.5 w-5 rounded-full" style={{ background: t.preview.accent }} />
                <span className="h-1.5 w-3 rounded-full" style={{ background: t.preview.accent2 }} />
              </div>
              <p className="mt-1.5 text-center text-xs font-semibold" style={{ color: t.id === 'dark' ? '#eef0f3' : '#3a2418' }}>
                {t.name}
              </p>
              {active && <span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] text-white">✓</span>}
            </button>
          )
        })}
      </div>
      <p className="mt-2 text-xs text-muted">Muda cores, mascote e o ícone da aba. O ícone do app instalado continua o mesmo.</p>
    </Card>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="px-1 pt-4 text-xs font-bold tracking-wider text-muted uppercase">{children}</h2>
}
