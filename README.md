# Loan’s Music — 0.4

Lecteur web personnel noir, sans compte, publicité ni envoi de musique. Les fichiers audio et les playlists restent dans IndexedDB sur l’appareil. Ce projet est une application web installable ; ce n’est pas une application native App Store.

## Mise à jour depuis Windows

1. Extraire le ZIP.
2. Dans le dépôt GitHub `hoarauloan-dot/music-local`, choisir **Add file → Upload files**.
3. Envoyer les **9 fichiers de l’application** à la racine, sans dossier intermédiaire. `README.md` est facultatif.
4. Valider **Commit changes**, puis attendre la fin du déploiement Pages.
5. Ouvrir l’application avec Internet, la fermer puis la rouvrir. Dans ⚙ Paramètres, vérifier **Loan’s Music 0.4**. Le bouton de recherche de mise à jour est dans les paramètres.

Conserver le même site et ne pas effacer les données Safari. La base `music-local-v1`, ses stores et sa version restent identiques : la mise à jour ne supprime ni les morceaux, ni les playlists, ni leurs photos. Conserver les fichiers originaux séparément.

## Utilisation

- **Accueil** : importer des fichiers et consulter Titres / Artistes / Albums.
- **Playlists** : retrouver Toutes les musiques, Favoris et ses playlists ; bouton Créer.
- **Dans une playlist → Ajouter** : cocher plusieurs sons puis Ajouter (nombre). Les sons déjà présents sont grisés. Changer de recherche conserve la sélection. L’ajout ne retire aucun ancien son.
- **Dans une playlist → ⋯** : renommer, retirer plusieurs sons ou supprimer la playlist (les fichiers restent dans la bibliothèque).
- **Photo** : toucher la pochette de la playlist pour la changer.
- **Sur un son → ⋯** : ajouter à une playlist, gérer le favori, lire ensuite ou modifier les informations.
- **Recherche** : accepte `ndji`, `N’Dji`, `N'DJI`, les accents, espaces et différents signes de ponctuation. Recherche les mots dans n’importe quel ordre, dans les titres, artistes, albums et noms de fichiers importés. Ce n’est pas une recherche sur Internet ni une correction de toutes les fautes de frappe.
- **Lecture** : mini-lecteur fixe au-dessus du menu ; toucher le titre ou la pochette pour ouvrir le lecteur plein écran. Toucher le son déjà en lecture ouvre aussi ce lecteur sans redémarrer la musique.
- **Paramètres** : minuteur, occupation locale, état hors ligne, export du catalogue, mise à jour et aide.

L’artiste est lu dans les tags compatibles. Sans artiste, le début d’un titre de forme `Artiste - Morceau` est utilisé pour l’affichage. Cette déduction peut être imparfaite ; les informations restent modifiables. Sinon, le texte affiché est « le son lé en 🧨 ». Aucun fichier musical n’est réécrit.

Le mélange utilise Fisher–Yates et le générateur cryptographique du navigateur. Un morceau apparaît une fois par passage ; la répétition de la file remélange et évite une répétition immédiate à la jonction.

## Logo iPhone

Le logo alien fourni est conservé sans modification. `apple-touch-icon.png` le déclare pour l’écran d’accueil, et `icon.png` pour le manifeste. Lors d’un nouvel ajout depuis Safari → Partager → Sur l’écran d’accueil, vérifier l’aperçu du logo. Une icône déjà installée peut conserver son ancienne image : ne pas effacer les données ni supprimer l’installation utilisée pour forcer un changement. Safari et une application installée peuvent avoir des bibliothèques distinctes.

## Fichiers

- `index.html` : écrans, panneaux et configuration iPhone.
- `style.css` : interface, menu fixe, mini-lecteur et lecteur plein écran.
- `player.js` : IndexedDB, import, audio, contrôles multimédia.
- `metadata.js` : lecture locale des tags et des pochettes compatibles.
- `app.js` : navigation, recherche, playlists, sélection multiple et paramètres.
- `sw.js` : cache hors ligne de l’interface, version 4.
- `manifest.webmanifest` : identité de l’application installable.
- `icon.png` et `apple-touch-icon.png` : logo fourni.

## Vérification et limites

Vérifié : syntaxe JavaScript, cohérence des identifiants HTML, logique dans un DOM simulé (recherche, ajout multiple avec filtrage, conservation et relecture des playlists, retrait multiple, création, pochettes, navigation, artiste de remplacement), permutations aléatoires, conservation du schéma de base, cache hors ligne et isolation de son nettoyage. Pas de test visuel dans Safari ni sur un iPhone réel dans l’environnement de développement.

À vérifier après déploiement : lecteur sans débordement sur l’iPhone, navigation fixe, ajout de deux sons dans une playlist, fermeture/réouverture, lecture écran verrouillé, puis mode avion.

La continuité de lecture en arrière-plan dépend de Safari/iOS. MP4 : le fichier entier reste stocké, sans extraction audio. Import par le sélecteur Fichiers, pas de réception par une extension Partager. Les tags non reconnus se modifient à la main. L’export du catalogue contient les informations et les playlists, sans audio ni pochettes, et ne constitue pas une sauvegarde restaurable. L’arrêt par minuteur peut être retardé si iOS suspend la page. Les données locales peuvent être effacées par l’utilisateur ou le navigateur.
