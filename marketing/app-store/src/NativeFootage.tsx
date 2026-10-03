import { Video } from "@remotion/media";
import { Series, staticFile } from "remotion";
import { Language } from "./campaign";

export type VideoTheme = "plan" | "workout" | "live";
export type VideoSegment = { start: number; duration: number; label?: string };
export type VideoProps = { lang: Language; theme: VideoTheme; segments?: VideoSegment[] };
export const videoThemes: VideoTheme[] = ["plan", "workout", "live"];
export const recording = ({ lang, theme }: VideoProps) => `recordings/iphone-preview-${theme}-${lang}.mp4`;

/** Chronological cuts of real footage, at normal speed. No recreated UI. */
export const NativeFootage = (props: VideoProps) => <Series>
  {(props.segments ?? [{ start: 0, duration: 20 }]).map((segment, index) =>
    <Series.Sequence key={index} durationInFrames={Math.round(segment.duration * 30)} name={segment.label}>
      <Video src={staticFile(recording(props))} trimBefore={Math.round(segment.start * 30)} muted objectFit="contain" style={{ width: "100%", height: "100%" }} />
    </Series.Sequence>
  )}
</Series>;
