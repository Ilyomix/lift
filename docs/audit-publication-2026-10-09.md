# Audit de publication Lift 1.0 — 9 octobre 2026

## Verdict

**Publiable après corrections, livrées dans le build 41.** Aucun P0 : l'onboarding, la séance, la saisie, le repos, la fin de séance et l'historique fonctionnent. Les P1 relevés touchaient la saisie au clavier, l'abandon de séance et la conformité App Store ; ils sont corrigés et vérifiés sur simulateur. Les points reportés sont listés en fin de document, aucun n'est un motif de rejet connu.

Référence : build 40 (`8fc3538`) audité, corrections dans le commit du build 41. Tests : 511 réussis, 1 ignoré, 0 échec. Contrôle de types et build web réussis.

## Méthode

Trois évaluations indépendantes, puis un inventaire de toutes les surfaces de saisie :

- **Revue UX** sur le simulateur iPhone 17 Pro Max (build 40 natif, données fictives) et l'onboarding en web à 393 pt. Heuristiques de Nielsen : **24/40** (acceptable), charge cognitive élevée en séance et à l'étape 4 de l'onboarding.
- **Détecteur et mesures navigateur** à 393 pt et en iPad : 0 constat statique, 0 cible tactile sous 44 pt, 0 débordement horizontal, 0 erreur console. Seuls des textes de 10–11 px et deux boutons désactivés sous 4,5:1 (exemptés).
- **Conformité App Store** (règles 1.4.1, 2.1, 2.3, 4.2, 5.1) : prêt avec correctifs ; valeur native réelle (Live Activity, App Intents, notifications locales, Fichiers, caméra), « Data Not Collected » cohérent avec le code.
- **Inventaire des saisies** (393 et 375 pt, clavier ouvert) sur chaque champ, volet, unité et clavier, puis vérification sur simulateur.

## Corrigé dans le build 41

| Priorité | Problème | Correction |
|---|---|---|
| P1 | La charge en séance ouvrait une roue dont la saisie au clavier était masquée par le clavier ; la page défilait derrière ; l'unité n'était pas sur la ligne de la valeur | Champ numérique direct, unité sur la même ligne (« 102,5 kg » ; « kg/main » empilé à côté de la valeur, tient à 375 pt) ; colonne charge élargie |
| P1 | Le clavier recouvrait les volets ; le contenu passait sous la barre d'état | `@capacitor/keyboard` (redimensionnement natif) : volets et boutons d'action au-dessus du clavier, barre d'onglets et minuteur masqués pendant la saisie, barre ⌃ ⌄ ✓ conservée, champ tapé recentré |
| P1 | La page défilait derrière un volet ouvert et ne revenait pas | Page figée à sa position sous tout volet, restaurée à la fermeture (sauf changement d'écran) |
| P1 | Une roue fermée sans être bougée laissait le champ vide (taille 178 cm, poids identique à la veille) | Bouton « Valider » qui applique la valeur affichée ; « Effacer » pour les champs facultatifs |
| P1 | « Abandonner la séance » effaçait les séries validées en un tap | Confirmation avec le nombre de séries perdues |
| P1 | En séance, la saisie était sous la démo 3D | Pour un mouvement déjà fait, séries d'abord, démo repliée sous « Voir le mouvement » ; ouverte pour un premier passage |
| P1 | Barre d'état sombre sur fond sombre quand l'iPhone est en apparence claire | Contenu clair imposé (`UIStatusBarStyleLightContent`) |
| P2 | Les flèches ⌃ ⌄ du clavier envoyaient le focus derrière le volet (RIR d'une série invisible) | Tout ce qui est sous le volet du dessus devient inerte |
| P2 | Charges sans unité dans les historiques (« 42,5 × 8 ») | « 42,5 kg × 8 · 8 », « 6 kg/main × 14 », « PDC +2,5 kg × 10 » partout (Progrès, séance, fiche, bilan IA) |
| P2 | Saisie au clavier d'une roue : point décimal en français, roue visible derrière, unité éloignée | Virgule française, champ seul, unité collée ; pavé entier pour les valeurs entières |
| P2 | Mesures tapées hors plage enregistrées (7,8 kg pour 78) | Bornes de la roue appliquées (poids 35–250 kg, tailles en cm) |
| P2 | Un ⌫ remettait le total nutritionnel du jour à 0 | Champ vidé ignoré ; 0 se tape volontairement |
| P2 | Répétitions manquantes signalées par un toast en haut d'écran | ✓ ouvre directement le champ répétitions |
| P2 | VoiceOver annonçait le placeholder comme une valeur | « non renseigné » |
| P2 | Live Activity proposée sur iPad sans prise en charge, texte « Dynamic Island » | Réglage affiché seulement si iOS l'autorise, texte adapté |
| P2 | Paysage déclaré sur iPhone sans mise en page | iPhone en portrait seul (iPad inchangé) |
| P2 | Écran de lancement avec l'ancien logo | Fond uni de l'app |
| 1.4.1 | Conseils caloriques sans rappel médical (onboarding dès 14 ans) | Rappel de consulter un médecin, notamment avant 18 ans |
| 2.1 / 5.1 | Politique de confidentialité : libellé du bouton vidéo erroné | « Voir ma vidéo » |
| P3 | Correction automatique sur JSON IA et noms de salle, erreurs de plage en gris à l'onboarding, libellé « Réserve visée » sur deux lignes, `armv7` | Corrigés |

## Reporté (connu, non bloquant)

- **Bande sombre sous la barre d'état en thème clair** (P2) : la faire suivre le thème impose de gérer aussi le minuteur plein écran, toujours sombre. Le thème par défaut est sombre.
- **Jargon** (codes PS/PL/UP/LO/LG, « RIR », « PDC », « 0,2 t ») et **onboarding** (5 jours cochés, 100 min à 3 jours, étape 4 chargée) : décisions produit.
- **Dynamic Type** : tailles en px ; ne pas déclarer « Texte plus grand » dans App Store Connect.
- **iPad** : colonne unique de 640 px.
- **Volet de roue** : saut d'environ 0,4 s au passage en saisie, le temps que la WebView se redimensionne.
- **En-tête de séance à 375 pt** : nom de salle tronqué.
- **Support** : uniquement via les issues GitHub ; ajouter un contact direct si Apple le demande (règle 1.5).
