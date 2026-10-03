import { AbsoluteFill } from "remotion";
import { Brand, palette, ScreenCrop, type } from "./Brand";
import { Screenshot } from "./Screenshot";

/** Layout proof from an actual browser capture; native capture replaces it for delivery. */
export const TimerDirectionProof = () => <AbsoluteFill style={{ ...type, background: palette.ink, overflow: "hidden" }}>
  <div style={{ position: "absolute", top: 78, left: 90 }}><Brand size={74} /></div>
  <h1 style={{ position: "absolute", top: 265, left: 90, margin: 0, fontSize: 151, lineHeight: 0.98, fontWeight: 850, letterSpacing: -5.7 }}>SOUFFLE.<br /><span style={{ color: "#719AFF", fontSize: 105 }}>ON GARDE LE TEMPS.</span></h1>
  <p style={{ position: "absolute", top: 628, left: 94, fontSize: 42, lineHeight: 1.35, color: "#C9D4E7" }}>Lance le chrono. Ajuste. Repars.</p>
  <ScreenCrop src="proofs/fr/iphone-04-timer-fr.jpg" x={0} y={590} cropWidth={1320} cropHeight={1440} width={1320} style={{ position: "absolute", left: 0, top: 780, borderRadius: 0 }} />
  <ScreenCrop src="proofs/fr/iphone-04-timer-fr.jpg" x={54} y={2450} cropWidth={1215} cropHeight={350} width={1140} style={{ position: "absolute", left: 90, top: 2320, borderRadius: 32 }} />
  <div style={{ position: "absolute", bottom: 55, left: 90, right: 90, display: "flex", justifyContent: "space-between", fontSize: 22, color: "#A6B6D2" }}><span>MUSCULATION · SANS COMPTE</span></div>
</AbsoluteFill>;
export const DirectionBoard = () => <AbsoluteFill style={{ ...type, background: "#CBD5E5", padding: 60 }}>
  <div style={{ color: palette.ink, fontSize: 56, fontWeight: 800, letterSpacing: -2 }}>Lift. Plus de présence. Plus de mouvement.</div>
  <p style={{ color: "#3D4B62", fontSize: 26, marginTop: 20 }}>Trois compositions · vrais écrans de l’app web · données fictives importées · captures natives à venir</p>
  <div style={{ position: "absolute", left: 60, top: 215, width: 600, height: 1304, overflow: "hidden" }}><div style={{ position: "absolute", width: 1320, height: 2868, scale: 600 / 1320, transformOrigin: "0 0" }}><Screenshot lang="fr" device="iphone" feature="home" proof /></div></div>
  <div style={{ position: "absolute", left: 690, top: 215, width: 600, height: 1304, overflow: "hidden" }}><div style={{ position: "absolute", width: 1320, height: 2868, scale: 600 / 1320, transformOrigin: "0 0" }}><Screenshot lang="fr" device="iphone" feature="workout" proof /></div></div>
  <div style={{ position: "absolute", left: 1320, top: 215, width: 600, height: 1304, overflow: "hidden" }}><div style={{ position: "absolute", width: 1320, height: 2868, scale: 600 / 1320, transformOrigin: "0 0" }}><TimerDirectionProof /></div></div>
</AbsoluteFill>;

export const ProofCollection = ({ lang }: { lang: "fr" | "en" }) => {
  const cards = ["home", "workout", "progress", "timer", "calendar", "plan", "exercise", "gyms", "backup"] as const;
  return <AbsoluteFill style={{ ...type, background: "#CBD5E5", padding: 60 }}>
    <div style={{ color: palette.ink, fontSize: 56, fontWeight: 800, letterSpacing: -2 }}>Lift · {lang.toUpperCase()} · Campagne en cours</div>
    <p style={{ color: "#3D4B62", fontSize: 26, marginTop: 20 }}>Preuves web · données de démonstration · sources natives et Live Activities à venir</p>
    {cards.map((feature, index) => <div key={feature} style={{ position: "absolute", left: 60 + index % 3 * 630, top: 215 + Math.floor(index / 3) * 1335, width: 600, height: 1304, overflow: "hidden" }}><div style={{ position: "absolute", width: 1320, height: 2868, scale: 600 / 1320, transformOrigin: "0 0" }}><Screenshot lang={lang} device="iphone" feature={feature} proof /></div></div>)}
  </AbsoluteFill>;
};
