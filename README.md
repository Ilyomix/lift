# Golgoth

Programme d'hypertrophie fondé sur la recherche, en PWA installable sur iPhone.
Séances guidées, calendrier des blocs calé sur une date objectif modifiable, minuteur de repos
(notifié même téléphone verrouillé), charges qui s'ajustent seules, reprise après pause et
graphiques de progression. Tout fonctionne hors ligne.

**App : https://ilyomix.github.io/golgoth/**

## Le programme

Split Upper / Lower / Push / Pull / Legs, 5 séances par semaine, 2 passages par muscle.
Les règles viennent du rapport de recherche du 26 septembre 2026 (27 publications
vérifiées, listées dans l'app et dans `src/lib/research.ts`) :

- 10 à 20 séries difficiles par muscle et par semaine, en comptage fractionnaire ;
- RIR 1–2 en polyarticulaire, 0–1 en isolation, avec une progression d'effort dans chaque bloc ;
- double progression des charges ;
- blocs de 5 semaines suivis d'une semaine de décharge (séries ÷ 2, charges −10 %) ;
- pour l'objectif par défaut (30 juin 2027) : recomposition jusqu'au 3 janvier, sèche du 4 janvier
  au 13 juin, stabilisation jusqu'au 30 juin. Une autre date objectif recalcule le plan : sèche de
  23 semaines au plus, recomposition sur le temps restant, fêtes en maintenance ;
- reprise adaptée à la durée d'une pause (1 semaine, 2–3 semaines, plus de 3 semaines).

La fréquence n'est pas optimale en soi. À volume égal, s'entraîner 1, 2 ou 3 fois par semaine
donne des résultats similaires. Les 5 séances servent à répartir le volume.

## Fonctionnalités

- **Séance** : prescription du jour (séries, fourchette, RIR, repos, charge), série en cours mise
  en avant, dernière performance, reps propres, drapeaux échec, technique et douleur, supersets,
  remplacement d'exercice.
- **Charges automatiques** : après chaque séance, double progression (haut de fourchette → plus
  lourd), baisse si toutes les séries restent sous la fourchette, charge de départ après une séance
  d'essai, une série de moins après deux baisses de suite ; pendant la séance, les séries suivantes
  s'ajustent. Tout est annulable. Baisse générale → décharge avancée proposée.
- **Salles** : charges et historique des machines par salle ; haltères, barres et poids du corps communs.
- **Minuteur de repos** : cadran en chiffres DSEG, alertes sonores et vibrations, notification
  poussée par le serveur `push/` (Vercel) pour être prévenu téléphone verrouillé.
- **Nutrition** : protéines selon la moyenne de poids sur 7 jours, calories proposées d'après la
  tendance du poids (et du tour de taille en recomposition).
- **Calendrier** : rotation posée sur la semaine type (une séance manquée décale la rotation,
  aucune n'est sautée), décharges, phases, pauses, rappels natifs iPhone via un fichier `.ics`.
- **Progrès** : 1RM estimé par exercice, poids en moyenne sur 7 jours avec la trajectoire du plan,
  tour de taille, séries par muscle et par semaine face à la zone 10–20, photos avant/après.
- **Coach Claude** : bilan de séance exporté vers Claude, puis sa réponse JSON appliquée
  aux cibles, avec un aperçu avant validation.
- **Démos** : deux images par exercice, sources de preuve et vidéos YouTube.

## Stack

Vite 8 · React 19 · TypeScript · Tailwind CSS 4 · Lucide · NumberFlow · Zustand ·
IndexedDB (idb-keyval) · vite-plugin-pwa (Workbox).

```bash
npm install
npm run dev      # http://localhost:5173/golgoth/
npm test         # tests de logique (node --test)
npm run build    # typecheck + build PWA dans dist/
```

Chaque push sur `main` est testé, compilé puis publié sur GitHub Pages
(`.github/workflows/deploy.yml`).

## Données

Tout reste sur l'appareil, dans IndexedDB, sans compte. Seule exception, si les notifications
écran verrouillé sont activées : l'abonnement push est envoyé au serveur `push/` le temps d'un
repos (entrée de cache d'une heure au plus). L'export et l'import JSON sont compatibles avec les
sauvegardes de l'ancien Golgoth Tracker.

## Crédits

- Images de démonstration : [Free Exercise DB](https://github.com/yuhonas/free-exercise-db), domaine public (Unlicense).
- Police Geologica : SIL Open Font License (`src/assets/fonts/Geologica-LICENSE.txt`).
- Police DSEG7 : SIL Open Font License, © keshikan (`src/assets/fonts/DSEG-LICENSE.txt`).

Ce programme n'est pas un avis médical.
