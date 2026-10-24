# Intégrales YouTube Focus

Extension personnelle pour Arc sous Windows : lorsqu'une vidéo YouTube ne semble pas liée à une matière scolaire autorisée, elle est remplacée par une page de travail avec une intégrale. Une justification validée par Gemini peut autoriser **cette vidéo uniquement**.

> **État du projet :** première version organisée du dépôt. L'extension doit encore être testée dans Arc avec une vraie clé Gemini avant d'être considérée comme validée en conditions réelles.

## Contenu du dépôt

```text
.
├── .github/
│   └── workflows/
│       └── publish-extension-source.yml  # extrait la source du paquet
├── docs/
│   └── INSTALLATION.md                   # guide d'installation
├── extension/                            # code source prêt à charger dans Arc
│   ├── manifest.json
│   ├── background.js
│   ├── content.js
│   ├── blocked.html
│   ├── blocked.js
│   ├── settings.html
│   ├── settings.js
│   ├── popup.html
│   ├── popup.js
│   ├── styles.css
│   ├── rules.json
│   ├── icons/
│   └── assets/
├── releases/
│   └── Integrales_YouTube_Focus_v1.0.3.zip
└── README.md
```

Le dossier `extension/` est généré depuis l'archive versionnée dans `releases/` par GitHub Actions. Les PDF originaux et les rendus utilisés par l'interface sont conservés dans ce dossier.

## Installation rapide

1. Ouvre [la dernière archive disponible](releases/Integrales_YouTube_Focus_v1.0.3.zip) ou télécharge le dépôt.
2. Décompresse le ZIP, puis ouvre `arc://extensions` dans Arc.
3. Active le **Mode développeur**.
4. Clique sur **Charger l’extension non empaquetée** et sélectionne le dossier `integrales_ytb_extension` (depuis l’archive) ou le dossier `extension/` (depuis le dépôt organisé), selon la version téléchargée.
5. Ouvre les paramètres de l'extension, ajoute ta clé API Gemini et teste la connexion.

## Fonctionnement prévu

- Les matières autorisées comprennent les mathématiques, les maths expertes, la physique, l'enseignement scientifique, la littérature anglaise, l'espagnol, la philosophie, la géographie, l'histoire et l'enseignement moral et civique.
- L'extension analyse le titre en premier et ne demande des informations supplémentaires que si nécessaire.
- Une intégrale est sélectionnée aléatoirement dans les 100 exercices fournis.
- Le bouton **Solution** remplace l'énoncé par la correction.
- Le bouton **Trouver une autre intégrale** sélectionne un autre exercice.
- Le recours Gemini doit accorder une exception uniquement pour la vidéo contestée. En cas d'erreur ou de réponse incertaine, l'accès reste refusé.

## Confidentialité et configuration

La clé Gemini doit être configurée localement dans la page de paramètres. Ne la publie jamais dans le dépôt ni dans une capture d'écran. Les informations envoyées au service sont limitées au nécessaire pour classifier la vidéo et évaluer la justification.

## Documentation

Consulte [le guide d'installation détaillé](docs/INSTALLATION.md).

## Limites de validation

Les contrôles locaux du paquet ne remplacent pas un test réel dans Arc sous Windows. Vérifie notamment les navigations vers une vidéo, les Shorts, l'ouverture en nouvel onglet, le recours Gemini et le refus d'accès lorsque l'API ne répond pas.
