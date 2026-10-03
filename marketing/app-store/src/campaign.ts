export type Language = "fr" | "en";
export type Device = "iphone" | "ipad";
export type Feature = "home" | "workout" | "plan" | "calendar" | "progress" | "timer" | "live" | "exercise" | "gyms" | "backup";
export type CampaignProps = { lang: Language; device: Device; feature: Feature; proof?: boolean };
export const screens: Record<Feature, string> = { home: "01-home", workout: "02-workout", live: "03-live-activity", timer: "04-timer", plan: "05-plan", calendar: "06-calendar", progress: "07-progress", exercise: "08-exercise", gyms: "09-gyms", backup: "10-backup" };
export const features: Feature[] = ["home", "workout", "progress", "timer", "live", "calendar", "plan", "exercise", "gyms", "backup"];
export const themes: Record<Feature, "blue" | "ice" | "ink"> = { home: "blue", workout: "ice", plan: "ink", calendar: "blue", progress: "ice", timer: "ink", live: "blue", exercise: "ink", gyms: "ice", backup: "blue" };
export const content = {
  fr: {
    home: { title: ["ENTRAÎNE-TOI.", "LIFT TE GUIDE."], body: ["Un programme construit autour", "de tes jours et de ton matériel."] },
    workout: { title: ["TES CHARGES", "S’AJUSTENT."], body: ["Des ajustements selon tes performances.", "Tu gardes la main sur tes séries."] },
    plan: { title: ["L’EFFORT.", "BIEN DOSÉ."], body: ["Des repères d’effort à chaque étape.", "Tu sais ce que vise ta série."] },
    calendar: { title: ["FAIS DE LA PLACE", "À TES SÉANCES."], body: ["Ta semaine, déjà organisée.", "Ton historique, toujours visible."] },
    progress: { title: ["TES PROGRÈS,", "NOIR SUR BLANC."], body: ["Retrouve tes séries précédentes.", "Observe ton parcours, séance après séance."] },
    timer: { title: ["SOUFFLE.", "ON GARDE LE TEMPS."], body: ["Lance le chrono. Ajuste. Repars.", "Ton prochain effort reste en vue."] },
    live: { title: ["GARDE LE FIL.", "ÉCRAN VERROUILLÉ."], body: ["Le repos et la prochaine série", "directement sur ton écran verrouillé."] },
    exercise: { title: ["LE GESTE CLAIR.", "SÉRIE APRÈS SÉRIE."], body: ["Visualise le mouvement en 3D.", "Repère les muscles sollicités."] },
    gyms: { title: ["TA SALLE CHANGE.", "PAS TON SUIVI."], body: ["Tes charges et ton historique", "gardent leurs repères par salle."] },
    backup: { title: ["TES DONNÉES.", "CHEZ TOI."], body: ["Sans compte. Stockées sur ton appareil.", "Une sauvegarde à exporter quand tu veux."] },
    footer: "MUSCULATION · SANS COMPTE",
  },
  en: {
    home: { title: ["YOU TRAIN.", "LIFT GUIDES."], body: ["A program shaped around", "your days and your equipment."] },
    workout: { title: ["YOUR WEIGHTS.", "READY TO ADAPT."], body: ["Adjustments based on your performance.", "You stay in control of your sets."] },
    plan: { title: ["YOUR EFFORT.", "IN FOCUS."], body: ["Clear effort targets at every stage.", "Know what each set is aiming for."] },
    calendar: { title: ["MAKE ROOM", "FOR YOUR WORKOUTS."], body: ["Your week, already organized.", "Your history, always in view."] },
    progress: { title: ["YOUR PROGRESS.", "IN BLACK & WHITE."], body: ["Find your previous sets.", "Follow your training, session by session."] },
    timer: { title: ["TAKE A BREATH.", "WE’LL KEEP TIME."], body: ["Start the timer. Adjust it. Go again.", "Keep your next set in sight."] },
    live: { title: ["STAY ON TRACK.", "SCREEN LOCKED."], body: ["Rest and your next set,", "right on your lock screen."] },
    exercise: { title: ["KNOW THE MOVE.", "OWN THE SET."], body: ["See the movement in 3D.", "Find the muscles at work."] },
    gyms: { title: ["NEW GYM.", "SAME MOMENTUM."], body: ["Your weights and history", "stay organized by gym."] },
    backup: { title: ["YOUR DATA.", "ON YOUR DEVICE."], body: ["No account. Stored on your device.", "Export a backup whenever you want."] },
    footer: "STRENGTH TRAINING · NO ACCOUNT",
  },
};
export const asset = ({ lang, device, feature, proof }: CampaignProps) => proof ? `proofs/${lang}/${device}-${screens[feature]}-${lang}.jpg` : `screenshots/${lang}/${device}-${screens[feature]}.png`;
