import { Composition, Folder, Still } from "remotion";
import { Screenshot } from "./Screenshot";
import { Promo } from "./Promo";
import { TimerDirectionProof, DirectionBoard, ProofCollection } from "./DirectionProof";
import { Preview } from "./Preview";
import { videoThemes } from "./NativeFootage";
import { features, Language } from "./campaign";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Still id="Direction-Board" component={DirectionBoard} width={1980} height={1580} />
      <Still id="Direction-Timer" component={TimerDirectionProof} width={1320} height={2868} />
      {(["fr", "en"] as Language[]).map(lang => <Folder key={lang} name={lang.toUpperCase()}>
        <Still id={`Proof-Collection-${lang}`} component={ProofCollection} width={1980} height={4250} defaultProps={{ lang }} />
        {features.filter(feature => feature !== "live").map(feature => <Still key={`proof-${feature}`} id={`Proof-${lang}-${feature}`} component={Screenshot} width={1320} height={2868} defaultProps={{ lang, device: "iphone" as const, feature, proof: true }} />)}
        <Folder name="iPhone">{features.map(feature => <Still key={feature} id={`Screenshot-${lang}-iphone-${feature}`} component={Screenshot} width={1320} height={2868} defaultProps={{ lang, device: "iphone" as const, feature }} />)}</Folder>
        <Folder name="iPad">{features.map(feature => <Still key={feature} id={`Screenshot-${lang}-ipad-${feature}`} component={Screenshot} width={2064} height={2752} defaultProps={{ lang, device: "ipad" as const, feature }} />)}</Folder>
        {videoThemes.map(theme => <Composition key={`promo-${theme}`} id={`Promo-${lang}-${theme}`} component={Promo} width={1080} height={1920} fps={30} durationInFrames={600} defaultProps={{ lang, theme }} />)}
        {videoThemes.map(theme => <Composition key={`preview-${theme}`} id={`Preview-${lang}-${theme}`} component={Preview} width={886} height={1920} fps={30} durationInFrames={600} defaultProps={{ lang, theme }} />)}
        {videoThemes.map(theme => <Composition key={`preview-ipad-${theme}`} id={`Preview-${lang}-ipad-${theme}`} component={Preview} width={1200} height={1600} fps={30} durationInFrames={600} defaultProps={{ lang, theme, device: "ipad" as const }} />)}
      </Folder>)}
    </>
  );
};
