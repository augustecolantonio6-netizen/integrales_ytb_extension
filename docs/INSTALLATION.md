# Installation sur Arc (Windows)

## Télécharger le dépôt

1. Ouvre la page du dépôt : https://github.com/augustecolantonio6-netizen/integrales_ytb_extension
2. Clique sur **Code → Download ZIP**.
3. Dans l’Explorateur de fichiers, clique droit sur le ZIP et choisis **Extraire tout**.

Le dossier extrait doit contenir directement `manifest.json`, `background.js`, `content.js`, `checking.html`, `checking.js`, `blocked.html` et `settings.html`.

**Ne cherche pas de dossier `extension/` et n’utilise pas une archive provenant d’une ancienne version.** Le dépôt est organisé pour que sa racine soit elle-même le dossier installable.

## Charger l’extension

1. Ouvre Arc.
2. Va à `arc://extensions`.
3. Active **Mode développeur**.
4. Clique sur **Charger l’extension non empaquetée**.
5. Sélectionne le dossier extrait qui contient directement `manifest.json`.

Si Arc indique que le manifeste est introuvable, tu as probablement sélectionné le ZIP lui-même ou le mauvais dossier : choisis le dossier décompressé dont le premier niveau contient `manifest.json`.

## Configurer Gemini

1. Ouvre les paramètres de l’extension.
2. Colle ta clé API Gemini, puis saisis le modèle à utiliser. Le modèle par défaut est `gemini-3.5-flash-lite`.
3. Clique sur **Tester la connexion**.
4. Clique sur **Enregistrer**.

Le nom du modèle doit être un identifiant accepté par l’API et accessible avec ta clé. La clé ne doit jamais être publiée dans le dépôt.

## Tester le fonctionnement

- Au clic, un écran léger **Vérification de la vidéo** doit s’afficher. Si Gemini autorise la vidéo, il doit se remplacer par l’URL YouTube `/watch?v=…` ; la page d’intégrales ne doit apparaître que si la vidéo est refusée.
- Essaie une vidéo de maths clairement pédagogique, puis un documentaire historique.
- Vérifie les recommandations, Shorts et liens directs.
- Ouvre **Justifier l’erreur** et teste une justification recevable : après acceptation, la page doit se remplacer par la vidéo originale.
- Sur la page d’intégrales, utilise **Trouver une autre intégrale**, puis le bouton Retour : les changements d’exercice ne doivent pas créer d’entrées d’historique supplémentaires.
- Vérifie que les sites qui ne sont pas YouTube ne sont pas bloqués.

Si l’écran de vérification ne se ferme pas, le navigateur a dû rencontrer une erreur de navigation ou de service worker : note le message affiché, puis recharge la page. Si une vidéo scolaire est encore bloquée, note le titre et le message de Gemini. Une connexion API réussie ne garantit pas que la classification du sujet soit correcte.
