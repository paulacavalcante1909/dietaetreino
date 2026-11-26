import { ask } from './Dialog'
import { Camera } from 'lucide-react'
import { useRef, useState } from 'react'
import { api, ApiError, apiUpload } from '../lib/api'
import { useAuth } from '../lib/auth'
import { compressImage } from '../lib/image'
import { useTheme } from '../lib/theme'
import type { User } from '../lib/types'
import { useToast } from './Toast'

/** Foto de perfil; sem foto, mostra o mascote do tema. */
export function Avatar({ size = 52, className = '' }: { size?: number; className?: string }) {
  const { user } = useAuth()
  const { theme } = useTheme()
  return (
    <img
      src={user?.avatar_url ?? `${theme.assets}/mascote.png`}
      alt={user?.avatar_url ? 'Sua foto de perfil' : ''}
      width={size}
      height={size}
      className={`shrink-0 rounded-full object-cover shadow-md ${className}`}
      style={{ width: size, height: size }}
    />
  )
}

/** Trocar ou remover a foto de perfil (Ajustes). Remover pede confirmação. */
export function AvatarEditor() {
  const { user, setUser } = useAuth()
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const upload = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      const form = new FormData()
      form.append('avatar', await compressImage(file), 'perfil.jpg')
      const r = await apiUpload<{ user: User }>('/me/avatar', form)
      setUser(r.user)
      toast({ text: 'Foto de perfil atualizada ✓' })
    } catch (e) {
      toast({ text: (e as ApiError).message })
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  const remove = async () => {
    if (!(await ask({ title: 'Remover sua foto de perfil?', text: 'O mascote do tema volta a aparecer no lugar.', confirmLabel: 'Remover foto', danger: true }))) return
    const r = await api<{ user: User }>('/me/avatar', { method: 'DELETE' })
    setUser(r.user)
    toast({ text: 'Foto removida' })
  }

  return (
    <div className="flex items-center gap-4">
      <button onClick={() => input.current?.click()} disabled={busy} aria-label={user?.avatar_url ? 'Trocar foto de perfil' : 'Adicionar foto de perfil'} className="relative shrink-0 active:scale-95 disabled:opacity-60">
        <Avatar size={72} />
        <span className="absolute -right-0.5 -bottom-0.5 flex size-7 items-center justify-center rounded-full bg-primary text-white ring-2 ring-bg">
          <Camera className="size-4" />
        </span>
      </button>
      <div className="min-w-0">
        <p className="truncate text-lg font-bold">{user?.name}</p>
        <p className="truncate text-sm text-muted">{user?.email}</p>
        <div className="mt-1 flex gap-3 text-sm font-semibold">
          <button onClick={() => input.current?.click()} disabled={busy} className="text-link">{busy ? 'Enviando…' : user?.avatar_url ? 'Trocar foto' : 'Adicionar foto'}</button>
          {user?.avatar_url && <button onClick={remove} className="text-muted">Remover</button>}
        </div>
      </div>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0])} />
    </div>
  )
}
