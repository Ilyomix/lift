import { ArrowLeft } from 'lucide-react'
import { Button, Screen } from '../components/ui'
import { L } from '../lib/i18n'
import { navigate } from '../lib/router'

/** Keep the app and its storage connection alive while reading the local policy. */
export function PrivacyScreen() {
  return (
    <Screen>
      <div className="pt-2 pb-3">
        <Button variant="ghost" icon={<ArrowLeft size={18} aria-hidden />} onClick={() => navigate('plus')}>
          {L('Retour', 'Back')}
        </Button>
      </div>
      <iframe
        title={L('Politique de confidentialité', 'Privacy policy')}
        src={`${import.meta.env.BASE_URL}privacy.html?embedded=1#${L('fr', 'en')}`}
        className="block h-[calc(100dvh-var(--top-bar)-160px-env(safe-area-inset-bottom))] min-h-[320px] w-full rounded-[12px] border border-line"
      />
    </Screen>
  )
}
