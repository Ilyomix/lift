import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { Brand, palette, type } from "./Brand";
import { content, Feature } from "./campaign";
import { NativeFootage, VideoProps } from "./NativeFootage";

const themeFeature: Record<VideoProps["theme"], Feature> = { plan: "progress", workout: "workout", live: "live" };
/** The same real, moving native footage, with a brief editorial opening/close. */
export const Promo = (props: VideoProps) => {
  const frame = useCurrentFrame();
  const text = content[props.lang][themeFeature[props.theme]];
  return <AbsoluteFill style={{ ...type, overflow: "hidden", backgroundColor: palette.ink }}>
    <NativeFootage {...props} />
    <div style={{ position: "absolute", boxSizing: "border-box", top: 0, left: 0, right: 0, height: 390, background: palette.blue, padding: "36px 66px", transform: `translateY(${interpolate(frame, [0, 45, 66], [0, 0, -395], { extrapolateRight: "clamp", easing: Easing.bezier(0.65, 0, 0.35, 1) })}px)` }}>
      <Brand size={48} />
      <h1 style={{ fontSize: 78, lineHeight: 1.03, fontWeight: 850, letterSpacing: -3, margin: "32px 0 0" }}>{text.title[0]}<br />{text.title[1]}</h1>
    </div>
    <div style={{ position: "absolute", boxSizing: "border-box", bottom: 0, left: 0, right: 0, height: 370, background: palette.blue, padding: "48px 66px", transform: `translateY(${interpolate(frame, [492, 522], [375, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) })}px)` }}>
      <Brand size={72} />
      <p style={{ marginTop: 32, fontSize: 35, lineHeight: 1.4 }}>{text.body[0]}<br />{text.body[1]}</p>
    </div>
  </AbsoluteFill>;
};
