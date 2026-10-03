import { AbsoluteFill } from "remotion";
import { NativeFootage, VideoProps } from "./NativeFootage";
// App Store preview: real native screen recording only. A missing source is a
// render error, never replaced with browser footage or a simulated interface.
export const Preview = (props: VideoProps) => <AbsoluteFill style={{ backgroundColor: "#060A13" }}>
  <NativeFootage {...props} />
</AbsoluteFill>;
