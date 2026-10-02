// Build facts injected by Vite (vite.config.ts → define).
declare const __APP_VERSION__: string
/** The deploy run number; empty for a local build. */
declare const __APP_BUILD__: string
/** Short commit hash; empty outside a git checkout. */
declare const __APP_COMMIT__: string
/** Build time, ISO 8601 (shown as a date in the reader's time zone). */
declare const __APP_BUILT__: string
