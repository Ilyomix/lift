import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Brand, palette, type } from "./Brand";
import { NativeFootage, VideoProps } from "./NativeFootage";

const captions = {
  fr: {
    plan: ["Chaque séance compte.", "Retrouve ton historique.", "Vois ta progression."],
    workout: ["Note ta série.", "Choisis ton effort.", "Le repos prend le relais."],
    live: ["Garde le fil.", "+30 s si besoin.", "Reprends au bon moment."],
  },
  en: {
    plan: ["Every workout counts.", "Find your training history.", "See your progress."],
    workout: ["Log your set.", "Choose your effort.", "Recovery takes over."],
    live: ["Stay on track.", "+30 seconds when needed.", "Get back to your next set."],
  },
};

// Genuine native footage sits below the caption; lock-screen crops can enlarge
// the real Live Activity on iPad without reconstructing any interface.
// Missing sources are errors, never substituted by screenshots or browser UI.
export const Preview = (props: VideoProps) => {
  const frame = useCurrentFrame();
  const englishPadLive = props.theme === "live" && props.device === "ipad" && props.lang === "en";
  const frenchPhoneLive = props.theme === "live" && props.device !== "ipad" && props.lang === "fr";
  const moments = englishPadLive ? [0, 240, 390] : props.theme === "live" ? [0, 180, 390] : [0, 240, 360];
  const lines = englishPadLive ? ["+30 seconds when needed.", "Skip when you’re ready.", "Get back to your next set."] : frenchPhoneLive ? ["Garde le fil.", "Passe quand tu es prêt.", "Reprends au bon moment."] : captions[props.lang][props.theme];
  const moment = frame >= moments[2] ? 2 : frame >= moments[1] ? 1 : 0;
  const localFrame = frame - moments[moment];
  const reveal = interpolate(localFrame, [0, 8], [0, 1], { extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ ...type, backgroundColor: palette.ink, color: palette.paper }}>
    <div style={{ position: "absolute", top: 25, left: 48 }}><Brand size={35} /></div>
    <div style={{ position: "absolute", left: 48, right: 42, top: 80, fontSize: props.device === "ipad" ? 62 : 53, fontWeight: 750, letterSpacing: -1.8, lineHeight: 1.08, opacity: reveal, transform: `translateY(${12 * (1 - reveal)}px)` }}>{lines[moment]}</div>
    <div style={{ position: "absolute", left: 48, right: 48, top: 185, height: 3, background: palette.blue }} />
    <div style={{ position: "absolute", inset: "205px 0 0" }}><NativeFootage {...props} /></div>
  </AbsoluteFill>;
};
