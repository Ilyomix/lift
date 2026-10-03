import { AbsoluteFill } from "remotion";
import { Brand, palette, ProductScreen, ScreenCrop, type } from "./Brand";
import { asset, CampaignProps, content, themes } from "./campaign";

export const Screenshot = (props: CampaignProps) => {
  const ipad = props.device === "ipad";
  const text = content[props.lang][props.feature];
  const theme = themes[props.feature];
  const darkText = theme === "ice";
  const ink = darkText ? palette.ink : palette.paper;
  const factor = ipad ? 1.36 : 1;
  const longest = Math.max(...text.title.map(line => line.length));
  const headlineSize = (longest > 18 ? 99 : longest > 13 ? 114 : 146) * factor;
  const tilt = props.feature === "home" ? -5 : props.feature === "workout" ? 3 : props.feature === "exercise" ? -4 : 0;
  const width = ipad ? 1770 : (props.feature === "calendar" || props.feature === "backup" ? 1140 : 1070);
  const left = ipad ? 140 : props.feature === "workout" ? 105 : props.feature === "home" ? 184 : (1320 - width) / 2 - 12;
  const top = ipad ? 810 : props.feature === "workout" ? 884 : props.feature === "live" ? 856 : 755;
  return <AbsoluteFill style={{ ...type, color: ink, overflow: "hidden", background: theme === "blue" ? palette.blue : theme === "ice" ? palette.ice : palette.ink }}>
    <div style={{ position: "absolute", top: 78 * factor, left: 90 * factor }}><Brand size={74 * factor} dark={darkText} /></div>
    <div style={{ position: "absolute", left: 90 * factor, top: 248 * factor, right: 65 * factor }}>
      <h1 style={{ margin: 0, fontSize: headlineSize, lineHeight: 0.98, fontWeight: 850, letterSpacing: -headlineSize * 0.038 }}>
        {text.title[0]}<br /><span style={{ color: theme === "ink" ? "#719AFF" : ink }}>{text.title[1]}</span>
      </h1>
      <p style={{ margin: "38px 0 0", fontSize: 41 * factor, lineHeight: 1.35, fontWeight: 400, color: theme === "blue" ? "#EDF2FF" : darkText ? "#283348" : "#CBD5E8" }}>{text.body[0]}<br />{text.body[1]}</p>
    </div>
    {!ipad && props.feature === "timer" ? <>
      <ScreenCrop src={asset(props)} x={0} y={590} cropWidth={1320} cropHeight={1440} width={1320} style={{ position: "absolute", left: 0, top: 800, borderRadius: 0 }} />
      <ScreenCrop src={asset(props)} x={54} y={2450} cropWidth={1215} cropHeight={350} width={1140} style={{ position: "absolute", left: 90, top: 2340, borderRadius: 32 }} />
    </> : !ipad && props.feature === "progress" ? <>
      <ScreenCrop src={asset(props)} x={42} y={210} cropWidth={1236} cropHeight={1100} width={1140} style={{ position: "absolute", left: 90, top: 805, borderRadius: 34, boxShadow: "0 24px 52px #142A4622" }} />
      <ScreenCrop src={asset(props)} x={42} y={2040} cropWidth={1236} cropHeight={555} width={1140} style={{ position: "absolute", left: 90, top: 1970, borderRadius: 34, boxShadow: "0 24px 52px #142A4622" }} />
    </> : !ipad && props.feature === "calendar" ?
      <ScreenCrop src={asset(props)} x={30} y={610} cropWidth={1260} cropHeight={1835} width={1200} style={{ position: "absolute", left: 60, top: 860, borderRadius: 35, boxShadow: "0 32px 70px #00114466" }} />
    : !ipad && props.feature === "exercise" ?
      <ScreenCrop src={asset(props)} x={0} y={225} cropWidth={1320} cropHeight={2470} width={1170} style={{ position: "absolute", left: 75, top: 740, borderRadius: 40 }} />
    : !ipad && props.feature === "gyms" ? <>
      <div style={{ position: "absolute", top: 870, left: 0, width: "100%", height: 1500, background: palette.blue }} />
      <ScreenCrop src={asset(props)} x={42} y={1085} cropWidth={1236} cropHeight={510} width={1180} style={{ position: "absolute", left: 70, top: 970, borderRadius: 28 }} />
      <ScreenCrop src={asset(props)} x={42} y={645} cropWidth={1236} cropHeight={420} width={1100} style={{ position: "absolute", left: 110, top: 1740, borderRadius: 28 }} />
    </> : !ipad && props.feature === "backup" ?
      <ScreenCrop src={asset(props)} x={42} y={200} cropWidth={1236} cropHeight={1565} width={1160} style={{ position: "absolute", left: 80, top: 990, borderRadius: 32, boxShadow: "0 38px 65px #00114466" }} />
    : !ipad && props.feature === "plan" ? <>
      <ScreenCrop src={asset(props)} x={42} y={1280} cropWidth={1236} cropHeight={700} width={1160} style={{ position: "absolute", left: 80, top: 855, borderRadius: 32 }} />
      <ScreenCrop src={asset({ ...props, feature: "workout" })} x={45} y={945} cropWidth={1230} cropHeight={1000} width={1060} style={{ position: "absolute", left: 130, top: 1690, borderRadius: 32 }} />
    </> : <ProductScreen src={asset(props)} device={props.device} width={width} style={{ position: "absolute", top, left, transform: `rotate(${tilt}deg)`, transformOrigin: "50% 0" }} /> }
    <div style={{ position: "absolute", bottom: 0, height: 132, width: "100%", background: theme === "blue" ? palette.blue : theme === "ice" ? palette.ice : palette.ink }} />
    <div style={{ position: "absolute", bottom: 55, left: 90 * factor, right: 90 * factor, display: "flex", justifyContent: "space-between", fontSize: 22 * factor, fontWeight: 550 }}><span>{content[props.lang].footer}</span></div>
  </AbsoluteFill>;
};
