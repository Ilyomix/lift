# Audit données, persistance et frontières entrantes — 7 octobre 2026

## Résultat

Audit du code local et de ses appelants ; corrections ciblées, sans accès aux données d’un appareil, sans appel au backend déployé, sans envoi de notification, installation, dépendance ajoutée, commit ou publication. Les changements antérieurs (dont la transaction photos et la déduplication par contenu exact) sont conservés.

**26 tests ciblés passent**, TypeScript et `git diff --check` passent. Les défauts ci-dessous ont été reproduits par injection locale ou par entrées synthétiques. La suite globale est exécutée par le parent après gel des autres lots.

## Inventaire couvert

| Domaine | Sources / chemins vérifiés | Couverture |
|---|---|---|
| Import, export, schéma | `src/lib/backup.ts`, `DataScreen` / `ImportSheet` dans `src/screens/More.tsx` | JSON invalide, normalisation, migration programme/diagnostics, photos, préférences, minuterie, succès/échec d’import, date du dernier export |
| Stockage | `src/lib/store.ts`, comportement réel `idb-keyval` | Chargement initial, écriture différée/en cours, retry après suspension, quota, remplacement et suppression des photos, effacement global |
| Migrations | `backup.upgradedProgram`, `upgradeToResearchProgram`, `trainingMigration.ts`, `localizeState` | Ordre préparation/localisation/calendrier avant écriture destructive ; migrations métiers détaillées couvertes par le lot calendrier/entraînement |
| Fichiers / partage | `src/lib/share.ts` et appelants sauvegarde, calendrier, brief coach | Export natif cache/partage, annulation, fallback téléchargement, copie refusée ; aucun fichier réel exporté pendant l’audit |
| Entrées / liens | `library.youtubeId`, `ExerciseSheet`, `Privacy`, `public/privacy.html`, liens recherche/science/GitHub | Données importées utilisées comme texte, URL YouTube reconstruite sur domaine fixe, `noopener noreferrer`, confidentialité iframe locale |
| Push web | `src/lib/push.ts`, `public/push-sw.js`, tous `push/api/*.js`, configuration / README | Validation des requêtes et endpoints, origine, relais long repos, annulation, données conservées ; tests locaux des helpers uniquement |

`src/lib/fileTransfer.ts` n’existe pas ; le code de partage se trouve dans `share.ts`.

## Défauts confirmés et corrections

### D1 — P1 : import annoncé réussi malgré échec d’écriture de l’état principal

**Source :** `store.ts`, `importBackup` (vers ligne 422). **Repro :** transaction photos réussie, puis `put('state')` refusé par quota. Avant : `true`, volet fermé, nouveaux clichés persistés mais ancien programme sur disque ; rechargement incohérent.

**Correction :** attendre l’écriture précédente, préparer entièrement l’état avant remplacement, ne publier le nouvel état en mémoire qu’après confirmation de l’écriture principale. En cas d’échec, restaurer les photos précédentes dans une transaction et renvoyer `false`. Si cette compensation échoue aussi, conserver les données précédentes en mémoire et afficher explicitement la nécessité d’exporter avant fermeture. Le correctif ne promet pas une transaction atomique entre les deux bases en cas d’arrêt brutal du processus.

**Tests :** `backup-persistence.test.ts` : échec état + restauration photos ; échec de la compensation ; import après une écriture suspendue. La transaction photos atomique précédente reste couverte par `backup-import.test.ts`.

### D2 — P1 : effacement fictif ou annulé par une écriture déjà en cours

**Source :** `store.ts`, `resetAll` (vers ligne 469). **Repro :** refus de `clear`, ou écriture principale retenue jusqu’après `clear`. Avant : profil affiché vide malgré données présentes, ou `state` recréé après l’effacement.

**Correction :** suspendre les nouveaux flush pendant l’opération, annuler l’écriture différée, attendre celle déjà commencée, puis effacer. Retour booléen ; en échec, état visible conservé et erreur explicite. Le parent a conditionné la navigation de `More` à ce résultat. Le reset réussi demande également l’annulation du repos push en attente.

**Tests :** refus puis retry ; écriture en cours ne ressuscitant plus les données ; reset réussi depuis `storage=memory` retourne `storage=idb` et confirme les deux bases vides, pour permettre l’onboarding après un effacement effectif (régression détectée à la relecture, rouge puis verte).

### D3 — P2 : suppression d’une photo affichée alors que son fichier reste stocké

**Source :** `store.ts`, `deletePhoto` (vers ligne 1187). **Repro :** suppression IndexedDB refusée. Avant : photo retirée de l’écran, réapparaît au prochain chargement, aucune erreur.

**Correction :** retirer de la liste uniquement après confirmation, conserver la photo et prévenir en échec. Test d’injection dédié.

### D4 — P2 : deux photos importées sous le même ID s’écrasent

**Source :** `backup.ts`, clés persistantes photos (vers ligne 489). **Repro :** deux contenus distincts, même `id`. Le résumé compte deux photos, mais les `put` successifs n’en conservent qu’une.

**Correction :** déduplication exacte conservée, premier ID préservé pour les références existantes ; IDs sans collision pour les occurrences suivantes, y compris si un suffixe généré existe déjà. Test de cardinalité des clés IndexedDB.

### D5 — P2 : valeurs optionnelles mal typées cassant les écrans/export

**Sources :** `backup.ts`, `normPrefs`, minuterie active et `exerciseVideos` (vers lignes 202, 286, 357).

**Repros :** vidéo importée sous forme d’objet atteint `.trim()` du formulaire ; horaire numérique atteint `.split()` dans l’export ICS ; `notifications: "false"` reste truthy ; échéance `1e100` provoque `Invalid time value` et rejette une sauvegarde autrement lisible.

**Correction :** garder seulement les URL textuelles ; normaliser les horaires HH:mm et les booléens ; supprimer uniquement la minuterie invalide, en conservant la séance et le reste du fichier. Quatre tests de normalisation. Aucun changement des valeurs valides.

### D6 — P2 : copie annoncée réussie malgré refus du fallback navigateur

**Source :** `share.ts:47`. **Repro :** API Clipboard refusée puis `execCommand('copy')` renvoie `false` sans exception. Avant : toast « Copié ».

**Correction :** tester la valeur retournée, afficher l’erreur et supprimer le champ temporaire. Test local ; annulation d’export également couverte sans téléchargement.

### D7 — P2 : frontières de requêtes push insuffisantes

**Sources :** nouveau `push/api/_validation.js`, réexporté par `_lib.js` sans nouvelle dépendance.

**Repros locaux :** corps JSON `null` provoquait une destructuration en erreur ; `x-forwarded-host: 127.0.0.1` faisait accepter `https://127.0.0.1/api/echo` et pilotait l’URL de relais ; userinfo/ports arbitraires étaient acceptés sur les domaines push ; une origine étrangère était privée d’en-tête CORS mais son POST simple restait traité.

**Correction :** corps obligatoirement objet ; cible echo/relais issue du domaine de déploiement configuré (`VERCEL_URL`, `VERCEL_PROJECT_PRODUCTION_URL`, défaut connu), jamais des en-têtes entrants ; HTTPS sans userinfo/port alternatif ; origine navigateur étrangère refusée avant traitement. Les relais serveur sans Origin restent permis.

**Preuves :** quatre tests des fonctions réellement utilisées par les handlers. **Limite de sécurité :** ceci établit l’insuffisance du contrôle local, pas l’exploitabilité distante via le proxy Vercel ; sa réécriture d’en-têtes n’a pas été testée. CORS n’est pas une authentification et aucun système de comptes/rate limit nouveau n’a été introduit.

### D8 — P1 : stockage illisible confondu avec profil absent au démarrage

**Source :** `store.init`, erreur de lecture état ou photos. Avant, le contrat `hasData=false, storage=memory` pouvait conduire à l’onboarding et au remplacement involontaire de données existantes.

**Correction coordonnée :** le parent ajoute dans `App` un état de chargement en erreur avec bouton Réessayer. `init` reste en échec complet : aucune exportation partielle sans photos. Deux tests imposent l’état d’erreur distinct et l’absence d’écriture pendant ces échecs.

## Vérifications et absence de constat

- Export de sauvegarde : `lastBackupAt` n’est changé qu’après le résultat positif de `saveFile`. L’annulation retourne `false` sans prétendre à un export.
- Photos importées rendues comme images, texte utilisateur rendu par React ; aucun sink HTML brut trouvé dans le périmètre. L’acceptation large `data:image/` n’a pas été présentée comme une XSS sans chemin exécutable.
- Vidéos : le parseur YouTube est permissif sur certains hôtes/identifiants, mais les destinations affichées sont reconstruites sur des domaines fixes YouTube. Aucun chemin de navigation arbitraire démontré ; pas de modification hors scope.
- Les liens externes de l’interface utilisent `noopener noreferrer`. La politique locale décrit les connexions YouTube, les notifications web et les notifications locales iOS ; aucune conclusion juridique n’est tirée.
- Le push web est désactivé pour les appels de planification natifs. Le backend ne constitue pas une infrastructure ActivityKit/APNs.
- Deux corrections métier de l’agent calendrier ont été posées dans `store.ts` à sa demande : ne pas augmenter une charge inférieure au palier lors d’une décharge ; transmettre l’historique antérieur et l’unité/contexte à `knownLoads`. Leurs preuves appartiennent à son lot.

## Commandes et preuves

```sh
node --import tsx --test tests/backup*.test.ts tests/storage*.test.ts tests/share-errors.test.ts tests/push-boundaries.test.ts
npm run typecheck
git diff --check
```

Résultat ciblé : **26/26 PASS**. Traces locales : `.local-release/audit-complet-donnees/` (`persistence-red.log`, `inputs-red.log`, `preferences-red.log`, `share-red.log`, `push-red.log`, puis `final-tests.log`). Les fichiers rouges attestent les anciens défauts ; ils ne décrivent pas l’état final.

## Limites

- Pas d’évaluation du déploiement Vercel, des secrets, des ACL réelles, du cache distribué ou des push physiques. Les corrections backend nécessitent un déploiement distinct ; aucun n’a été effectué.
- Pas de garantie d’atomicité crash entre `golgoth` et `golgoth-photos`. Compensation et avertissement couvrent les erreurs retournées en session. Un crash entre les deux commits reste une limite d’architecture documentée.
- Tests de stockage avec injection déterministe au niveau IndexedDB, utilisant le vrai store et `idb-keyval` ; pas un test Safari/iOS de quota réel.
- Pas de nouvelle validation native du partage. Les acquittements du système de partage ne prouvent pas que le destinataire a conservé une copie durable.
- Inventaire des migrations relu, sans prétendre couvrir exhaustivement toutes les sauvegardes historiques possibles ou toutes les entrées JSON arbitraires.
