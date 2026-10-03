import { Video } from "@remotion/media";
import { Series, staticFile } from "remotion";
import { Device, Language } from "./campaign";

export type VideoTheme = "plan" | "workout" | "live";
export type VideoSegment = { start: number; duration: number; label?: string; source?: string; focus?: "live" };
export type VideoProps = { lang: Language; theme: VideoTheme; device?: Device; segments?: VideoSegment[] };
export const videoThemes: VideoTheme[] = ["plan", "workout", "live"];
export const recording = ({ lang, theme, device = "iphone" }: VideoProps) => `recordings/${device}-preview-${theme}-${lang}.mp4`;

/** Chronological cuts of real footage, at normal speed. No recreated UI. */
export const NativeFootage = (props: VideoProps) => <Series>
  {(props.segments ?? [{ start: 0, duration: 20 }]).map((segment, index) =>
    <Series.Sequence key={index} durationInFrames={Math.round(segment.duration * 30)} name={segment.label}>
      <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        <Video src={staticFile(segment.source ? `recordings/${segment.source}` : recording(props))} trimBefore={Math.round(segment.start * 30)} muted objectFit="contain" style={{ width: "100%", height: "100%", transform: props.device === "ipad" && segment.focus === "live" ? "scale(2)" : undefined, transformOrigin: "50% 100%" }} />
      </div>
    </Series.Sequence>
  )}
</Series>;
