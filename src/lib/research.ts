// Evidence base of the program. Every entry below was checked in the research
// report (26 Sept 2026). Studies the report could not verify are not cited.

export type EvidenceLevel = 'fort' | 'modere' | 'faible' | 'opinion'

export const LEVEL_LABEL: Record<EvidenceLevel, string> = {
  fort: 'Preuve forte',
  modere: 'Preuve modérée',
  faible: 'Preuve faible',
  opinion: "Opinion d'experts",
}

export interface Source {
  authors: string
  year: string
  title: string
  journal: string
  kind: string
  url: string
  id: string
}

const doi = (d: string) => `https://doi.org/${d}`

export const SOURCES: Record<string, Source> = {
  pelland2025: {
    authors: 'Pelland, Remmert, Robinson, Hinson, Zourdos et al.',
    year: '2025',
    title: 'The Resistance Training Dose Response: Meta-Regressions Exploring the Effects of Weekly Volume and Frequency on Muscle Hypertrophy and Strength Gains',
    journal: 'Sports Medicine 56:481–505',
    kind: 'Méta-régressions · 67 études',
    url: doi('10.1007/s40279-025-02344-w'),
    id: 'DOI 10.1007/s40279-025-02344-w · PMID 41343037',
  },
  schoenfeld2016: {
    authors: 'Schoenfeld, Ogborn, Krieger',
    year: '2016',
    title: 'Effects of Resistance Training Frequency on Measures of Muscle Hypertrophy',
    journal: 'Sports Medicine 46(11):1689–1697',
    kind: 'Méta-analyse · 10 études',
    url: doi('10.1007/s40279-016-0543-8'),
    id: 'DOI 10.1007/s40279-016-0543-8 · PMID 27102172',
  },
  schoenfeld2019: {
    authors: 'Schoenfeld, Grgic, Krieger',
    year: '2019',
    title: 'How many times per week should a muscle be trained to maximize muscle hypertrophy?',
    journal: 'Journal of Sports Sciences 37(11):1286–1295',
    kind: 'Méta-analyse · 25 études',
    url: 'https://pubmed.ncbi.nlm.nih.gov/?term=How+many+times+per+week+should+a+muscle+be+trained+to+maximize+muscle+hypertrophy',
    id: 'Recherche PubMed par titre',
  },
  ralston2018: {
    authors: 'Ralston, Kilgore, Wyatt, Buchan, Baker',
    year: '2018',
    title: 'Weekly Training Frequency Effects on Strength Gain',
    journal: 'Sports Medicine – Open 4:36',
    kind: 'Méta-analyse · 12 études',
    url: doi('10.1186/s40798-018-0149-9'),
    id: 'DOI 10.1186/s40798-018-0149-9 · PMID 30076500',
  },
  ramosCampo2024: {
    authors: 'Ramos-Campo, Benito-Peinado, Andreu-Caravaca, Rojo-Tirado, Rubio-Arias',
    year: '2024',
    title: 'Efficacy of Split Versus Full-Body Resistance Training on Strength and Muscle Growth',
    journal: 'Journal of Strength and Conditioning Research 38(7):1330–1340',
    kind: 'Méta-analyse · 14 études',
    url: doi('10.1519/JSC.0000000000004774'),
    id: 'DOI 10.1519/JSC.0000000000004774 · PMID 38595233',
  },
  schoenfeld2017vol: {
    authors: 'Schoenfeld, Ogborn, Krieger',
    year: '2017',
    title: 'Dose-response relationship between weekly resistance training volume and increases in muscle mass',
    journal: 'Journal of Sports Sciences 35(11):1073–1082',
    kind: 'Méta-analyse · 15 études',
    url: doi('10.1080/02640414.2016.1210197'),
    id: 'DOI 10.1080/02640414.2016.1210197 · PMID 27433992',
  },
  bazValle2022: {
    authors: 'Baz-Valle, Balsalobre-Fernández, Alix-Fages, Santos-Concejero',
    year: '2022',
    title: 'A Systematic Review of The Effects of Different Resistance Training Volumes on Muscle Hypertrophy',
    journal: 'Journal of Human Kinetics 81:199–210',
    kind: 'Revue systématique',
    url: doi('10.2478/hukin-2022-0017'),
    id: 'DOI 10.2478/hukin-2022-0017 · PMID 35291645',
  },
  haugen2023: {
    authors: 'Haugen, Vårvik, Larsen, Haugen, van den Tillaar, Bjørnsen',
    year: '2023',
    title: 'Effect of free-weight vs. machine-based strength training on maximal strength, hypertrophy and jump performance',
    journal: 'BMC Sports Science, Medicine and Rehabilitation 15:103',
    kind: 'Méta-analyse · 13 études',
    url: doi('10.1186/s13102-023-00713-4'),
    id: 'DOI 10.1186/s13102-023-00713-4 · PMID 37582807',
  },
  wolf2023: {
    authors: 'Wolf, Androulakis-Korakakis, Fisher, Schoenfeld, Steele',
    year: '2023',
    title: 'Partial Vs Full Range of Motion Resistance Training',
    journal: 'International Journal of Strength and Conditioning 3(1)',
    kind: 'Méta-analyse bayésienne',
    url: doi('10.47206/ijsc.v3i1.182'),
    id: 'DOI 10.47206/ijsc.v3i1.182',
  },
  pedrosa2022: {
    authors: 'Pedrosa, Lima, Schoenfeld et al.',
    year: '2022',
    title: 'Partial range of motion training elicits favorable improvements in muscular adaptations when carried out at long muscle lengths',
    journal: 'European Journal of Sport Science 22(8):1250–1260',
    kind: 'Essai randomisé',
    url: doi('10.1080/17461391.2021.1927199'),
    id: 'DOI 10.1080/17461391.2021.1927199 · PMID 33977835',
  },
  maeo2021: {
    authors: 'Maeo, Huang, Wu et al.',
    year: '2021',
    title: 'Greater Hamstrings Muscle Hypertrophy but Similar Damage Protection after Training at Long versus Short Muscle Lengths',
    journal: 'Medicine & Science in Sports & Exercise 53(4):825–837',
    kind: 'Essai randomisé',
    url: doi('10.1249/MSS.0000000000002523'),
    id: 'DOI 10.1249/MSS.0000000000002523 · PMID 33009197',
  },
  maeo2023: {
    authors: 'Maeo, Wu, Huang et al.',
    year: '2023',
    title: 'Triceps brachii hypertrophy is substantially greater after elbow extension training performed in the overhead versus neutral arm position',
    journal: 'European Journal of Sport Science',
    kind: 'Essai randomisé',
    url: doi('10.1080/17461391.2022.2100279'),
    id: 'DOI 10.1080/17461391.2022.2100279',
  },
  kassiano2023: {
    authors: 'Kassiano, Costa, Kunevaliki et al.',
    year: '2023',
    title: 'Greater Gastrocnemius Muscle Hypertrophy After Partial Range of Motion Training Performed at Long Muscle Lengths',
    journal: 'Journal of Strength and Conditioning Research 37(9):1746–1753',
    kind: 'Essai randomisé',
    url: doi('10.1519/JSC.0000000000004460'),
    id: 'DOI 10.1519/JSC.0000000000004460 · PMID 37015016',
  },
  kinoshita2023: {
    authors: 'Kinoshita, Maeo, Kobayashi et al.',
    year: '2023',
    title: 'Triceps surae muscle hypertrophy is greater after standing versus seated calf-raise training',
    journal: 'Frontiers in Physiology',
    kind: 'Essai randomisé',
    url: doi('10.3389/fphys.2023.1272106'),
    id: 'DOI 10.3389/fphys.2023.1272106',
  },
  schoenfeld2017load: {
    authors: 'Schoenfeld, Grgic, Ogborn, Krieger',
    year: '2017',
    title: 'Strength and hypertrophy adaptations between low- vs. high-load resistance training',
    journal: 'Journal of Strength and Conditioning Research 31(12):3508–3523',
    kind: 'Méta-analyse · 21 études',
    url: doi('10.1519/JSC.0000000000002200'),
    id: 'DOI 10.1519/JSC.0000000000002200 · PMID 28834797',
  },
  robinson2024: {
    authors: 'Robinson, Pelland, Remmert, Refalo, Jukic, Steele, Zourdos',
    year: '2024',
    title: 'Exploring the Dose–Response Relationship Between Estimated Resistance Training Proximity to Failure, Strength Gain, and Muscle Hypertrophy',
    journal: 'Sports Medicine 54(9):2209–2231',
    kind: 'Méta-régressions',
    url: doi('10.1007/s40279-024-02069-2'),
    id: 'DOI 10.1007/s40279-024-02069-2',
  },
  refalo2023: {
    authors: 'Refalo, Helms, Trexler, Hamilton, Fyfe',
    year: '2023',
    title: 'Influence of Resistance Training Proximity-to-Failure on Skeletal Muscle Hypertrophy',
    journal: 'Sports Medicine 53(3):649–665',
    kind: 'Méta-analyse · 15 études',
    url: doi('10.1007/s40279-022-01784-y'),
    id: 'DOI 10.1007/s40279-022-01784-y · PMID 36334240',
  },
  singer2024: {
    authors: 'Singer, Wolf, Generoso et al.',
    year: '2024',
    title: 'Give it a rest: inter-set rest interval duration and muscle hypertrophy',
    journal: 'Frontiers in Sports and Active Living 6:1429789',
    kind: 'Méta-analyse bayésienne',
    url: doi('10.3389/fspor.2024.1429789'),
    id: 'DOI 10.3389/fspor.2024.1429789',
  },
  moesgaard2022: {
    authors: 'Moesgaard, Beck, Christiansen, Aagaard, Lundbye-Jensen',
    year: '2022',
    title: 'Effects of Periodization on Strength and Muscle Hypertrophy in Volume-Equated Resistance Training Programs',
    journal: 'Sports Medicine 52(7):1647–1666',
    kind: 'Méta-analyse',
    url: doi('10.1007/s40279-021-01636-1'),
    id: 'DOI 10.1007/s40279-021-01636-1 · PMID 35044672',
  },
  bell2023: {
    authors: 'Bell, Strafford, Coleman, Androulakis Korakakis, Nolan',
    year: '2023',
    title: 'Integrating Deloading into Strength and Physique Sports Training Programmes: An International Delphi Consensus Approach',
    journal: 'Sports Medicine – Open 9:87',
    kind: 'Consensus Delphi (experts)',
    url: doi('10.1186/s40798-023-00633-0'),
    id: 'DOI 10.1186/s40798-023-00633-0',
  },
  coleman2024: {
    authors: 'Coleman, Burke, Augustin et al.',
    year: '2024',
    title: 'Gaining more from doing less? The effects of a one-week deload period during supervised resistance training on muscular adaptations',
    journal: 'PeerJ 12:e16777',
    kind: 'Essai randomisé',
    url: doi('10.7717/peerj.16777'),
    id: 'DOI 10.7717/peerj.16777',
  },
  ogasawara2013: {
    authors: 'Ogasawara, Yasuda, Ishii, Abe',
    year: '2013',
    title: 'Comparison of muscle hypertrophy following 6-month of continuous and periodic strength training',
    journal: 'European Journal of Applied Physiology 113(4):975–985',
    kind: 'Essai contrôlé · n = 14',
    url: doi('10.1007/s00421-012-2511-9'),
    id: 'DOI 10.1007/s00421-012-2511-9 · PMID 23053130',
  },
  murphy2022: {
    authors: 'Murphy, Koehler',
    year: '2022',
    title: 'Energy deficiency impairs resistance training gains in lean mass but not strength',
    journal: 'Scandinavian Journal of Medicine & Science in Sports 32(1):125–137',
    kind: 'Méta-analyse et méta-régression',
    url: doi('10.1111/sms.14075'),
    id: 'DOI 10.1111/sms.14075 · PMID 34623696',
  },
  garthe2011: {
    authors: 'Garthe, Raastad, Refsnes, Koivisto, Sundgot-Borgen',
    year: '2011',
    title: 'Effect of two different weight-loss rates on body composition and strength and power-related performance in elite athletes',
    journal: 'International Journal of Sport Nutrition and Exercise Metabolism 21(2):97–104',
    kind: 'Essai randomisé · athlètes élite',
    url: doi('10.1123/ijsnem.21.2.97'),
    id: 'DOI 10.1123/ijsnem.21.2.97 · PMID 21558571',
  },
  helms2014: {
    authors: 'Helms, Aragon, Fitschen',
    year: '2014',
    title: 'Evidence-based recommendations for natural bodybuilding contest preparation: nutrition and supplementation',
    journal: 'Journal of the International Society of Sports Nutrition 11:20',
    kind: 'Revue narrative',
    url: doi('10.1186/1550-2783-11-20'),
    id: 'DOI 10.1186/1550-2783-11-20',
  },
  morton2018: {
    authors: 'Morton, Murphy, McKellar et al.',
    year: '2018',
    title: 'A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on resistance training-induced gains in muscle mass and strength',
    journal: 'British Journal of Sports Medicine 52:376–384',
    kind: 'Méta-analyse · 49 études',
    url: doi('10.1136/bjsports-2017-097608'),
    id: 'DOI 10.1136/bjsports-2017-097608',
  },
  burke2023: {
    authors: 'Burke, Piñero, Coleman et al.',
    year: '2023',
    title: 'The Effects of Creatine Supplementation Combined with Resistance Training on Regional Measures of Muscle Hypertrophy',
    journal: 'Nutrients 15(9):2116',
    kind: 'Méta-analyse · 10 essais',
    url: doi('10.3390/nu15092116'),
    id: 'DOI 10.3390/nu15092116 · PMID 37432300',
  },
}

export interface Principle {
  id: string
  title: string
  rule: string
  detail: string
  level: EvidenceLevel
  refs: string[]
}

export const VERDICT_FREQUENCY = {
  title: '5 séances par semaine, est-ce optimal ?',
  answer:
    "Pas en soi. À volume égal, s'entraîner 1, 2 ou 3 fois par semaine donne une hypertrophie similaire. Ce qui compte : 10 à 20 séries difficiles par muscle et par semaine, près de l'échec.",
  keep:
    "On garde 5 séances parce qu'elles permettent 2 passages par muscle et des séances de 60–65 min au lieu de séances interminables. Une semaine à 4 séances ? Passe en haut/bas/haut/bas : c'est équivalent.",
  refs: ['pelland2025', 'schoenfeld2019', 'schoenfeld2016', 'ramosCampo2024'],
}

export const PRINCIPLES: Principle[] = [
  {
    id: 'volume',
    title: 'Volume',
    rule: '10–20 séries difficiles par muscle et par semaine',
    detail: "Série directe = 1, série indirecte = 0,5 (comptage fractionnaire). Rendements décroissants, pas de plafond clair identifié. On démarre à 10–14 et on monte vers 14–20 sur les muscles prioritaires.",
    level: 'fort',
    refs: ['schoenfeld2017vol', 'bazValle2022', 'pelland2025'],
  },
  {
    id: 'frequency',
    title: 'Fréquence',
    rule: '2 passages par muscle et par semaine, pour répartir le volume',
    detail: "À volume égal, la fréquence a un effet négligeable sur l'hypertrophie. Elle sert à garder chaque série de haute qualité.",
    level: 'fort',
    refs: ['schoenfeld2016', 'schoenfeld2019', 'pelland2025', 'ralston2018'],
  },
  {
    id: 'split',
    title: 'Split',
    rule: 'Haut / Bas / Poussée / Tirage / Jambes',
    detail: 'Split et full body sont équivalents à volume égal. Aucun essai ne teste cet hybride : son intérêt est logistique.',
    level: 'fort',
    refs: ['ramosCampo2024'],
  },
  {
    id: 'effort',
    title: 'Effort',
    rule: 'RIR 1–2 en polyarticulaire, 0–1 en isolation',
    detail: "L'hypertrophie augmente quand les séries finissent près de l'échec. L'échec total n'apporte qu'un bénéfice trivial.",
    level: 'fort',
    refs: ['robinson2024', 'refalo2023'],
  },
  {
    id: 'load',
    title: 'Charges',
    rule: '6–12 reps en polyarticulaire, 10–20 en isolation',
    detail: "Charges légères ou lourdes : hypertrophie similaire quand on s'approche de l'échec. Le lourd sert surtout la force.",
    level: 'fort',
    refs: ['schoenfeld2017load'],
  },
  {
    id: 'rest',
    title: 'Repos',
    rule: 'Au moins 90 s ; 2–3 min en polyarticulaire',
    detail: 'Petit avantage au-delà de 60 s, pas de différence appréciable au-delà de 90 s.',
    level: 'modere',
    refs: ['singer2024'],
  },
  {
    id: 'machines',
    title: 'Machines',
    rule: 'Machines = poids libres pour la masse',
    detail: 'Aucune différence d’hypertrophie. La force progresse surtout dans la modalité entraînée. Une salle Technogym suffit.',
    level: 'fort',
    refs: ['haugen2023'],
  },
  {
    id: 'stretch',
    title: 'Étirement',
    rule: 'Amplitude complète, insister sur la position étirée',
    detail: 'Leg curl assis (+14 % vs +9 %), triceps au-dessus de la tête (≈1,4× plus), leg extension genou fléchi, mollets en étirement. Effet surtout montré chez des débutants.',
    level: 'modere',
    refs: ['maeo2021', 'maeo2023', 'pedrosa2022', 'kassiano2023', 'kinoshita2023', 'wolf2023'],
  },
  {
    id: 'progression',
    title: 'Progression',
    rule: 'Double progression, pas de périodisation compliquée',
    detail: 'Linéaire ou ondulatoire : même hypertrophie à volume égal. Quand toutes les séries atteignent le haut de la fourchette au RIR visé, on augmente la charge.',
    level: 'fort',
    refs: ['moesgaard2022'],
  },
  {
    id: 'deload',
    title: 'Décharges',
    rule: '1 semaine allégée toutes les 6 semaines',
    detail: "Moitié des séries, charges −10 %, RIR 3–4. C'est un outil de gestion de la fatigue : une semaine allégée ne coûte pas d'hypertrophie.",
    level: 'opinion',
    refs: ['bell2023', 'coleman2024'],
  },
  {
    id: 'pause',
    title: 'Pauses',
    rule: "1 à 3 semaines d'arrêt ne sont pas un drame",
    detail: 'Des cycles 6 semaines on / 3 semaines off ont donné la même hypertrophie que l’entraînement continu (petit échantillon).',
    level: 'modere',
    refs: ['ogasawara2013'],
  },
  {
    id: 'cut',
    title: 'Sèche',
    rule: '−0,5 à −0,7 % du poids par semaine, déficit ≤ 500 kcal/j',
    detail: 'Un déficit d’environ 500 kcal/j supprime les gains de masse maigre ; une perte lente préserve mieux le muscle.',
    level: 'modere',
    refs: ['murphy2022', 'garthe2011', 'helms2014'],
  },
  {
    id: 'protein',
    title: 'Protéines',
    rule: '≥ 1,6 g/kg/j — 180–190 g pour toi, 185–200 g en sèche',
    detail: 'Plateau des gains vers 1,62 g/kg/j (IC 1,03–2,20). En déficit, 2,3–3,1 g/kg de masse maigre.',
    level: 'fort',
    refs: ['morton2018', 'helms2014'],
  },
  {
    id: 'creatine',
    title: 'Créatine',
    rule: '5 g par jour',
    detail: "Petit effet additionnel sur l'hypertrophie. Fait retenir 1–2 kg d'eau : à garder en tête en lisant la balance.",
    level: 'modere',
    refs: ['burke2023'],
  },
]

export const CAVEATS = [
  'Les essais sur la longueur musculaire portent surtout sur des débutants, sur 8 à 12 semaines.',
  'Les méta-analyses incluent surtout des hommes jeunes (âge moyen ~25 ans).',
  'Taux de gras, poids cible et calories de maintenance sont des estimations : seul ton suivi réel permet d’ajuster.',
  'Fréquence des décharges, pause diététique et seuils de reprise après pause relèvent de l’opinion d’experts.',
  "Ce programme n'est pas un avis médical. Douleur articulaire : remplace l'exercice par son alternative machine.",
]
