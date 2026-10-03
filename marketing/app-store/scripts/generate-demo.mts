/** Fictional, deterministic marketing fixture. Never imported by the shipping app. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { makeBackup, parseBackup } from '../../../src/lib/backup.ts';
import { stateFromOnboarding } from '../../../src/lib/onboarding.ts';
import { setLang } from '../../../src/lib/i18n.ts';
import { localizeState } from '../../../src/lib/localize.ts';
import { configurePlan, contextAt, incrementFor, prescribeSession, sessionPlan } from '../../../src/lib/program.ts';
import { finishedState } from '../../../src/lib/training.ts';
import type { AppState, ActiveWorkout, WorkoutExercise } from '../../../src/lib/types.ts';

const asOf = '2026-10-03';
const dates = ['2026-09-14', '2026-09-16', '2026-09-19', '2026-09-21', '2026-09-23', '2026-09-26', '2026-09-28', '2026-09-30'];
const output = fileURLToPath(new URL('../../../.local-release/demo/', import.meta.url));
const loads: Record<string, number> = {
  'chest-press': 40, 'lat-pulldown': 40, 'incline-db-press': 16, 'low-cable-row': 35,
  'lateral-raise': 6, 'triceps-overhead-rope': 15, 'ez-curl': 20,
  'leg-press': 100, 'leg-curl': 30, 'hip-thrust': 50, 'leg-extension': 35, 'calf-press': 60,
  'shoulder-press-machine': 25, 'pec-deck': 30, 'cable-lateral-raise': 5,
  'reverse-pec-deck': 25, 'triceps-rope': 20, 'standing-calf-raise': 40,
  'chest-supported-row': 30, 'cable-pullover': 20, 'preacher-curl': 15,
  'hack-squat': 50, 'romanian-deadlift': 50,
};

await mkdir(output, { recursive: true });
for (const lang of ['fr', 'en'] as const) {
  setLang(lang);
  let state: AppState = stateFromOnboarding({ lang, setup: { place: 'gym', equipment: [] }, days: [1, 3, 6], sex: 'm', age: 30, heightCm: 180, weight: 80, waist: null, look: 'athletique', zones: [], maintenance: true, goalDate: '2027-06-30' }, dates[0]);
  state.prefs = { ...state.prefs, lang, theme: 'dark', accent: 'blue', liveActivity: true, notifications: true, sound: false };
  state.meta = { createdAt: `${dates[0]}T08:00:00.000Z`, importedAt: null, lastBackupAt: `${asOf}T06:00:00.000Z` };
  state.visualGoal = null;
  state.bodyEntries = dates.map((date, i) => ({ id: `demo-body-${i}`, date, weight: [80, 80.1, 79.9, 80, 80.2, 80.1, 80, 80.1][i], waist: null, arm: null, chest: null, shoulders: null }));
  for (const template of Object.values(state.templates)) {
    template.configured = true;
    for (const exercise of template.exercises) exercise.target.weight = exercise.unit === 'PDC' ? null : loads[exercise.exerciseId] ?? 20;
  }
  configurePlan(state.settings.goalDate, null, undefined, null, { start: state.settings.programStart, foundation: null, maintenance: true, days: 3, keepVolume: true });
  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    const type = state.nextWorkoutType;
    // A small fictional load increase on the second visit, as a user can log manually.
    if (i >= 5) state = { ...state, templates: { ...state.templates, [type]: { ...state.templates[type], exercises: state.templates[type].exercises.map((ex, index) => index === 0 && ex.target.weight !== null ? { ...ex, target: { ...ex.target, weight: ex.target.weight + incrementFor(ex) } } : ex) } } };
    const template = state.templates[type];
    const prescriptions = prescribeSession(template.exercises, date, null, state.gymId, state.workouts);
    const context = contextAt(date);
    const exercises: WorkoutExercise[] = template.exercises.map((exercise, e) => {
      const prescription = prescriptions[e];
      // Later visits add at most one clean rep. No unrealistic transformation claim.
      const reps = Math.min(prescription.maxReps, prescription.minReps + 1 + (i >= 5 ? 1 : 0));
      const weight = exercise.unit === 'PDC' ? null : exercise.target.weight;
      return { ...exercise, prescription: { ...prescription, weight }, sets: Array.from({ length: prescription.sets }, (_, s) => ({ weight, reps: Math.max(prescription.minReps, reps - (s >= 2 ? 1 : 0)), cleanReps: Math.max(prescription.minReps, reps - (s >= 2 ? 1 : 0)), completed: true, flags: [], note: '', rir: i < 3 ? 3 : 2 })), notes: '', skipped: false, validated: true, comparison: null };
    });
    const active: ActiveWorkout = { id: `demo-workout-${i + 1}`, type, date, startedAt: `${date}T16:00:00.000Z`, notes: '', timerEndAt: null, timer: null, exercises, periodId: context.period?.id, week: context.week, deload: context.deload, reentry: null, gymId: state.gymId };
    const finished = finishedState({ ...state, activeWorkout: active }, `${date}T17:08:00.000Z`, date);
    assert(finished);
    state = finished.state;
  }
  state = localizeState(state);
  const backup = makeBackup(state, []);
  backup.exportedAt = `${asOf}T06:00:00.000Z`;
  const json = JSON.stringify(backup, null, 2) + '\n';
  const parsed = parseBackup(json);
  assert.equal(parsed.legacy, false);
  assert.equal(parsed.state.workouts.length, 8);
  assert.equal(parsed.state.completedSessions, 8);
  assert.equal(parsed.state.activeWorkout, null);
  assert.equal(parsed.state.prefs.lang, lang);
  assert.equal(parsed.photos.length, 0);
  assert.deepEqual(parsed.state.workouts.map(w => w.date), dates);
  const plan = sessionPlan(parsed.state, asOf);
  assert.equal(plan.done, 8);
  await writeFile(`${output}/lift-demo-${lang}.json`, json);
  console.log(`${lang}: ${plan.done}/${plan.total} sessions; ${parsed.summary.bodyEntries} measurements; next ${parsed.state.nextWorkoutType}. ${output}/lift-demo-${lang}.json`);
}
