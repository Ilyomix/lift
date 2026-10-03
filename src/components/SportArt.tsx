import dumbbell from '../assets/sport/dumbbell.webp'
import plate from '../assets/sport/plate.webp'
import stopwatch from '../assets/sport/stopwatch.webp'
import { cx } from './ui'

const artwork = { dumbbell, plate, stopwatch }

/** Decorative equipment: labels and controls remain the source of information. */
export function SportArt({ kind, className }: { kind: keyof typeof artwork; className?: string }) {
  return <img src={artwork[kind]} alt="" aria-hidden draggable={false} width={384} height={384} className={cx('pointer-events-none block aspect-square shrink-0 select-none object-contain', className)} />
}
