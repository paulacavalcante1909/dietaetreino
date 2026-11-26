import { durationLabel } from './run'
import type { WorkoutSessionData } from './types'
import { fmtKm, isTimed } from './workout'

const W = 1080
const H = 1350

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })

const cssVar = (name: string, fallback: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback

/** Números do treino para o card: tempo, kcal, km (se houver) e exercícios/séries. */
export function sessionStats(s: WorkoutSessionData) {
  const km = s.exercises.reduce((a, e) => a + (e.done ? (e.distance_km ?? 0) : 0), 0)
  const done = s.exercises.filter((e) => e.done).length
  const sets = s.exercises.filter((e) => !isTimed(e)).reduce((a, e) => a + e.sets_done, 0)
  return { km, done, sets, duration: durationLabel(s.duration_seconds), kcal: s.kcal_burned ?? 0 }
}

/**
 * Imagem para compartilhar (estilo Strava): a foto do treino (ou um fundo nas cores do tema)
 * com nome, data, tempo, calorias, km e exercícios. 1080 × 1350 (4:5).
 */
export async function renderShareCard(session: WorkoutSessionData, photoUrl: string | null, appName: string): Promise<Blob> {
  await document.fonts?.ready
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const c = canvas.getContext('2d')!
  const font = (weight: number, size: number) => `${weight} ${size}px Nunito, system-ui, sans-serif`

  // Fundo: foto em "cover" ou gradiente do tema
  let photo: HTMLImageElement | null = null
  if (photoUrl) photo = await loadImage(photoUrl).catch(() => null)
  if (photo) {
    const scale = Math.max(W / photo.width, H / photo.height)
    const w = photo.width * scale
    const h = photo.height * scale
    c.drawImage(photo, (W - w) / 2, (H - h) / 2, w, h)
  } else {
    const g = c.createLinearGradient(0, 0, W, H)
    g.addColorStop(0, cssVar('--color-orchid', '#cc6cd7'))
    g.addColorStop(1, cssVar('--color-primary', '#9b3fa8'))
    c.fillStyle = g
    c.fillRect(0, 0, W, H)
  }

  // Escurece embaixo para o texto ficar legível em qualquer foto
  const shade = c.createLinearGradient(0, H * 0.35, 0, H)
  shade.addColorStop(0, 'rgba(0,0,0,0)')
  shade.addColorStop(1, photo ? 'rgba(0,0,0,0.78)' : 'rgba(0,0,0,0.35)')
  c.fillStyle = shade
  c.fillRect(0, 0, W, H)

  const st = sessionStats(session)
  const pad = 72
  c.fillStyle = '#fff'
  c.textBaseline = 'alphabetic'

  // Estatísticas (até 3 colunas)
  const cols: [string, string][] = [[st.duration, 'tempo']]
  if (st.km > 0) cols.push([`${fmtKm(st.km)} km`, 'distância'])
  cols.push([st.kcal > 0 ? `${st.kcal}` : '—', 'kcal gastas'])
  if (cols.length < 3) cols.push([st.sets > 0 ? `${st.sets}` : `${st.done}`, st.sets > 0 ? 'séries' : st.done === 1 ? 'exercício' : 'exercícios'])
  const colW = (W - pad * 2) / cols.length
  cols.forEach(([v, l], i) => {
    const x = pad + i * colW
    c.font = font(800, 76)
    c.fillText(v, x, H - pad - 56, colW - 16)
    c.font = font(600, 34)
    c.globalAlpha = 0.85
    c.fillText(l, x, H - pad - 8)
    c.globalAlpha = 1
  })

  // Linha divisória + nome + data
  c.fillRect(pad, H - pad - 150, W - pad * 2, 3)
  const date = new Date(`${session.date}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  c.font = font(600, 36)
  c.globalAlpha = 0.9
  c.fillText(date.charAt(0).toUpperCase() + date.slice(1), pad, H - pad - 196)
  c.globalAlpha = 1
  c.font = font(800, 72)
  const name = session.workout_name.length > 28 ? `${session.workout_name.slice(0, 27)}…` : session.workout_name
  c.fillText(name, pad, H - pad - 250, W - pad * 2)

  // Marca do app no topo
  c.font = font(800, 34)
  c.globalAlpha = 0.9
  c.fillText(appName, pad, pad + 20)
  c.globalAlpha = 1

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.9))
}

/** Compartilha (celular) ou baixa a imagem (computador). Retorna o que foi feito. */
export async function shareImage(blob: Blob, filename: string, title: string): Promise<'shared' | 'saved' | 'cancelled'> {
  const file = new File([blob], filename, { type: 'image/jpeg' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title })
      return 'shared'
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelled'
    }
  }
  saveImage(blob, filename)
  return 'saved'
}

export function saveImage(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
