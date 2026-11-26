import { ask } from '../components/Dialog'
import { AnimatePresence, motion } from 'framer-motion'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BookOpen, ChevronRight, Dumbbell, Info, KeyRound, ListOrdered, LogOut, RefreshCw, ShieldCheck, Target, Trash2, UserRound, type LucideIcon } from 'lucide-react'
import { AvatarEditor } from '../components/Avatar'
import { Alert, Button, Card, Field, PasswordField } from '../components/ui'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { User } from '../lib/types'
import { useToast } from '../components/Toast'
import { WeeklyGoalSheet } from '../components/WeeklyGoalSheet'
import { APP_VERSION, checkForUpdate, hardRefresh } from '../lib/pwa'
import { THEMES, useTheme } from '../lib/theme'

/** Grupo de opções num card só (linhas separadas por um fio). */
function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section>
      {title && <h2 className="mb-2 px-1 text-xs font-bold tracking-wider text-muted uppercase">{title}</h2>}
      <Card className="divide-y divide-line overflow-hidden !p-0">{children}</Card>
    </section>
  )
}

type RowProps = { icon: LucideIcon; title: string; hint?: string; danger?: boolean }

function RowBody({ icon: Icon, title, hint, danger, trailing }: RowProps & { trailing?: ReactNode }) {
  return (
    <>
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${danger ? 'bg-coral/15 text-danger' : 'bg-soft text-link'}`}>
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block font-semibold ${danger ? 'text-danger' : ''}`}>{title}</span>
        {hint && <span className="block truncate text-xs text-muted">{hint}</span>}
      </span>
      {trailing ?? <ChevronRight className="size-5 shrink-0 text-muted" />}
    </>
  )
}

const rowClass = 'flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-soft'

/** Linha que leva a outra tela */
function LinkRow({ to, ...p }: RowProps & { to: string }) {
  return (
    <Link to={to} className={rowClass}>
      <RowBody {...p} />
    </Link>
  )
}

/** Linha que abre algo (folha, ação) */
function ButtonRow({ onClick, ...p }: RowProps & { onClick: () => void }) {
  return (
    <button onClick={onClick} className={rowClass}>
      <RowBody {...p} />
    </button>
  )
}

/** Linha que expande um formulário logo abaixo */
function ExpandRow({ open, onToggle, children, ...p }: RowProps & { open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div>
      <button onClick={onToggle} aria-expanded={open} className={rowClass}>
        <RowBody
          {...p}
          trailing={
            <motion.span animate={{ rotate: open ? 90 : 0 }} className="shrink-0 text-muted">
              <ChevronRight className="size-5" />
            </motion.span>
          }
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
            <div className="px-4 pt-1 pb-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
  const [params] = useSearchParams()
  const [open, setOpen] = useState<string | null>(params.get('abrir') === 'dados' ? 'profile' : null)
  const toggle = (k: string) => setOpen(open === k ? null : k)
  const [goalOpen, setGoalOpen] = useState(false)

  const [profile, setProfile] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    sex: user?.sex ?? '',
    birth_date: user?.birth_date ?? '',
    height_cm: user?.height_cm ? String(user.height_cm) : '',
  })
  const profileForm = useSubmit(async () => {
    const r = await api<{ user: User }>('/me', {
      method: 'PUT',
      body: { ...profile, sex: profile.sex || null, birth_date: profile.birth_date || null, height_cm: profile.height_cm ? Number(profile.height_cm) : null },
    })
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
    <div className="safe-top space-y-6 px-5 pt-6 pb-6">
      <h1 className="text-2xl font-bold">Ajustes</h1>

      <Card className="!p-4">
        <AvatarEditor />
      </Card>

      <Group title="Metas">
        <LinkRow to="/metas" icon={Target} title="Metas diárias" hint="Calorias, macros, água e como o dia conta" />
        <ButtonRow
          onClick={() => setGoalOpen(true)}
          icon={Dumbbell}
          title="Treinos por semana"
          hint={`${user?.weekly_workout_goal ?? 3} ${(user?.weekly_workout_goal ?? 3) === 1 ? 'treino' : 'treinos'} por semana`}
        />
      </Group>
      <WeeklyGoalSheet open={goalOpen} onClose={() => setGoalOpen(false)} value={user?.weekly_workout_goal ?? 3} />

      <Group title="Refeições">
        <LinkRow to="/receitas" icon={BookOpen} title="Refeições prontas" hint="Combinações para registrar com 1 toque" />
        <LinkRow to="/refeicoes" icon={ListOrdered} title="Refeições do dia" hint="Renomear, reordenar, ocultar ou criar" />
      </Group>

      <section>
        <h2 className="mb-2 px-1 text-xs font-bold tracking-wider text-muted uppercase">Aparência</h2>
        <ThemePicker />
      </section>

      <Group title="Conta">
        <ExpandRow icon={UserRound} title="Meus dados" hint="Nome, e-mail, altura e nascimento" open={open === 'profile'} onToggle={() => toggle('profile')}>
        <form onSubmit={profileForm.submit} className="space-y-3">
          <Field label="Nome" name="name" required value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} error={profileForm.error?.field('name')} />
          <Field label="E-mail" name="email" type="email" required value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} error={profileForm.error?.field('email')} />
          <div className="space-y-3 rounded-2xl bg-soft p-3">
            <p className="text-xs text-muted">Para estimar seu gasto calórico e o déficit (fórmula de Mifflin-St Jeor). Opcional.</p>
            <div>
              <p className="mb-1.5 text-sm font-medium">Sexo (para a fórmula)</p>
              <div className="flex gap-2" role="radiogroup" aria-label="Sexo">
                {([['f', 'Feminino'], ['m', 'Masculino']] as const).map(([k, l]) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={profile.sex === k}
                    onClick={() => setProfile({ ...profile, sex: profile.sex === k ? '' : k })}
                    className={`h-11 flex-1 rounded-xl text-sm font-semibold transition ${profile.sex === k ? 'bg-primary text-white' : 'bg-surface text-ink'}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              {profileForm.error?.field('sex') && <p className="mt-1 text-xs text-danger">{profileForm.error.field('sex')}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nascimento" name="birth_date" type="date" max={new Date().toISOString().slice(0, 10)} value={profile.birth_date} onChange={(e) => setProfile({ ...profile, birth_date: e.target.value })} error={profileForm.error?.field('birth_date')} />
              <Field label="Altura" name="height_cm" suffix="cm" inputMode="numeric" placeholder="ex.: 165" value={profile.height_cm} onChange={(e) => setProfile({ ...profile, height_cm: e.target.value.replace(/\D/g, '').slice(0, 3) })} error={profileForm.error?.field('height_cm')} />
            </div>
            <p className="text-xs text-muted">O peso vem do seu último registro em Progresso → Peso.</p>
          </div>
          <Button type="submit" loading={profileForm.loading}>
            {profileForm.done ? 'Salvo ✓' : 'Salvar'}
          </Button>
        </form>
        </ExpandRow>
        <ExpandRow icon={KeyRound} title="Alterar senha" open={open === 'password'} onToggle={() => toggle('password')}>
        <form onSubmit={pwdForm.submit} className="space-y-3">
          <PasswordField label="Senha atual" name="current_password" autoComplete="current-password" required value={pwd.current_password} onChange={(e) => setPwd({ ...pwd, current_password: e.target.value })} error={pwdForm.error?.field('current_password')} />
          <PasswordField label="Nova senha" name="new_password" autoComplete="new-password" minLength={8} required value={pwd.password} onChange={(e) => setPwd({ ...pwd, password: e.target.value })} error={pwdForm.error?.field('password')} />
          <Button type="submit" loading={pwdForm.loading}>
            {pwdForm.done ? 'Senha alterada ✓' : 'Alterar senha'}
          </Button>
        </form>
        </ExpandRow>
        <ButtonRow onClick={logout} icon={LogOut} title="Sair da conta" />
      </Group>

      <Group title="Sobre o app">
        <AppVersionRow />
        <LinkRow to="/termos" icon={ShieldCheck} title="Termos e privacidade" hint="LGPD, seus dados e fontes" />
        <ExpandRow icon={Trash2} title="Excluir conta" danger open={open === 'delete'} onToggle={() => toggle('delete')}>
        <form onSubmit={delForm.submit} className="space-y-3">
          <p className="text-sm text-muted">Isso apaga sua conta e todos os seus dados para sempre. Não dá para desfazer.</p>
          {delForm.error && !delForm.error.field('password') && <Alert>{delForm.error.message}</Alert>}
          <PasswordField label="Confirme sua senha" name="delete_password" required value={delPwd} onChange={(e) => setDelPwd(e.target.value)} error={delForm.error?.field('password')} />
          <Button type="submit" variant="danger" loading={delForm.loading}>
            Excluir minha conta
          </Button>
        </form>
        </ExpandRow>
      </Group>
    </div>
  )
}

/** Versão instalada + atualizar manualmente (o app também atualiza sozinho ao abrir). */
function AppVersionRow() {
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
    if (!(await ask({ title: 'Limpar o cache e recarregar?', text: 'Seu login e seus dados continuam salvos.', confirmLabel: 'Limpar e recarregar' }))) return
    setBusy('reset')
    await hardRefresh()
  }

  return (
    <>
      <div className={rowClass}>
        <RowBody
          icon={Info}
          title="Versão do app"
          hint={`${APP_VERSION} · atualiza sozinho ao abrir`}
          trailing={
            <button onClick={check} disabled={!!busy} className="shrink-0 rounded-full bg-soft px-3.5 py-2 text-sm font-semibold text-link disabled:opacity-50">
              {busy === 'check' ? 'Buscando…' : 'Atualizar'}
            </button>
          }
        />
      </div>
      <ButtonRow onClick={reset} icon={RefreshCw} title="Limpar cache e recarregar" hint="Se algo parecer travado ou desatualizado" />
    </>
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
              <p className="mt-1.5 text-center text-xs font-semibold" style={{ color: t.id === 'dark' || t.id === 'neutro' ? '#eef0f3' : '#1f2430' }}>
                {t.name}
              </p>
              {active && <span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] text-white">✓</span>}
            </button>
          )
        })}
      </div>
      <p className="mt-2 text-xs text-muted">Muda as cores e o mascote do app.</p>
    </Card>
  )
}
