import { loadFont } from "@remotion/fonts";
import { AbsoluteFill, CanvasImage, staticFile } from "remotion";
import type { CSSProperties } from "react";

loadFont({ family: "Geologica", url: staticFile("brand/geologica.woff2"), weight: "100 900" });
export const palette = { ink: "#060A13", paper: "#F1F5FF", blue: "#2E62F5", muted: "#A6B6D2", ice: "#E9EEF8" };
export const type: CSSProperties = { fontFamily: "Geologica, sans-serif", color: palette.paper };
export const Background = ({ bright = false }: { bright?: boolean }) => <AbsoluteFill style={{ background: bright ? palette.blue : palette.ink }} />;
export const Brand = ({ size = 78, dark = false }: { size?: number; dark?: boolean }) => <div style={{ display: "flex", alignItems: "center", gap: size * 0.26 }}>
  <CanvasImage src={staticFile("brand/icon.png")} style={{ width: size, height: size, borderRadius: size * 0.24 }} />
  <span style={{ ...type, color: dark ? palette.ink : palette.paper, fontSize: size * 0.66, fontWeight: 700, letterSpacing: -size * 0.02 }}>Lift</span>
</div>;
export const ProductScreen = ({ src, width, device = "iphone", style }: { src: string; width: number; device?: "iphone" | "ipad"; style?: CSSProperties }) => {
  const radius = device === "iphone" ? width * 0.072 : width * 0.035;
  return <div style={{ boxSizing: "content-box", width, padding: device === "iphone" ? 12 : 18, background: "#111824", borderRadius: radius + 12, boxShadow: "0 38px 78px #0007", ...style }}>
    <CanvasImage src={staticFile(src)} style={{ display: "block", width: "100%", height: width * (device === "iphone" ? 2868 / 1320 : 2752 / 2064), borderRadius: radius, objectFit: "contain" }} />
  </div>;
};
/** Faithful crop of a native screenshot: source pixels only, no reconstructed UI. */
export const ScreenCrop = ({ src, x, y, cropWidth, cropHeight, width, device = "iphone", style }: { src: string; x: number; y: number; cropWidth: number; cropHeight: number; width: number; device?: "iphone" | "ipad"; style?: CSSProperties }) => {
  const sourceWidth = device === "ipad" ? 2064 : 1320;
  const sourceHeight = device === "ipad" ? 2752 : 2868;
  if (![x, y, cropWidth, cropHeight, width].every(Number.isFinite) || x < 0 || y < 0 || cropWidth <= 0 || cropHeight <= 0 || width <= 0 || x + cropWidth > sourceWidth || y + cropHeight > sourceHeight) {
    throw new Error(`Crop outside native ${device} source: ${src}`);
  }
  const scale = width / cropWidth;
  return <div style={{ position: "relative", overflow: "hidden", width, height: cropHeight * scale, borderRadius: 36, ...style }}>
    <CanvasImage src={staticFile(src)} style={{ position: "absolute", left: -x * scale, top: -y * scale, width: (device === "ipad" ? 2064 : 1320) * scale, height: (device === "ipad" ? 2752 : 2868) * scale }} />
  </div>;
};
