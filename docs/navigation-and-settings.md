# Lift — arborescence et règles de cohérence

Objectif défini le 4 octobre 2026 : rendre chaque option facile à trouver, regrouper les sujets et raccourcir les vues sans retirer de fonction ni modifier les données existantes.

Référence visuelle : composants `src/components/ui.tsx`, illustrations `SportArt`, Geologica et couleurs de `src/index.css`. Les frises, le compteur séances réalisées/total, les cinq onglets principaux et les contrôles de séance sont conservés.

## Arborescence livrée

```text
Lift
├── Premier lancement
│   ├── Français / English
│   ├── Préparer mon entraînement / importer une sauvegarde
│   ├── Matériel et jours disponibles
│   ├── Profil et mesures
│   └── Objectif daté / entretien → aperçu → démarrer
├── Aujourd’hui
│   ├── Séances réalisées / total + frise + date objectif
│   ├── Séance à venir / reprendre la séance + choix de salle
│   ├── Cette semaine
│   ├── Objectifs : poids, taille, régularité, force → Progrès
│   ├── Nutrition du jour → journal Nutrition
│   └── À faire : rappels contextuels, mesures, photos, sauvegarde
├── Séance
│   ├── Préparation : type, salle, prescription, exercices, démarrer
│   ├── Séance active
│   │   ├── Série : charge, répétitions, répétitions en réserve, valider
│   │   ├── Détails : technique, échec, douleur, répétitions propres, note
│   │   ├── Exercice : démonstration, alternative, conditions, passer
│   │   ├── Ajouter / retirer une série, ajustement de charge / annuler
│   │   ├── Repos : cadran, pas 15 s / 1 min / 5 min, − / +, passer
│   │   └── Notes, date, terminer / abandonner
│   ├── Fiche exercice
│   │   ├── Prescription et technique
│   │   ├── Mouvement 3D / face / dos, pause, rotation à deux doigts
│   │   ├── Muscles sollicités
│   │   ├── Vidéo externe / référence personnelle
│   │   └── Alternatives : cette séance / programme
│   └── Bilan : performances, ajustements, récupération, historique
├── Calendrier
│   ├── Onglet Calendrier
│   │   ├── Mois, précédent / suivant / aujourd’hui
│   │   ├── Jour : séances prévues / réalisées, détails
│   │   ├── Prochaines étapes
│   │   └── Pause du programme / rappels calendrier
│   └── Onglet Programme
│       ├── Frise, bloc actuel, prochains blocs ; passé replié
│       ├── Séances : Upper / Lower / Push / Pull / Legs
│       │   └── Ordre, ajout, modification, remplacement, retrait
│       ├── Semaine type : repos ou type de séance par jour
│       ├── Volume par muscle
│       ├── Progression et ajustements
│       └── Lien Sources scientifiques
├── Progrès
│   ├── Force : exercices, salle, courbes, historique, fiche mouvement
│   ├── Corps : poids, taille, mesures, photos, comparaison
│   ├── Volume : semaines, séries par muscle, régularité, effort
│   └── Séances : historique → détail / correction / suppression confirmée
└── Plus
    ├── Nutrition — journal quotidien
    │   ├── Jour précédent / suivant
    │   ├── Protéines et calories : saisie + ajustements + progression
    │   ├── Créatine prise / non prise
    │   ├── Tendance des protéines sur 14 jours
    │   └── Cibles et ajustements → Réglages / Cibles nutritionnelles
    ├── Réglages — six rubriques
    │   ├── Objectifs
    │   │   ├── Objectif visuel : silhouette, zones, mesures, aperçu du plan
    │   │   │   ├── Effet détaillé sur les séances
    │   │   │   ├── Photo de référence
    │   │   │   └── Sources et limites de l’estimation
    │   │   ├── Date objectif / entretien
    │   │   └── Mesures cibles : poids min / max, tour de taille
    │   ├── Séances et matériel
    │   │   ├── Jours et rythme : jours actifs, volume adapté
    │   │   ├── Séances du programme → Calendrier / Programme
    │   │   ├── Matériel et salles : configuration, choix, ajout, renommage, retrait
    │   │   ├── Pause : raison, fin optionnelle, note, reprise
    │   │   ├── Rappels calendrier : événements, horaires, export ICS
    │   │   └── Charges automatiques + explication repliable
    │   ├── Repos et alertes
    │   │   ├── Son de fin de repos
    │   │   ├── Garder l’écran allumé
    │   │   ├── iOS : activité en direct + notification système de fin de repos
    │   │   ├── Android : suivi verrouillé + notifications + permission alarmes
    │   │   └── PWA : push ou alerte dans l’app selon disponibilité
    │   ├── Cibles nutritionnelles
    │   │   ├── Calories, créatine, protéines adaptées au poids ou fourchette fixe
    │   │   ├── Validation puis enregistrement des cibles
    │   │   ├── Ajustement calorique proposé / normalité des dernières semaines
    │   │   └── Calculs, précautions et références repliables
    │   ├── Apparence
    │   │   ├── Langue : automatique / Français / English
    │   │   ├── Thème : automatique / sombre / clair
    │   │   └── Accent : bleu / orange
    │   └── Données et confidentialité
    │       ├── Sauvegarde et restauration
    │       │   ├── Volumes enregistrés et dernier export
    │       │   ├── Exporter / importer avec aperçu
    │       │   └── Effacer les données avec confirmation
    │       └── Politique de confidentialité locale FR / EN
    ├── Sources scientifiques
    │   ├── Fréquence d’entraînement
    │   ├── Principes et limites
    │   └── Bibliographie complète et liens originaux
    ├── Outils avancés (replié)
    │   └── Aide IA facultative : partager, coller, vérifier, appliquer, historique
    └── À propos
        ├── Auteur, version et build
        ├── Code source et confidentialité
        └── Installation web / fonctionnement hors ligne
```

Les raccourcis contextuels mènent au même écran : ils ne créent pas une seconde configuration. Les réglages rarement modifiés quittent les journaux quotidiens. Aucun panneau de réglages n’est ajouté dans les cartes de séance.

## Règles de construction

- Un sujet par sous-page. Les six lignes du menu Réglages sont des destinations, jamais un mélange de champs et d’interrupteurs.
- Une action principale identifiée ; options secondaires et explications dans les composants `Disclosure` existants. Les valeurs, erreurs et actions nécessaires restent visibles.
- Même ligne de menu pour Plus et Réglages : illustration 32 px, libellé 15 px, aide 13 px et chevron. Header de page : illustration 64 px.
- Espacement partagé : marges latérales 16 px, sections 24 px, titre/contenu 12 px, espacement de champs 12 px. Un seul séparateur entre deux lignes.
- Fond neutre pour le contenu. Accent du thème pour sélection, progression et action principale. Pas de nouvelle palette par page.
- Cibles tactiles usuelles de 44 px minimum, saisies de 48 px et texte de champ 16 px. La grille compacte de dates reste une exception documentée ; pas les boutons précédent/suivant ou effacer.
- Les noms longs passent à la ligne. Dates et descriptions longues vont sous le libellé, jamais dans une valeur latérale qui l’écrase.
- Retour vers l’historique réel ; à défaut, parent logique. Le changement de route remet le scroll en haut et annonce le nouveau titre au clavier, sans voler le focus d’une feuille ouverte.
- Champs chiffrés : brouillon pour les ensembles liés, validation explicite, aucune sauvegarde partielle incohérente. Pas de bornes médicales arbitraires ajoutées.
- Destructif : conserver confirmations et séparation visuelle ; ne pas exécuter les actions destructives pendant la recette.

## Références

- [Apple — Settings](https://developer.apple.com/design/human-interface-guidelines/settings) : réglages généraux regroupés dans une zone dédiée.
- [Apple — Building a Settings bundle](https://developer.apple.com/documentation/foundation/building-a-settings-bundle-for-your-app) : groupes liés et pages enfants quand les options sont nombreuses. Le principe est adapté ici à l’interface embarquée ; Lift n’utilise pas un Settings.bundle.
- [Apple — Design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles) : hiérarchie, cohérence et accessibilité.
- [Apple — Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons) : cibles tactiles et tailles cohérentes.
- [Règles Lift](ui-patterns.md), [audit des pages](ui-audit-pages.md), [audit des réglages](ui-audit-settings.md), [audit des fondations](ui-audit-foundations.md).

## Recette

Les audits source recensent les constats initiaux. Le rapport de livraison doit distinguer les corrections, les parcours effectivement vérifiés et les limites de test sur appareil physique. Les captures de navigateur ne sont pas une preuve de validation Apple ni une capture sur iPhone réel.

## Vérification de livraison — 4 octobre 2026

- Hub Plus raccourci et six sujets Réglages implémentés ; les routes opérationnelles existantes restent accessibles.
- Journal nutrition et cibles séparés ; Programme et Sources scientifiques distincts ; informations longues repliables.
- Icône Apparence originale : interrupteur jour/nuit 3D, matériaux adaptés au thème, mouvement bref puis pause longue.
- Champs invalides bloqués ; la fourchette de poids requiert deux bornes ou aucune et se réinitialise quand le mode du plan change. Aucune migration des données.
- Focus de navigation, retours et feuille de date vérifiés dans Chrome. Confirmation de suppression d’une mesure testée puis annulée.
- Parcours principaux des nouveaux réglages vérifiés à402px en français sombre et320px en anglais clair ; couleur orange puis préférences initiales rétablies. Aucun débordement horizontal constaté sur les vues inspectées.
- Suite :214 tests réussis,0 échec,1 ignoré ; compilation web/typecheck réussis ;23 modèles GLB vérifiés.

Limites : l’audit de toutes les pages est fondé sur le code et les parcours décrits dans les rapports. La passe interactive couvre les vues modifiées ci-dessus ; elle ne certifie pas tous les états, VoiceOver ou tous les contrastes. Les opérations destructives, permissions, partage de données et restauration n’ont pas été exécutés. La capture physique pour App Review reste une étape distincte sur le dernier build installé.
