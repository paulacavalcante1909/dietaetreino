/// <reference types="vite-plugin-pwa/client" />

/** Data/hora do build (ISO), definida no vite.config.ts. */
declare const __APP_BUILD__: string

interface WakeLockSentinel {
  release(): Promise<void>
}
