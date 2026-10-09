import type { CapacitorConfig } from '@capacitor/cli'
import { KeyboardResize } from '@capacitor/keyboard'

const config: CapacitorConfig = {
  appId: 'app.lift.training',
  appName: 'Lift',
  webDir: 'dist',
  ios: { contentInset: 'never' },
  // The WebView keeps its height; the interface follows the keyboard as it starts to rise.
  plugins: { Keyboard: { resize: KeyboardResize.None } },
}
export default config
