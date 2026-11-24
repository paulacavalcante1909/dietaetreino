import { registerSW } from 'virtual:pwa-register'

/**
 * Atualização automática do app instalado.
 *
 * O celular normalmente só "retoma" o PWA da memória, sem procurar versão nova.
 * Aqui o app verifica atualização ao abrir, sempre que volta para a tela e a cada 15 min.
 * Com registerType 'autoUpdate', quando a versão nova assume, a página recarrega sozinha
 * (o progresso do treino em andamento fica salvo no aparelho, então nada se perde).
 */
let registration: ServiceWorkerRegistration | undefined

export function setupPwa() {
  if (!('serviceWorker' in navigator)) return

  registerSW({
    immediate: true,
    onRegisteredSW(_url, reg) {
      registration = reg
      if (!reg) return
      const check = () => {
        if (navigator.onLine) reg.update().catch(() => {})
      }
      check()
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
      window.addEventListener('focus', check)
      window.addEventListener('online', check)
      setInterval(check, 15 * 60 * 1000)
    },
  })
}

/** Verificação manual (Ajustes). Retorna true se encontrou versão nova (o app recarrega em seguida). */
export async function checkForUpdate(): Promise<boolean> {
  const reg = registration ?? (await navigator.serviceWorker?.getRegistration())
  if (!reg) return false
  await reg.update()
  return !!(reg.installing || reg.waiting)
}

/** Último recurso: apaga o cache do app e recarrega do servidor (não apaga login nem treino em andamento). */
export async function hardRefresh() {
  const regs = (await navigator.serviceWorker?.getRegistrations()) ?? []
  await Promise.all(regs.map((r) => r.unregister()))
  if ('caches' in window) {
    const keys = await caches.keys()
    await Promise.all(keys.map((k) => caches.delete(k)))
  }
  location.reload()
}

/** Data/hora em que esta versão foi gerada (mostrada em Ajustes). */
export const APP_VERSION = new Date(__APP_BUILD__).toLocaleString('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})
