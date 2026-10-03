import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Brand, palette, type } from "./Brand";
import { NativeFootage, VideoProps } from "./NativeFootage";

const captions = {
  fr: {
    plan: ["Chaque séance compte.", "Retrouve ton historique.", "Vois ta progression."],
    workout: ["Comprends le geste.", "Note ta série.", "Le repos prend le relais."],
    live: ["Garde le fil.", "+30 s si besoin.", "Passe le repos.", "Reprends au bon moment."],
  },
  en: {
    plan: ["Every workout counts.", "Find your training history.", "See your progress."],
    workout: ["See how it moves.", "Log your set.", "Recovery takes over."],
    live: ["Stay on track.", "+30 seconds when needed.", "Skip the rest.", "Get back to your next set."],
  },
};

// Genuine native footage sits below the caption; lock-screen crops can enlarge
// the real Live Activity on iPad without reconstructing any interface.
// Missing sources are errors, never substituted by screenshots or browser UI.
export const Preview = (props: VideoProps) => {
  const frame = useCurrentFrame();
  const moments = props.theme === "live" ? [0, 180, 300, 420] : [0, 240, 360];
  const lines = captions[props.lang][props.theme];
  const moment = moments.reduce((current, start, index) => frame >= start ? index : current, 0);
  const localFrame = frame - moments[moment];
  const reveal = interpolate(localFrame, [0, 8], [0, 1], { extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ ...type, backgroundColor: palette.ink, color: palette.paper }}>
    <div style={{ position: "absolute", top: 25, left: 48 }}><Brand size={35} /></div>
    <div style={{ position: "absolute", left: 48, right: 42, top: 80, fontSize: props.device === "ipad" ? 62 : 53, fontWeight: 750, letterSpacing: -1.8, lineHeight: 1.08, opacity: reveal, transform: `translateY(${12 * (1 - reveal)}px)` }}>{lines[moment]}</div>
    <div style={{ position: "absolute", left: 48, right: 48, top: 185, height: 3, background: palette.blue }} />
    <div style={{ position: "absolute", inset: "205px 0 0" }}><NativeFootage {...props} /></div>
  </AbsoluteFill>;
};
