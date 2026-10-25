# Intégrales YouTube Focus

Extension Chromium pour Arc sous Windows qui vérifie les vidéos YouTube avant de décider si elles sont liées aux matières autorisées ; une intégrale apparaît seulement pour les vidéos considérées hors sujet après vérification. La version courante est **1.0.9**.

## Télécharger et installer — une seule méthode

1. Sur cette page GitHub, clique sur **Code → Download ZIP**.
2. Décompresse l’archive sur Windows.
3. Ouvre `arc://extensions` dans Arc et active le **Mode développeur**.
4. Clique sur **Charger l’extension non empaquetée**.
5. Sélectionne le dossier décompressé qui contient directement `manifest.json`.

**Important :** il ne faut pas chercher un sous-dossier `extension/` ni télécharger une archive dans `releases/`. Les fichiers nécessaires à Arc sont à la racine du dépôt. Le ZIP généré par **Code → Download ZIP** contient directement le manifeste à cet endroit.

## Configuration Gemini

1. Ouvre les paramètres de l’extension.
2. Colle ta clé API Gemini.
3. Dans le champ **Identifiant du modèle Gemini**, saisis le modèle de ton choix. La valeur par défaut est `gemini-3.5-flash-lite`.
4. Clique sur **Tester la connexion**, puis sur **Enregistrer**.

La clé API est conservée dans le stockage local de l’extension ; ne la publie jamais dans GitHub.

## Fonctionnalités

- Matières autorisées : mathématiques, maths expertes, physique, enseignement scientifique, littérature anglaise, espagnol, philosophie, géographie, histoire et enseignement moral et civique.
- Vérification Gemini avant l’ouverture : une vidéo pertinente s’ouvre directement ; si le titre ne suffit pas, la description et la transcription sont examinées avant blocage.
- Après une validation, la page d’intégrales est remplacée dans l’historique par la vidéo ; le bouton Retour ne devrait donc pas revenir à cette intégrale.
- Le clic ouvre une page de vérification légère, sans intégrale : elle se remplace par la vidéo si Gemini l’approuve, ou par la page d’intégrales si Gemini la refuse. Cela évite de dépendre du callback du clic YouTube initial.
- Les vidéos déjà approuvées restent autorisées dans l’onglet pendant la session, pour éviter de rebloquer la vidéo précédente lors d’un retour arrière.
- Le contenu n’a pas besoin d’être strictement au programme : approfondissements, niveau supérieur et culture générale liés à une matière sont autorisés.
- Le filtrage vise les pages YouTube elles-mêmes, pas les vidéos YouTube intégrées dans des pages d’autres sites.
- 100 énoncés et 100 solutions intégrés.
- Boutons **Solution** et **Trouver une autre intégrale**.
- Recours conversationnel via Gemini ; une validation ne doit autoriser que la vidéo contestée.
- En cas d’erreur API ou si aucun lien avec une matière ne peut être établi après vérification, l’accès reste bloqué et le recours reste disponible.

## Structure

Les fichiers de l’extension sont tous à la racine, notamment `manifest.json`, `background.js`, `content.js`, `checking.html`, `checking.js`, `blocked.html`, `settings.html`, `popup.html`, `styles.css`, `rules.json`, `icons/` et les dossiers des énoncés, solutions et rendus.

Le guide complémentaire est dans [docs/INSTALLATION.md](docs/INSTALLATION.md).

## État des tests

Vérifications statiques : syntaxe JavaScript, validité JSON, fichiers d’installation et présence des 100 énoncés, des 100 solutions et des 200 rendus PNG. Un essai réel dans Arc sous Windows avec ta clé Gemini reste nécessaire pour confirmer le comportement de classification et le déblocage.
