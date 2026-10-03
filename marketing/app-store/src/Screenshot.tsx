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
  const headlineSize = (props.lang === "en" && props.feature === "calendar" ? 99 : longest > 18 ? 99 : longest > 13 ? 114 : 146) * factor;
  const tilt = props.feature === "home" ? -3 : props.feature === "workout" ? 2 : props.feature === "exercise" ? -4 : 0;
  const width = ipad ? 1770 : props.feature === "home" ? 1010 : props.feature === "workout" ? 930 : (props.feature === "calendar" || props.feature === "backup" ? 1140 : 1070);
  const left = ipad ? 140 : props.feature === "workout" ? 215 : props.feature === "home" ? 128 : (1320 - width) / 2 - 12;
  const top = ipad ? 1080 : props.feature === "live" ? 856 : 755;
  return <AbsoluteFill style={{ ...type, color: ink, overflow: "hidden", background: theme === "blue" ? palette.blue : theme === "ice" ? palette.ice : palette.ink }}>
    <div style={{ position: "absolute", top: 78 * factor, left: 90 * factor }}><Brand size={74 * factor} dark={darkText} /></div>
    <div style={{ position: "absolute", left: 90 * factor, top: 248 * factor, right: 65 * factor }}>
      <h1 style={{ margin: 0, fontSize: headlineSize, lineHeight: 0.98, fontWeight: 850, letterSpacing: -headlineSize * 0.038 }}>
        {text.title[0]}<br /><span style={{ color: theme === "ink" ? "#719AFF" : ink }}>{text.title[1]}</span>
      </h1>
      <p style={{ margin: "38px 0 0", fontSize: 41 * factor, lineHeight: 1.35, fontWeight: 400, color: theme === "blue" ? "#EDF2FF" : darkText ? "#283348" : "#CBD5E8" }}>{text.body[0]}<br />{text.body[1]}</p>
    </div>
    {/* Native crop coordinates are remeasured on each delivered release source before QA. */}
    {ipad && props.feature === "home" ?
      <ScreenCrop src={asset(props)} device="ipad" x={360} y={55} cropWidth={1344} cropHeight={1603} width={1280} style={{ position: "absolute", left: 392, top: 1050, borderRadius: 42, boxShadow: "0 28px 65px #0005" }} />
    : ipad && props.feature === "workout" ? <>
      <ScreenCrop src={asset(props)} device="ipad" x={380} y={170} cropWidth={1304} cropHeight={1495} width={1240} style={{ position: "absolute", left: 412, top: 950, borderRadius: 42, boxShadow: "0 28px 65px #142A4622" }} />
      <ScreenCrop src={asset(props)} device="ipad" x={412} y={2405} cropWidth={1240} cropHeight={175} width={1320} style={{ position: "absolute", left: 372, top: 2400, borderRadius: 34 }} />
    </> : ipad && props.feature === "plan" ? <>
      <ScreenCrop src={asset(props)} device="ipad" x={430} y={props.lang === "en" ? 670 : 830} cropWidth={1204} cropHeight={365} width={1760} style={{ position: "absolute", left: 152, top: 1070, borderRadius: 42 }} />
      <ScreenCrop src={asset({ ...props, feature: "workout" })} device="ipad" x={430} y={555} cropWidth={1204} cropHeight={370} width={1760} style={{ position: "absolute", left: 152, top: 1800, borderRadius: 42 }} />
    </> : ipad && props.feature === "backup" ?
      <ScreenCrop src={asset(props)} device="ipad" x={380} y={145} cropWidth={1304} cropHeight={945} width={1760} style={{ position: "absolute", left: 152, top: 1130, borderRadius: 42, boxShadow: "0 28px 65px #0005" }} />
    : ipad && props.feature === "calendar" ?
      <ScreenCrop src={asset(props)} device="ipad" x={360} y={60} cropWidth={1344} cropHeight={props.lang === "en" ? 1700 : 1745} width={1240} style={{ position: "absolute", left: 412, top: 995, borderRadius: 42, boxShadow: "0 28px 65px #0005" }} />
    : ipad && props.feature === "progress" ? <>
      <ScreenCrop src={asset(props)} device="ipad" x={380} y={160} cropWidth={1304} cropHeight={770} width={1680} style={{ position: "absolute", left: 192, top: 970, borderRadius: 42, boxShadow: "0 28px 65px #142A4622" }} />
      <ScreenCrop src={asset(props)} device="ipad" x={380} y={1380} cropWidth={1304} cropHeight={420} width={1680} style={{ position: "absolute", left: 192, top: 2020, borderRadius: 42, boxShadow: "0 28px 65px #142A4622" }} />
    </> : ipad && props.feature === "exercise" ? <>
      <ScreenCrop src={asset(props)} device="ipad" x={392} y={220} cropWidth={1280} cropHeight={1340} width={1320} style={{ position: "absolute", left: 372, top: 890, borderRadius: 42, boxShadow: "0 28px 65px #0005" }} />
      <ScreenCrop src={asset(props)} device="ipad" x={392} y={1930} cropWidth={1280} cropHeight={260} width={1500} style={{ position: "absolute", left: 282, top: 2300, borderRadius: 42 }} />
    </>
    : ipad && props.feature === "gyms" ? <>
      <ProductScreen src={asset(props)} device="ipad" width={1100} style={{ position: "absolute", top: 870, left: 482 }} />
      <ScreenCrop src={asset(props)} device="ipad" x={360} y={1988} cropWidth={1344} cropHeight={764} width={1820} style={{ position: "absolute", left: 122, top: 1550, borderRadius: 44, boxShadow: "0 28px 65px #142A4644" }} />
    </> : ipad && props.feature === "live" ? <>
      <ProductScreen src={asset(props)} device="ipad" width={1100} style={{ position: "absolute", top: 870, left: 482 }} />
      <ScreenCrop src={asset(props)} device="ipad" x={532} y={2242} cropWidth={1000} cropHeight={314} width={1820} style={{ position: "absolute", left: 122, top: 1910, borderRadius: 96, boxShadow: "0 35px 80px #00114499" }} />
      <p style={{ position: "absolute", top: 2530, left: 122, right: 122, margin: 0, fontSize: 42, fontWeight: 650, textAlign: "center" }}>{props.lang === "fr" ? "AJOUTE 30 S. PASSE LE REPOS." : "ADD 30 SECONDS. SKIP REST."}</p>
    </> : ipad && props.feature === "timer" ? <>
      <ScreenCrop src={asset(props)} device="ipad" x={580} y={800} cropWidth={904} cropHeight={1010} width={1320} style={{ position: "absolute", left: 372, top: 870, borderRadius: 0 }} />
      <ScreenCrop src={asset(props)} device="ipad" x={0} y={2380} cropWidth={2064} cropHeight={320} width={1840} style={{ position: "absolute", left: 112, top: 2280, borderRadius: 38 }} />
    </> : !ipad && props.feature === "live" ? <>
      <ProductScreen src={asset(props)} device="iphone" width={740} style={{ position: "absolute", top: 890, left: 278 }} />
      <ScreenCrop src={asset(props)} x={44} y={1997} cropWidth={1232} cropHeight={463} width={1220} style={{ position: "absolute", left: 50, top: 1900, borderRadius: 74, boxShadow: "0 35px 80px #00114499" }} />
      <p style={{ position: "absolute", top: 2550, left: 90, right: 90, margin: 0, fontSize: 35, fontWeight: 650, textAlign: "center" }}>{props.lang === "fr" ? "AJOUTE 30 S. PASSE LE REPOS." : "ADD 30 SECONDS. SKIP REST."}</p>
    </> : !ipad && props.feature === "timer" ? <>
      <ScreenCrop src={asset(props)} x={0} y={590} cropWidth={1320} cropHeight={1440} width={1320} style={{ position: "absolute", left: 0, top: 800, borderRadius: 0 }} />
      <ScreenCrop src={asset(props)} x={0} y={props.proof ? 2405 : 2300} cropWidth={1320} cropHeight={props.proof ? 435 : 470} width={1140} style={{ position: "absolute", left: 90, top: 2340, borderRadius: 32 }} />
    </> : !ipad && props.feature === "progress" ? <>
      <ScreenCrop src={asset(props)} x={0} y={props.proof ? 190 : 300} cropWidth={1320} cropHeight={props.proof ? 1140 : 1200} width={1140} style={{ position: "absolute", left: 90, top: 805, borderRadius: 34, boxShadow: "0 24px 52px #142A4622" }} />
      {props.proof ? <ScreenCrop src={asset(props)} x={0} y={2005} cropWidth={1320} cropHeight={600} width={1140} style={{ position: "absolute", left: 90, top: 1970, borderRadius: 34 }} /> :
        <div style={{ position: "absolute", left: 90, top: 1970, width: 1140, borderRadius: 34, overflow: "hidden", boxShadow: "0 24px 52px #142A4622" }}>
          <ScreenCrop src={asset(props)} x={0} y={2160} cropWidth={1320} cropHeight={140} width={1140} style={{ borderRadius: 0 }} />
          <ScreenCrop src={`screenshots/${props.lang}/iphone-07-progress-history.png`} x={0} y={160} cropWidth={1320} cropHeight={540} width={1140} style={{ borderRadius: 0 }} />
        </div>}
    </> : !ipad && props.feature === "calendar" ?
      <ScreenCrop src={asset(props)} x={0} y={props.proof ? 580 : 170} cropWidth={1320} cropHeight={props.proof ? 1875 : props.lang === "en" ? 2150 : 2220} width={props.proof ? 1200 : 1120} style={{ position: "absolute", left: props.proof ? 60 : 100, top: 825, borderRadius: 35, boxShadow: "0 32px 70px #00114466" }} />
    : !ipad && props.feature === "exercise" ? <>
      <ScreenCrop src={asset(props)} x={0} y={225} cropWidth={1320} cropHeight={props.proof ? 2470 : 1560} width={1170} style={{ position: "absolute", left: 75, top: 790, borderRadius: 40 }} />
      {!props.proof && <ScreenCrop src={asset(props)} x={0} y={2350} cropWidth={1320} cropHeight={props.lang === "en" ? 390 : 430} width={1170} style={{ position: "absolute", left: 75, top: 2280, borderRadius: 36 }} />}
    </>
    : !ipad && props.feature === "gyms" ? <>
      <div style={{ position: "absolute", top: 870, left: 0, width: "100%", height: 1500, background: palette.blue }} />
      {props.proof ? <>
        <ScreenCrop src={asset(props)} x={42} y={1085} cropWidth={1236} cropHeight={510} width={1180} style={{ position: "absolute", left: 70, top: 970, borderRadius: 28 }} />
        <ScreenCrop src={asset(props)} x={42} y={645} cropWidth={1236} cropHeight={420} width={1100} style={{ position: "absolute", left: 110, top: 1740, borderRadius: 28 }} />
      </> : <>
        <ProductScreen src={asset(props)} device="iphone" width={740} style={{ position: "absolute", left: 290, top: 840, transform: "rotate(-3deg)" }} />
        <ScreenCrop src={asset(props)} x={0} y={1708} cropWidth={1320} cropHeight={1160} width={1180} style={{ position: "absolute", left: 70, top: 1620, borderRadius: 38, boxShadow: "0 28px 65px #142A4644" }} />
      </>}
    </> : !ipad && props.feature === "backup" ?
      <ScreenCrop src={asset(props)} x={0} y={185} cropWidth={1320} cropHeight={1610} width={1160} style={{ position: "absolute", left: 80, top: 990, borderRadius: 32, boxShadow: "0 38px 65px #00114466" }} />
    : !ipad && props.feature === "plan" ? <>
      <ScreenCrop src={asset(props)} x={0} y={props.proof ? 1280 : props.lang === "en" ? 1130 : 1320} cropWidth={1320} cropHeight={props.proof ? 700 : props.lang === "en" ? 635 : 695} width={1160} style={{ position: "absolute", left: 80, top: 855, borderRadius: 32 }} />
      <ScreenCrop src={asset({ ...props, feature: "workout" })} x={props.proof ? 0 : 70} y={props.proof ? 910 : 930} cropWidth={props.proof ? 1320 : 1180} cropHeight={props.proof ? 1050 : 550} width={1160} style={{ position: "absolute", left: 80, top: 1650, borderRadius: 32 }} />
    </> : <ProductScreen src={asset(props)} device={props.device} width={width} style={{ position: "absolute", top, left, transform: `rotate(${tilt}deg)`, transformOrigin: "50% 0" }} /> }
    <div style={{ position: "absolute", bottom: 0, height: 132, width: "100%", background: theme === "blue" ? palette.blue : theme === "ice" ? palette.ice : palette.ink }} />
    <div style={{ position: "absolute", bottom: 55, left: 90 * factor, right: 90 * factor, display: "flex", justifyContent: "space-between", fontSize: 22 * factor, fontWeight: 550 }}><span>{content[props.lang].footer}</span></div>
  </AbsoluteFill>;
};
