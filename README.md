# Intégrales YouTube Focus

Extension Chromium pour Arc sous Windows qui bloque les vidéos YouTube hors programme et affiche une intégrale à la place. La version courante est **1.0.4**.

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
- Analyse du titre, avec récupération d’informations complémentaires si le sujet reste incertain.
- 100 énoncés et 100 solutions intégrés.
- Boutons **Solution** et **Trouver une autre intégrale**.
- Recours conversationnel via Gemini ; une validation ne doit autoriser que la vidéo contestée.
- En cas d’erreur API ou de classification incertaine, l’accès reste bloqué.

## Structure

Les fichiers de l’extension sont tous à la racine, notamment `manifest.json`, `background.js`, `content.js`, `blocked.html`, `settings.html`, `popup.html`, `styles.css`, `rules.json`, `icons/` et les dossiers des énoncés, solutions et rendus.

Le guide complémentaire est dans [docs/INSTALLATION.md](docs/INSTALLATION.md).

## État des tests

Le dépôt vérifie la syntaxe JavaScript et la présence des ressources. Un essai réel dans Arc sous Windows avec ta clé Gemini reste nécessaire pour confirmer le comportement de classification et le déblocage.
