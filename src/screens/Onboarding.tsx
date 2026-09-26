import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { parseBackup, type ParsedBackup } from '../lib/backup'
import { todayISO } from '../lib/date'
import { parseNumber } from '../lib/format'
import { ROTATION, TYPE_META } from '../lib/program'
import { SOURCES } from '../lib/research'
import { useStore } from '../lib/store'
import { Button, Card, Field, inputClass, Sheet, Tag } from '../components/ui'
import { ImportSheet } from './More'

export function Dial({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx="14" fill="#0B0B0E" />
      <circle cx="32" cy="32" r="17.4" fill="none" stroke="#EDEDEA" strokeWidth="6.2" />
      <path d="M32 14.6a17.4 17.4 0 0 1 15.07 26.1" fill="none" stroke="#FF7B00" strokeWidth="6.2" />
      <circle cx="32" cy="32" r="3.3" fill="#EDEDEA" />
    </svg>
  )
}

export function Onboarding() {
  const { importBackup, startFresh } = useStore.getState()
  const file = useRef<HTMLInputElement>(null)
  const [parsed, setParsed] = useState<ParsedBackup | null>(null)
  const [upgrade, setUpgrade] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const onFile = async (f: File | undefined) => {
    if (!f) return
    try {
      setParsed(parseBackup(await f.text()))
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }
  return (
    <main className="screen-in mx-auto flex min-h-dvh w-full max-w-[640px] flex-col px-5 safe-top safe-bottom">
      <div className="flex flex-1 flex-col justify-center py-10">
        <Dial />
        <h1 className="mt-8 text-[44px] leading-[1] font-semibold tracking-[-0.035em]">Golgoth</h1>
        <p className="mt-3 max-w-[440px] text-[18px] leading-[1.4] text-text-2">
          Ton programme d’hypertrophie fondé sur la recherche, jusqu’au 30 juin 2027.
        </p>
        <ul className="mt-8 space-y-3 text-[15px] leading-[1.45]">
          <li className="flex gap-3"><span className="font-semibold text-signal-text tnum">01</span>Séances guidées : séries, RIR, minuteur de repos, double progression.</li>
          <li className="flex gap-3"><span className="font-semibold text-signal-text tnum">02</span>Calendrier des blocs, décharges, sèche et reprises après pause.</li>
          <li className="flex gap-3"><span className="font-semibold text-signal-text tnum">03</span>Poids moyen sur 7 jours, 1RM estimé, séries par muscle.</li>
        </ul>
        <div className="mt-6 flex flex-wrap gap-2">
          {ROTATION.map((t) => <Tag key={t} tone="outline">{TYPE_META[t].label}</Tag>)}
        </div>
      </div>
      <div className="pb-6">
        <Button variant="primary" size="lg" full icon={<Upload size={18} aria-hidden />} onClick={() => file.current?.click()}>
          Importer ma sauvegarde
        </Button>
        <Button variant="ghost" size="lg" full className="mt-2" onClick={startFresh}>Commencer sans historique</Button>
        <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
        {error && <p className="mt-3 text-center text-[13px] text-bad">{error}</p>}
        <p className="mt-4 text-center text-[12px] leading-[1.5] text-muted">
          {Object.keys(SOURCES).length} publications citées · données stockées sur ce téléphone uniquement
        </p>
      </div>
      <ImportSheet parsed={parsed} upgrade={upgrade} setUpgrade={setUpgrade} onClose={() => setParsed(null)} onConfirm={() => void importBackup(parsed!, { upgrade })} />
    </main>
  )
}

/** After an import: what changed in the program, and today's weight to anchor the goal. */
export function ImportResultSheet() {
  const lastImport = useStore((s) => s.lastImport)
  const lastWeigh = useStore((s) => s.state.bodyEntries.filter((b) => b.weight !== null).at(-1))
  const saveBody = useStore((s) => s.saveBody)
  const [w, setW] = useState('')
  if (!lastImport) return null
  const close = () => useStore.setState({ lastImport: null })
  const added = lastImport.changes.filter((c) => c.kind === 'added')
  const removed = lastImport.changes.filter((c) => c.kind === 'removed')
  const stale = !lastWeigh || lastWeigh.date < todayISO()
  return (
    <Sheet
      open
      onClose={close}
      title="Import terminé"
      footer={
        <Button variant="primary" size="lg" full onClick={() => {
          const n = parseNumber(w)
          if (n) saveBody({ date: todayISO(), weight: n, waist: null, arm: null, chest: null, shoulders: null })
          close()
        }}>
          Continuer
        </Button>
      }
    >
      {lastImport.changes.length > 0 ? (
        <>
          <p className="text-[15px] leading-[1.5] text-text-2">Ton historique est intact et tes charges sont reprises. Le programme passe au split fondé sur la recherche.</p>
          <Card className="mt-4 divide-y divide-line">
            {ROTATION.map((t) => {
              const a = added.filter((c) => c.type === t)
              const r = removed.filter((c) => c.type === t)
              if (!a.length && !r.length) return null
              return (
                <div key={t} className="px-4 py-3 text-[13px] leading-[1.5]">
                  <p className="text-[14px] font-semibold">{TYPE_META[t].label}</p>
                  {a.length > 0 && <p className="text-good">+ {a.map((c) => c.name).join(', ')}</p>}
                  {r.length > 0 && <p className="text-muted line-through">{r.map((c) => c.name).join(', ')}</p>}
                </div>
              )
            })}
          </Card>
        </>
      ) : (
        <p className="text-[15px] text-text-2">Données importées.</p>
      )}
      {stale && (
        <Field label="Ton poids ce matin (kg)" hint="Il ancre la trajectoire et la cible du plan." className="mt-5">
          <input data-autofocus className={inputClass} inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} placeholder={lastWeigh?.weight ? String(lastWeigh.weight).replace('.', ',') : '—'} />
        </Field>
      )}
    </Sheet>
  )
}
