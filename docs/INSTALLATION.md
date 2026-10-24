# Installation sur Arc (Windows)

## 1. Récupérer les fichiers

Tu peux installer depuis le ZIP ou depuis le code source du dépôt.

- **Depuis le ZIP :** télécharge `releases/Integrales_YouTube_Focus_v1.0.3.zip` puis décompresse-le. Le dossier de l'extension est `integrales_ytb_extension/`.
- **Depuis le dépôt :** télécharge le dépôt en ZIP, décompresse-le, puis utilise le dossier `extension/` qui contient `manifest.json`.

## 2. Charger l'extension

1. Ouvre Arc.
2. Navigue vers `arc://extensions`.
3. Active **Mode développeur**.
4. Clique sur **Charger l'extension non empaquetée**.
5. Sélectionne le dossier contenant directement `manifest.json` — pas le dossier parent du projet.

## 3. Configurer Gemini

1. Ouvre les paramètres de l'extension.
2. Saisis ta clé API Gemini.
3. Utilise le bouton de test de connexion.
4. Enregistre les paramètres.

Ne partage pas ta clé et ne la committe pas dans GitHub. En cas d'absence de clé, d'échec réseau ou de réponse ambiguë, le comportement prévu est de conserver le blocage.

## 4. Vérifications après installation

Teste ces cas sans lancer de contenu sensible :
- ouvrir une vidéo YouTube depuis l'accueil ;
- ouvrir une URL YouTube directe et un Short ;
- ouvrir une vidéo dans un nouvel onglet ;
- tester une vidéo manifestement éducative et une vidéo hors programme ;
- envoyer une justification recevable puis une justification insuffisante ;
- vérifier que Netflix et les autres sites non YouTube ne sont pas visés.

## Dépannage

- **L'extension ne se charge pas :** vérifie que le dossier sélectionné contient directement `manifest.json`.
- **Gemini ne répond pas :** vérifie la clé API, le modèle configuré et la connexion réseau.
- **La vidéo reste bloquée après un recours accepté :** recharge l'extension depuis `arc://extensions`, puis reteste ; rapporte le cas avec les erreurs de la console si nécessaire.
