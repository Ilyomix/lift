// Evidence base of the program. Every entry below was checked in the research
// report (26 Sept 2026), except those marked `added`: publications checked since,
// for a rule the report does not cover. Studies that could not be verified are not cited.
// Texts are getters (L(fr, en)): they follow the language when they are read.
import { L } from './i18n'

export type EvidenceLevel = 'fort' | 'modere' | 'faible' | 'opinion'

export const LEVEL_LABEL: Record<EvidenceLevel, string> = {
  get fort() { return L('Preuve forte', 'Strong evidence') },
  get modere() { return L('Preuve modérée', 'Moderate evidence') },
  get faible() { return L('Preuve faible', 'Weak evidence') },
  get opinion() { return L("Opinion d'experts", 'Expert opinion') },
}

export interface Source {
  authors: string
  year: string
  title: string
  journal: string
  kind: string
  url: string
  id: string
  /** Checked after the research report, for a rule it does not cover. */
  added?: boolean
  /** General guidance, not a study: counted apart from the publications. */
  guidance?: boolean
}

const doi = (d: string) => `https://doi.org/${d}`

export const SOURCES: Record<string, Source> = {
  pelland2025: {
    authors: 'Pelland, Remmert, Robinson, Hinson, Zourdos',
    year: '2025',
    title: 'The Resistance Training Dose Response: Meta-Regressions Exploring the Effects of Weekly Volume and Frequency on Muscle Hypertrophy and Strength Gains',
    get journal() { return L('Sports Medicine 56(2):481–505 (en ligne déc. 2025)', 'Sports Medicine 56(2):481–505 (online Dec 2025)') },
    get kind() { return L('Méta-régressions · 67 études', 'Meta-regressions · 67 studies') },
    url: doi('10.1007/s40279-025-02344-w'),
    id: 'DOI 10.1007/s40279-025-02344-w · PMID 41343037',
  },
  schoenfeld2016: {
    authors: 'Schoenfeld, Ogborn, Krieger',
    year: '2016',
    title: 'Effects of Resistance Training Frequency on Measures of Muscle Hypertrophy',
    journal: 'Sports Medicine 46(11):1689–1697',
    get kind() { return L('Méta-analyse · 10 études', 'Meta-analysis · 10 studies') },
    url: doi('10.1007/s40279-016-0543-8'),
    id: 'DOI 10.1007/s40279-016-0543-8 · PMID 27102172',
  },
  schoenfeld2019: {
    authors: 'Schoenfeld, Grgic, Krieger',
    year: '2019',
    title: 'How many times per week should a muscle be trained to maximize muscle hypertrophy?',
    journal: 'Journal of Sports Sciences 37(11):1286–1295',
    get kind() { return L('Méta-analyse · 25 études', 'Meta-analysis · 25 studies') },
    url: 'https://pubmed.ncbi.nlm.nih.gov/?term=How+many+times+per+week+should+a+muscle+be+trained+to+maximize+muscle+hypertrophy',
    get id() { return L('Recherche PubMed par titre', 'PubMed search by title') },
  },
  ralston2018: {
    authors: 'Ralston, Kilgore, Wyatt, Buchan, Baker',
    year: '2018',
    title: 'Weekly Training Frequency Effects on Strength Gain',
    journal: 'Sports Medicine – Open 4:36',
    get kind() { return L('Méta-analyse · 12 études', 'Meta-analysis · 12 studies') },
    url: doi('10.1186/s40798-018-0149-9'),
    id: 'DOI 10.1186/s40798-018-0149-9 · PMID 30076500',
  },
  ramosCampo2024: {
    authors: 'Ramos-Campo, Benito-Peinado, Andreu-Caravaca, Rojo-Tirado, Rubio-Arias',
    year: '2024',
    title: 'Efficacy of Split Versus Full-Body Resistance Training on Strength and Muscle Growth',
    journal: 'Journal of Strength and Conditioning Research 38(7):1330–1340',
    get kind() { return L('Méta-analyse · 14 études', 'Meta-analysis · 14 studies') },
    url: doi('10.1519/JSC.0000000000004774'),
    id: 'DOI 10.1519/JSC.0000000000004774 · PMID 38595233',
  },
  schoenfeld2017vol: {
    authors: 'Schoenfeld, Ogborn, Krieger',
    year: '2017',
    title: 'Dose-response relationship between weekly resistance training volume and increases in muscle mass',
    journal: 'Journal of Sports Sciences 35(11):1073–1082',
    get kind() { return L('Méta-analyse · 15 études', 'Meta-analysis · 15 studies') },
    url: doi('10.1080/02640414.2016.1210197'),
    id: 'DOI 10.1080/02640414.2016.1210197 · PMID 27433992',
  },
  bazValle2022: {
    authors: 'Baz-Valle, Balsalobre-Fernández, Alix-Fages, Santos-Concejero',
    year: '2022',
    title: 'A Systematic Review of The Effects of Different Resistance Training Volumes on Muscle Hypertrophy',
    journal: 'Journal of Human Kinetics 81:199–210',
    get kind() { return L('Revue systématique', 'Systematic review') },
    url: doi('10.2478/hukin-2022-0017'),
    id: 'DOI 10.2478/hukin-2022-0017 · PMID 35291645',
  },
  haugen2023: {
    authors: 'Haugen, Vårvik, Larsen, Haugen, van den Tillaar, Bjørnsen',
    year: '2023',
    title: 'Effect of free-weight vs. machine-based strength training on maximal strength, hypertrophy and jump performance',
    journal: 'BMC Sports Science, Medicine and Rehabilitation 15:103',
    get kind() { return L('Méta-analyse · 13 études', 'Meta-analysis · 13 studies') },
    url: doi('10.1186/s13102-023-00713-4'),
    id: 'DOI 10.1186/s13102-023-00713-4 · PMID 37582807',
  },
  wolf2023: {
    authors: 'Wolf, Androulakis-Korakakis, Fisher, Schoenfeld, Steele',
    year: '2023',
    title: 'Partial Vs Full Range of Motion Resistance Training',
    journal: 'International Journal of Strength and Conditioning 3(1)',
    get kind() { return L('Méta-analyse bayésienne', 'Bayesian meta-analysis') },
    url: doi('10.47206/ijsc.v3i1.182'),
    id: 'DOI 10.47206/ijsc.v3i1.182',
  },
  pedrosa2022: {
    authors: 'Pedrosa, Lima, Schoenfeld et al.',
    year: '2022',
    title: 'Partial range of motion training elicits favorable improvements in muscular adaptations when carried out at long muscle lengths',
    journal: 'European Journal of Sport Science 22(8):1250–1260',
    get kind() { return L('Essai randomisé', 'Randomized trial') },
    url: doi('10.1080/17461391.2021.1927199'),
    id: 'DOI 10.1080/17461391.2021.1927199 · PMID 33977835',
  },
  maeo2021: {
    authors: 'Maeo, Huang, Wu et al.',
    year: '2021',
    title: 'Greater Hamstrings Muscle Hypertrophy but Similar Damage Protection after Training at Long versus Short Muscle Lengths',
    journal: 'Medicine & Science in Sports & Exercise 53(4):825–837',
    get kind() { return L('Essai randomisé', 'Randomized trial') },
    url: doi('10.1249/MSS.0000000000002523'),
    id: 'DOI 10.1249/MSS.0000000000002523 · PMID 33009197',
  },
  maeo2023: {
    authors: 'Maeo, Wu, Huang et al.',
    year: '2023',
    title: 'Triceps brachii hypertrophy is substantially greater after elbow extension training performed in the overhead versus neutral arm position',
    journal: 'European Journal of Sport Science',
    get kind() { return L('Essai randomisé', 'Randomized trial') },
    url: doi('10.1080/17461391.2022.2100279'),
    id: 'DOI 10.1080/17461391.2022.2100279',
  },
  kassiano2023: {
    authors: 'Kassiano, Costa, Kunevaliki et al.',
    year: '2023',
    title: 'Greater Gastrocnemius Muscle Hypertrophy After Partial Range of Motion Training Performed at Long Muscle Lengths',
    journal: 'Journal of Strength and Conditioning Research 37(9):1746–1753',
    get kind() { return L('Essai randomisé', 'Randomized trial') },
    url: doi('10.1519/JSC.0000000000004460'),
    id: 'DOI 10.1519/JSC.0000000000004460 · PMID 37015016',
  },
  kinoshita2023: {
    authors: 'Kinoshita, Maeo, Kobayashi et al.',
    year: '2023',
    title: 'Triceps surae muscle hypertrophy is greater after standing versus seated calf-raise training',
    journal: 'Frontiers in Physiology',
    get kind() { return L('Essai randomisé', 'Randomized trial') },
    url: doi('10.3389/fphys.2023.1272106'),
    id: 'DOI 10.3389/fphys.2023.1272106',
  },
  schoenfeld2017load: {
    authors: 'Schoenfeld, Grgic, Ogborn, Krieger',
    year: '2017',
    title: 'Strength and hypertrophy adaptations between low- vs. high-load resistance training',
    journal: 'Journal of Strength and Conditioning Research 31(12):3508–3523',
    get kind() { return L('Méta-analyse · 21 études', 'Meta-analysis · 21 studies') },
    url: doi('10.1519/JSC.0000000000002200'),
    id: 'DOI 10.1519/JSC.0000000000002200 · PMID 28834797',
  },
  robinson2024: {
    authors: 'Robinson, Pelland, Remmert, Refalo, Jukic, Steele, Zourdos',
    year: '2024',
    title: 'Exploring the Dose–Response Relationship Between Estimated Resistance Training Proximity to Failure, Strength Gain, and Muscle Hypertrophy',
    journal: 'Sports Medicine 54(9):2209–2231',
    get kind() { return L('Méta-régressions', 'Meta-regressions') },
    url: doi('10.1007/s40279-024-02069-2'),
    id: 'DOI 10.1007/s40279-024-02069-2',
  },
  refalo2023: {
    authors: 'Refalo, Helms, Trexler, Hamilton, Fyfe',
    year: '2023',
    title: 'Influence of Resistance Training Proximity-to-Failure on Skeletal Muscle Hypertrophy',
    journal: 'Sports Medicine 53(3):649–665',
    get kind() { return L('Méta-analyse · 15 études', 'Meta-analysis · 15 studies') },
    url: doi('10.1007/s40279-022-01784-y'),
    id: 'DOI 10.1007/s40279-022-01784-y · PMID 36334240',
  },
  singer2024: {
    authors: 'Singer, Wolf, Generoso et al.',
    year: '2024',
    title: 'Give it a rest: inter-set rest interval duration and muscle hypertrophy',
    journal: 'Frontiers in Sports and Active Living 6:1429789',
    get kind() { return L('Méta-analyse bayésienne', 'Bayesian meta-analysis') },
    url: doi('10.3389/fspor.2024.1429789'),
    id: 'DOI 10.3389/fspor.2024.1429789',
  },
  moesgaard2022: {
    authors: 'Moesgaard, Beck, Christiansen, Aagaard, Lundbye-Jensen',
    year: '2022',
    title: 'Effects of Periodization on Strength and Muscle Hypertrophy in Volume-Equated Resistance Training Programs',
    journal: 'Sports Medicine 52(7):1647–1666',
    get kind() { return L('Méta-analyse', 'Meta-analysis') },
    url: doi('10.1007/s40279-021-01636-1'),
    id: 'DOI 10.1007/s40279-021-01636-1 · PMID 35044672',
  },
  bell2023: {
    authors: 'Bell, Strafford, Coleman, Androulakis Korakakis, Nolan',
    year: '2023',
    title: 'Integrating Deloading into Strength and Physique Sports Training Programmes: An International Delphi Consensus Approach',
    journal: 'Sports Medicine – Open 9:87',
    get kind() { return L('Consensus Delphi (experts)', 'Delphi consensus (experts)') },
    url: doi('10.1186/s40798-023-00633-0'),
    id: 'DOI 10.1186/s40798-023-00633-0',
  },
  coleman2024: {
    authors: 'Coleman, Burke, Augustin et al.',
    year: '2024',
    title: 'Gaining more from doing less? The effects of a one-week deload period during supervised resistance training on muscular adaptations',
    journal: 'PeerJ 12:e16777',
    get kind() { return L('Essai randomisé', 'Randomized trial') },
    url: doi('10.7717/peerj.16777'),
    id: 'DOI 10.7717/peerj.16777',
  },
  ogasawara2013: {
    authors: 'Ogasawara, Yasuda, Ishii, Abe',
    year: '2013',
    title: 'Comparison of muscle hypertrophy following 6-month of continuous and periodic strength training',
    journal: 'European Journal of Applied Physiology 113(4):975–985',
    get kind() { return L('Essai contrôlé · n = 14', 'Controlled trial · n = 14') },
    url: doi('10.1007/s00421-012-2511-9'),
    id: 'DOI 10.1007/s00421-012-2511-9 · PMID 23053130',
  },
  murphy2022: {
    authors: 'Murphy, Koehler',
    year: '2022',
    title: 'Energy deficiency impairs resistance training gains in lean mass but not strength',
    journal: 'Scandinavian Journal of Medicine & Science in Sports 32(1):125–137',
    get kind() { return L('Méta-analyse et méta-régression', 'Meta-analysis and meta-regression') },
    url: doi('10.1111/sms.14075'),
    id: 'DOI 10.1111/sms.14075 · PMID 34623696',
  },
  garthe2011: {
    authors: 'Garthe, Raastad, Refsnes, Koivisto, Sundgot-Borgen',
    year: '2011',
    title: 'Effect of two different weight-loss rates on body composition and strength and power-related performance in elite athletes',
    journal: 'International Journal of Sport Nutrition and Exercise Metabolism 21(2):97–104',
    get kind() { return L('Essai randomisé · athlètes élite', 'Randomized trial · elite athletes') },
    url: doi('10.1123/ijsnem.21.2.97'),
    id: 'DOI 10.1123/ijsnem.21.2.97 · PMID 21558571',
  },
  helms2014: {
    authors: 'Helms, Aragon, Fitschen',
    year: '2014',
    title: 'Evidence-based recommendations for natural bodybuilding contest preparation: nutrition and supplementation',
    journal: 'Journal of the International Society of Sports Nutrition 11:20',
    get kind() { return L('Revue narrative', 'Narrative review') },
    url: doi('10.1186/1550-2783-11-20'),
    id: 'DOI 10.1186/1550-2783-11-20',
  },
  woolcott2018: {
    authors: 'Woolcott, Bergman',
    year: '2018',
    title: 'Relative fat mass (RFM) as a new estimator of whole-body fat percentage ─ A cross-sectional study in American adult individuals',
    journal: 'Scientific Reports 8:10980',
    get kind() { return L('Étude transversale · validation par DXA', 'Cross-sectional study · DXA validation') },
    url: doi('10.1038/s41598-018-29362-1'),
    id: 'DOI 10.1038/s41598-018-29362-1 · PMID 30030479',
  },
  deurenberg1991: {
    authors: 'Deurenberg, Weststrate, Seidell',
    year: '1991',
    title: 'Body mass index as a measure of body fatness: age- and sex-specific prediction formulas',
    journal: 'British Journal of Nutrition 65(2):105–114',
    get kind() { return L('Étude de validation · 1 229 adultes', 'Validation study · 1,229 adults') },
    url: doi('10.1079/BJN19910073'),
    id: 'DOI 10.1079/BJN19910073 · PMID 2043597',
  },
  mifflin1990: {
    authors: 'Mifflin, St Jeor, Hill et al.',
    year: '1990',
    title: 'A new predictive equation for resting energy expenditure in healthy individuals',
    journal: 'American Journal of Clinical Nutrition 51(2):241–247',
    get kind() { return L('Étude de validation · 498 adultes', 'Validation study · 498 adults') },
    url: doi('10.1093/ajcn/51.2.241'),
    id: 'DOI 10.1093/ajcn/51.2.241 · PMID 2305711',
  },
  kikuchi2017: {
    authors: 'Kikuchi, Nakazato',
    year: '2017',
    title: 'Low-load bench press and push-up induce similar muscle hypertrophy and strength gain',
    journal: 'Journal of Exercise Science & Fitness 15(1):37–42',
    get kind() { return L('Essai randomisé · 18 hommes, 8 semaines', 'Randomized trial · 18 men, 8 weeks') },
    url: doi('10.1016/j.jesf.2017.06.003'),
    id: 'DOI 10.1016/j.jesf.2017.06.003 · PMID 29541130',
  },
  morton2018: {
    authors: 'Morton, Murphy, McKellar et al.',
    year: '2018',
    title: 'A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on resistance training-induced gains in muscle mass and strength',
    journal: 'British Journal of Sports Medicine 52:376–384',
    get kind() { return L('Méta-analyse · 49 études', 'Meta-analysis · 49 studies') },
    url: doi('10.1136/bjsports-2017-097608'),
    id: 'DOI 10.1136/bjsports-2017-097608',
  },
  burke2023: {
    authors: 'Burke, Piñero, Coleman et al.',
    year: '2023',
    title: 'The Effects of Creatine Supplementation Combined with Resistance Training on Regional Measures of Muscle Hypertrophy',
    journal: 'Nutrients 15(9):2116',
    get kind() { return L('Méta-analyse · 10 essais', 'Meta-analysis · 10 trials') },
    url: doi('10.3390/nu15092116'),
    id: 'DOI 10.3390/nu15092116 · PMID 37432300',
  },
  // Added on 2 Oct 2026 with the rule for weeks of fewer than five sessions.
  iversen2021: {
    authors: 'Iversen, Norum, Schoenfeld, Fimland',
    year: '2021',
    title: 'No Time to Lift? Designing Time-Efficient Training Programs for Strength and Hypertrophy: A Narrative Review',
    journal: 'Sports Medicine 51(10):2079–2095',
    get kind() { return L('Revue narrative', 'Narrative review') },
    url: doi('10.1007/s40279-021-01490-1'),
    id: 'DOI 10.1007/s40279-021-01490-1',
    added: true,
  },
  zhang2025: {
    authors: 'Zhang, Weakley, Li, Li, García-Ramos',
    year: '2025',
    title: 'Superset Versus Traditional Resistance Training Prescriptions: A Systematic Review and Meta-analysis Exploring Acute and Chronic Effects on Mechanical, Metabolic, and Perceptual Variables',
    journal: 'Sports Medicine 55(4):953–975',
    get kind() { return L('Méta-analyse · 19 études', 'Meta-analysis · 19 studies') },
    url: doi('10.1007/s40279-025-02176-8'),
    id: 'DOI 10.1007/s40279-025-02176-8 · PMID 39903375',
    added: true,
  },
  remmert2025: {
    authors: 'Remmert, Pelland, Robinson, Hinson, Zourdos',
    year: '2025',
    title: 'Is There Too Much of a Good Thing? Meta-Regressions of the Effect of Per-Session Volume on Hypertrophy and Strength',
    journal: 'SportRxiv',
    get kind() { return L('Méta-régressions · prépublication, non relue par les pairs', 'Meta-regressions · preprint, not peer-reviewed') },
    url: doi('10.51224/SRXIV.537'),
    id: 'DOI 10.51224/SRXIV.537',
    added: true,
  },
  // Added on 2 Oct 2026 with the margin of the fatigue signal.
  mitter2022: {
    authors: 'Mitter, Csapo, Bauer, Tschan',
    year: '2022',
    title: 'Reproducibility of strength performance and strength-endurance profiles: A test-retest study',
    journal: 'PLOS ONE 17(5):e0268074',
    get kind() { return L('Étude de reproductibilité · 24 pratiquants entraînés', 'Test-retest study · 24 trained lifters') },
    url: doi('10.1371/journal.pone.0268074'),
    id: 'DOI 10.1371/journal.pone.0268074 · PMID 35511896',
    added: true,
  },
  hopkins2000: {
    authors: 'Hopkins',
    year: '2000',
    title: 'Measures of Reliability in Sports Medicine and Science',
    journal: 'Sports Medicine 30(1):1–15',
    get kind() { return L('Article de méthode', 'Methods paper') },
    url: doi('10.2165/00007256-200030010-00001'),
    id: 'DOI 10.2165/00007256-200030010-00001 · PMID 10907753',
    added: true,
  },
  // Added on 2 Oct 2026 with the sized step of the cut: what a kilogram lost stands for in energy.
  hall2008: {
    authors: 'Hall',
    year: '2008',
    title: 'What is the required energy deficit per unit weight loss?',
    journal: 'International Journal of Obesity 32(3):573–576',
    get kind() { return L('Étude de modélisation', 'Modelling study') },
    url: doi('10.1038/sj.ijo.0803720'),
    id: 'DOI 10.1038/sj.ijo.0803720 · PMID 17848938',
    added: true,
  },
  // Added on 2 Oct 2026 with the floor of the calorie advice: general guidance, not a study.
  harvard2024: {
    authors: 'Harvard Health Publishing',
    year: '2024',
    title: 'Calorie counting made easy',
    journal: 'Harvard Medical School',
    get kind() { return L('Recommandation de santé, pas une étude', 'Health guidance, not a study') },
    url: 'https://www.health.harvard.edu/staying-healthy/calorie-counting-made-easy',
    get id() { return L('Mise à jour du 3 avril 2024', 'Updated 3 April 2024') },
    added: true,
    guidance: true,
  },
}

/** How the sources split: publications checked in the research report, publications added since, general guidance. */
export function sourceCounts(): { reported: number; added: number; guidance: number } {
  const all = Object.values(SOURCES)
  const guidance = all.filter((x) => x.guidance).length
  const added = all.filter((x) => x.added && !x.guidance).length
  return { reported: all.length - added - guidance, added, guidance }
}

/** Studies cited: those of the report and those added since, without the general guidance. */
export const studyCount = (): number => sourceCounts().reported + sourceCounts().added

export interface Principle {
  id: string
  title: string
  rule: string
  detail: string
  level: EvidenceLevel
  refs: string[]
}

export const VERDICT_FREQUENCY = {
  get title() { return L('5 séances par semaine, est-ce optimal ?', 'Is 5 sessions a week optimal?') },
  get answer() {
    return L(
      "Pas en soi. À volume égal, s'entraîner 1, 2 ou 3 fois par semaine donne une hypertrophie similaire. Ce qui compte : 10 à 20 séries difficiles par muscle et par semaine, près de l'échec.",
      'Not in itself. With equal volume, training 1, 2 or 3 times a week gives similar hypertrophy. What matters: 10 to 20 hard sets per muscle per week, close to failure.',
    )
  },
  get keep() {
    return L(
      "On garde 5 séances parce qu'elles permettent 2 passages par muscle et des séances de 60–65 min au lieu de séances interminables. Avec 4 ou 3 jours, la rotation reste la même et chaque séance peut prendre plus de séries pour garder le volume de la semaine (réglage « Séances allongées ») : c'est équivalent.",
      'We keep 5 sessions because they hit each muscle twice with 60–65 min sessions instead of endless ones. With 4 or 3 days, the rotation stays the same and each session can take more sets to keep the weekly volume (the “Longer sessions” setting): it’s equivalent.',
    )
  },
  refs: ['pelland2025', 'schoenfeld2019', 'schoenfeld2016', 'ramosCampo2024'],
}

export const PRINCIPLES: Principle[] = [
  {
    id: 'volume',
    title: 'Volume',
    get rule() { return L('10–20 séries difficiles par muscle et par semaine', '10–20 hard sets per muscle per week') },
    get detail() { return L("Série directe = 1, série indirecte = 0,5 (comptage fractionnaire). Rendements décroissants, pas de plafond clair identifié. Le programme propose 10–14, puis davantage sur les muscles prioritaires. Ce repère n’est pas un minimum obligatoire pour chaque personne ; adapte les séries à ta récupération.", 'Direct set = 1, indirect set = 0.5 (fractional counting). Diminishing returns, no clear ceiling identified. The program proposes 10–14, then more on priority muscles. This reference is not a mandatory minimum for every person; adapt sets to recovery.') },
    level: 'fort',
    refs: ['schoenfeld2017vol', 'bazValle2022', 'pelland2025'],
  },
  {
    id: 'frequency',
    get title() { return L('Fréquence', 'Frequency') },
    get rule() { return L('2 passages par muscle et par semaine, pour répartir le volume', 'Each muscle trained twice a week, to spread the volume') },
    get detail() { return L("À volume égal, la fréquence a un effet négligeable sur l'hypertrophie. Elle sert à garder chaque série de haute qualité.", 'With equal volume, frequency has a negligible effect on hypertrophy. It helps keep every set high quality.') },
    level: 'fort',
    refs: ['schoenfeld2016', 'schoenfeld2019', 'pelland2025', 'ralston2018'],
  },
  {
    id: 'split',
    title: 'Split',
    get rule() { return L('Haut / Bas / Poussée / Tirage / Jambes', 'Upper / Lower / Push / Pull / Legs') },
    get detail() { return L('Split et full body sont équivalents à volume égal. Aucun essai ne teste cet hybride : son intérêt est logistique.', 'Split and full body are equivalent with equal volume. No trial tests this hybrid: its benefit is logistical.') },
    level: 'fort',
    refs: ['ramosCampo2024'],
  },
  {
    id: 'days',
    get title() { return L('Moins de 5 jours', 'Fewer than 5 days') },
    get rule() { return L('Même volume par semaine, plus de séries par séance', 'Same weekly volume, more sets per session') },
    get detail() {
      return L(
        "Les gains suivent le nombre de séries par muscle et par semaine, pas le nombre de séances : la rotation ne change pas, les séances prennent plus de séries (×1,25 à 4 jours, ×1,67 à 3 jours). Avec une limite : passé environ 11 séries pour un muscle dans une séance, le gain n'est plus mesurable, d'après une prépublication pas encore relue par les pairs. Les séries ajoutées s'arrêtent là : à 3 jours la semaine tient environ 97 % du volume, à 2 jours environ 64 %, et 4 séries par muscle et par semaine sont le minimum conseillé. La charge monte sur les séries de la fiche, pas sur celles ajoutées. Pour raccourcir une séance : les supersets d'exercices opposés prennent environ un tiers de temps en moins pour une croissance comparable (d'après trois études de long terme seulement), avec un effort ressenti plus élevé et une récupération qui peut être plus longue.",
        'Gains follow the number of sets per muscle per week, not the number of sessions: the rotation does not change, sessions take more sets (×1.25 at 4 days, ×1.67 at 3 days). With a limit: past about 11 sets for a muscle in one session, the gain can no longer be measured, according to a preprint not yet peer-reviewed. Added sets stop there: at 3 days the week holds about 97% of the volume, at 2 days about 64%, and 4 sets per muscle per week are the recommended minimum. Loads go up on the sheet’s sets, not on the added ones. To shorten a session: supersets of opposing exercises take about a third less time for similar growth (from only three long-term studies), with a higher perceived effort and a recovery that may take longer.',
      )
    },
    level: 'modere',
    refs: ['pelland2025', 'schoenfeld2019', 'ramosCampo2024', 'remmert2025', 'iversen2021', 'zhang2025'],
  },
  {
    id: 'effort',
    title: 'Effort',
    get rule() { return L('RIR 1–2 en polyarticulaire, 0–1 en isolation', 'RIR 1–2 on compounds, 0–1 on isolation') },
    get detail() { return L("L'hypertrophie augmente quand les séries finissent près de l'échec. L'échec total n'apporte qu'un bénéfice trivial.", 'Hypertrophy increases when sets end close to failure. Going all the way to failure adds only a trivial benefit.') },
    level: 'fort',
    refs: ['robinson2024', 'refalo2023'],
  },
  {
    id: 'load',
    get title() { return L('Charges', 'Loads') },
    get rule() { return L('6–12 reps en polyarticulaire, 10–20 en isolation', '6–12 reps on compounds, 10–20 on isolation') },
    get detail() { return L("Charges légères ou lourdes : hypertrophie similaire quand on s'approche de l'échec. Le lourd sert surtout la force.", 'Light or heavy loads: similar hypertrophy when you get close to failure. Heavy loads mainly build strength.') },
    level: 'fort',
    refs: ['schoenfeld2017load'],
  },
  {
    id: 'rest',
    get title() { return L('Repos', 'Rest') },
    get rule() { return L('Au moins 90 s ; 2–3 min en polyarticulaire', 'At least 90 s; 2–3 min on compounds') },
    get detail() { return L('Petit avantage au-delà de 60 s, pas de différence appréciable au-delà de 90 s.', 'Small benefit beyond 60 s, no meaningful difference beyond 90 s.') },
    level: 'modere',
    refs: ['singer2024'],
  },
  {
    id: 'machines',
    title: 'Machines',
    get rule() { return L('Machines = poids libres pour la masse', 'Machines = free weights for muscle growth') },
    get detail() { return L('Aucune différence d’hypertrophie. La force progresse surtout dans la modalité entraînée. Une salle Technogym suffit.', 'No difference in hypertrophy. Strength improves mostly in the trained modality. A Technogym gym is enough.') },
    level: 'fort',
    refs: ['haugen2023'],
  },
  {
    id: 'stretch',
    get title() { return L('Étirement', 'Stretch') },
    get rule() { return L('Amplitude complète, insister sur la position étirée', 'Full range of motion, emphasize the stretched position') },
    get detail() { return L('Leg curl assis (+14 % vs +9 %), triceps au-dessus de la tête (≈1,4× plus), leg extension genou fléchi, mollets en étirement. Effet surtout montré chez des débutants.', 'Seated leg curl (+14% vs +9%), overhead triceps (≈1.4× more), leg extension in the bent-knee range, calves in the stretch. Effect shown mostly in beginners.') },
    level: 'modere',
    refs: ['maeo2021', 'maeo2023', 'pedrosa2022', 'kassiano2023', 'kinoshita2023', 'wolf2023'],
  },
  {
    id: 'progression',
    title: 'Progression',
    get rule() { return L('Double progression, pas de périodisation compliquée', 'Double progression, no complicated periodization') },
    get detail() { return L('Linéaire ou ondulatoire : même hypertrophie à volume égal. Quand toutes les séries atteignent le haut de la fourchette au RIR visé, on augmente la charge.', 'Linear or undulating: same hypertrophy with equal volume. When every set reaches the top of the rep range at the target RIR, increase the load.') },
    level: 'fort',
    refs: ['moesgaard2022'],
  },
  {
    id: 'alert',
    get title() { return L('Signal d’alerte', 'Warning sign') },
    get rule() { return L('Deux nettes baisses de suite : 1 série de moins', 'Two clear drops in a row: 1 set fewer') },
    get detail() {
      return L(
        "À charge égale, les reps d'une série à l'échec varient de 0,7 à 1,1 d'une semaine à l'autre sans que le niveau ait changé (24 pratiquants entraînés, développé couché). Chez une personne, un changement n'est probablement réel qu'au-delà de 1,5 à 2 fois cette variation. L'app en tire son seuil : une baisse compte à partir d'une rep par série en moyenne, et de 2 reps au total ; en dessous, c'est la variation normale. C'est une application de ces deux chiffres, pas un résultat d'étude : elle suppose que les séries varient en partie chacune de leur côté. Retirer une série après deux baisses de suite, et avancer la décharge quand la baisse est générale, reste une règle d'experts.",
        'At the same load, the reps of a set taken to failure vary by 0.7 to 1.1 from one week to the next with no change of level (24 trained lifters, bench press). In one person, a change is likely real only beyond 1.5 to 2 times that variation. The app derives its threshold from them: a drop counts from one rep per set on average, and from 2 reps in all; below that, it is normal variation. This applies the two figures, it is not a study result: it assumes that sets vary partly on their own. Removing a set after two drops in a row, and bringing the deload forward when the drop is general, remains an expert rule.',
      )
    },
    level: 'opinion',
    refs: ['mitter2022', 'hopkins2000'],
  },
  {
    id: 'deload',
    get title() { return L('Décharges', 'Deloads') },
    get rule() { return L('1 semaine allégée toutes les 6 semaines', '1 lighter week every 6 weeks') },
    get detail() { return L("Moitié des séries, charges −10 %, RIR 3–4. C'est un outil de gestion de la fatigue : une semaine allégée ne coûte pas d'hypertrophie.", 'Half the sets, loads −10%, RIR 3–4. It’s a fatigue-management tool: a lighter week costs no hypertrophy.') },
    level: 'opinion',
    refs: ['bell2023', 'coleman2024'],
  },
  {
    id: 'pause',
    get title() { return L('Pauses', 'Breaks') },
    get rule() { return L("1 à 3 semaines d'arrêt ne sont pas un drame", '1 to 3 weeks off is no big deal') },
    get detail() { return L('Des cycles 6 semaines on / 3 semaines off ont donné la même hypertrophie que l’entraînement continu (petit échantillon).', 'Cycles of 6 weeks on / 3 weeks off gave the same hypertrophy as continuous training (small sample).') },
    level: 'modere',
    refs: ['ogasawara2013'],
  },
  {
    id: 'cut',
    get title() { return L('Sèche', 'Cut') },
    get rule() { return L('−0,5 à −0,7 % du poids par semaine, déficit ≤ 500 kcal/j', '−0.5 to −0.7% of body weight per week, deficit ≤ 500 kcal/day') },
    get detail() {
      return L(
        'La méta-régression associe environ 500 kcal/j de déficit à l’absence de gain moyen de masse maigre ; ce n’est pas un seuil individuel. Le conseil de calories suit ta moyenne de poids. Un pas par sèche n’est pas de 150 kcal mais le déficit du plan en une fois : celui du milieu de la fourchette (−0,6 %/sem, −0,5 en fin de sèche), 500 kcal/j au plus, moins ce que ta tendance montre déjà. Il demande une tendance fiable (une pesée tous les 3 jours, un rythme déjà lent deux semaines plus tôt, pas de changement de calories depuis 3 semaines) et 3 semaines normales, ce que l’app te demande ; s’il a visé trop fort, 150 kcal sont rendues. Il est calculé à 7 700 kcal par kg perdu, une approximation : sous 30 kg de masse grasse environ, le même déficit fait perdre plus de poids. Le calendrier est dimensionné au rythme prudent, limité par le même budget énergétique, sans gain musculaire anticipé et en tenant compte des pauses. Les pas ordinaires de 150 kcal sont aussi limités au déficit estimé restant ; 7 700 kcal/kg reste une approximation, pas une garantie. Garde-fou, qui ne vient pas d’une étude : il ne descend jamais sous ta dépense au repos estimée, ni sous 1 500 kcal (1 200 pour une femme), le minimum conseillé sans suivi médical.',
        'The meta-regression associates a deficit near 500 kcal/day with no average lean-mass gain; this is not an individual threshold. The calorie advice follows your weight average. One step per cut is not 150 kcal but the plan’s deficit at once: the one of the middle of the range (−0.6%/wk, −0.5 at the end of the cut), 500 kcal/day at most, less what your trend already shows. It takes a trend that can be relied on (a weigh-in every 3 days, a pace already slow two weeks earlier, no calorie change for 3 weeks) and 3 normal weeks, which the app asks about; if it aimed too high, 150 kcal are given back. It is worked out at 7,700 kcal per kg lost, an approximation: under about 30 kg of body fat, the same deficit takes off more weight. The calendar uses the conservative pace capped by the same energy budget, without assumed muscle gain and accounting for breaks. Ordinary 150 kcal steps are also clipped to the remaining estimated deficit; 7,700 kcal/kg remains an approximation, not a guarantee. A guard that does not come from a study: it never goes under your estimated energy at rest, nor under 1,500 kcal (1,200 for a woman), the minimum advised without medical supervision.',
      )
    },
    level: 'modere',
    refs: ['murphy2022', 'garthe2011', 'helms2014', 'hall2008', 'mifflin1990', 'harvard2024'],
  },
  {
    id: 'protein',
    get title() { return L('Protéines', 'Protein') },
    get rule() { return L('≥ 1,6 g/kg/j — 180–190 g pour toi, 185–200 g en sèche', '≥ 1.6 g/kg/day — 180–190 g for you, 185–200 g on a cut') },
    get detail() { return L('Plateau des gains vers 1,62 g/kg/j (IC 1,03–2,20). En déficit, 2,3–3,1 g/kg de masse maigre.', 'Gains plateau around 1.62 g/kg/day (CI 1.03–2.20). In a deficit, 2.3–3.1 g/kg of lean mass.') },
    level: 'fort',
    refs: ['morton2018', 'helms2014'],
  },
  {
    id: 'creatine',
    get title() { return L('Créatine', 'Creatine') },
    get rule() { return L('5 g par jour', '5 g per day') },
    get detail() { return L("Petit effet additionnel sur l'hypertrophie. Fait retenir 1–2 kg d'eau : à garder en tête en lisant la balance.", 'Small extra effect on hypertrophy. Makes you hold 1–2 kg of water: keep it in mind when reading the scale.') },
    level: 'modere',
    refs: ['burke2023'],
  },
]

/** Limits of the evidence, shown at the end of the program screen. */
export function caveats(): string[] {
  return [
    L('Les essais sur la longueur musculaire portent surtout sur des débutants, sur 8 à 12 semaines.', 'Muscle-length trials mostly involve beginners, over 8 to 12 weeks.'),
    L('Les méta-analyses incluent surtout des hommes jeunes (âge moyen ~25 ans).', 'The meta-analyses mostly include young men (average age ~25).'),
    L('Taux de gras, poids cible et calories de maintenance sont des estimations : seul ton suivi réel permet d’ajuster.', 'Body fat, target weight and maintenance calories are estimates: only your actual tracking lets you adjust them.'),
    L('Fréquence des décharges, pause diététique et seuils de reprise après pause relèvent de l’opinion d’experts.', 'Deload frequency, diet breaks and return thresholds after a break are expert opinion.'),
    L("Ce programme n'est pas un avis médical. Douleur articulaire : remplace l'exercice par son alternative machine.", 'This program is not medical advice. Joint pain: replace the exercise with its machine alternative.'),
  ]
}
