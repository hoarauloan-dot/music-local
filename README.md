# Loan's Music — version 0.3

Lecteur web personnel pour iPhone. Hébergement du code sur GitHub Pages ; audio et bibliothèque uniquement sur l’appareil. Aucun serveur de musique, dépendance externe, suivi publicitaire ou compte dans le lecteur.

## Mise à jour depuis la V0.1 ou V0.2

**Ne supprime ni l’icône de l’app, ni les données Safari, ni le dépôt.** Garde les originaux de tes musiques. Le domaine et le chemin doivent rester identiques.

1. Décompresse le ZIP sur ton PC.
2. Ouvre https://github.com/hoarauloan-dot/music-local
3. Add file → Upload files.
4. Envoie ensemble à la racine ces **8 fichiers** :
   - index.html
   - style.css
   - metadata.js
   - player.js
   - app.js
   - sw.js
   - manifest.webmanifest
   - icon.png
5. Clique Commit changes. Les quatre fichiers portant déjà ces noms sont remplacés et les quatre nouveaux sont ajoutés. README.md est facultatif.
6. Attends que le déploiement Pages soit terminé dans Actions. Aucun nouveau réglage Pages nécessaire.
7. Sur l’iPhone, ouvre ton lecteur AVEC Internet, laisse-le ouvert quelques instants, puis ferme et rouvre le lecteur. Si nécessaire, ferme aussi l’ancien onglet Safari. Une première ouverture peut encore montrer la version précédente pendant que le nouveau service worker s’installe.
8. Vérifie « Prêt hors ligne · Loan's Music 0.3 » dans la zone Stockage en bas. Le site reste à https://hoarauloan-dot.github.io/music-local/

La base IndexedDB garde son nom `music-local-v1`. Son schéma passe à 2, avec un nouveau store `playlists` ; les stores `tracks` et `files` sont conservés. Le nettoyage du cache de l’interface ne supprime pas cette bibliothèque. Ne pas changer de domaine ou d’emplacement pour éviter de changer d’espace de stockage.

## Ce qui change dans la version 0.3

- Accueil par défaut : carte automatique **Toutes les musiques** + toutes tes playlists personnelles.
- La collection Toutes les musiques suit les imports et suppressions automatiquement. Elle n’est pas supprimable ou renommable, les playlists personnelles le sont.
- Ouvre une playlist et touche sa pochette pour sélectionner une image depuis ton appareil. Les images sont réduites et conservées localement.
- Bouton **Ajouter des morceaux** dans chaque playlist : recherche et sélection multiple, sans devoir ouvrir les options de chaque morceau. Décocher un titre le retire de la playlist, pas de la bibliothèque.
- Onglet Recherche dans tous les titres, artistes et albums importés, sans tenir compte des accents. L’app ne peut pas parcourir tous les fichiers de l’iPhone sans que tu les importes.
- Mélange Fisher–Yates avec `crypto.getRandomValues` et tirage sans biais de modulo : chaque morceau une fois par passage. Si toute la file est répétée, un nouvel ordre est créé et le dernier morceau n’est pas immédiatement répété. Un ordre identique peut néanmoins se reproduire par hasard.
- Minuteur 15/30/60 minutes : pause à l’échéance tant que le navigateur exécute les événements. Une suspension iOS peut retarder son déclenchement. Il est réinitialisé lorsque l’app est fermée.
- Export individuel du fichier audio original via les options d’un morceau. Sur iPhone, l’enregistrement dépend de la présentation du téléchargement par Safari.
- Recherche rapide depuis l’accueil, favoris, file et reprise conservés.

### Logo et nom de l’icône iPhone

L’image jointe (alien noir avec casque, fond blanc) est intégrée telle quelle. Le site a un thème noir ; le fond blanc fait partie du logo fourni. Le nom et le logo de l’app sont déclarés dans le manifeste. iOS peut garder l’ancien nom ou l’ancienne icône pour un raccourci déjà ajouté : cela ne signifie pas que le site n’est pas à jour. **Ne supprime pas tes données pour forcer ce changement** ; vérifie d’abord la nouvelle interface dans l’app existante.

## Ce qui est développé

- Interface noire et blanche, nom Loan's Music et logo alien fourni, conservé sans modification.
- Titres, artistes, albums, playlists, favoris ; recherche et tri.
- Groupes d’albums par artiste + album pour éviter de fusionner les homonymes.
- Playlists persistantes : créer, renommer, supprimer ; ajouter / retirer / déplacer les titres.
- Informations éditables : titre, artiste et album ; les fichiers originaux ne sont pas réécrits.
- Lecture automatique de tags ID3 v2.3/v2.4 courants pour MP3, et tags iTunes pour M4A/MP4 : titre, artiste, album, pochette si compatible.
- Lecture de la durée à l’import lorsque Safari arrive à lire les métadonnées en six secondes, sinon lors de la lecture.
- Pochettes personnalisées JPEG/PNG/WebP, redimensionnées localement à 600 px ; maximum 8 Mo avant traitement.
- Pour les morceaux importés dans la V0.1 : bouton « Relire les tags du fichier » dans leurs options, puis Enregistrer.
- Mini-lecteur, écran complet, progression, favoris, aléatoire et répétition.
- File modifiable : monter/descendre, retirer un titre, lire ensuite, ajouter à la fin, vider les suivants. Chaque titre apparaît au plus une fois dans la file.
- Récemment écoutés, restauration de la file et de la position sans démarrage automatique.
- Suppression d’un morceau et de ses références aux playlists dans une même transaction.
- Export JSON du catalogue (informations et playlists, sans fichiers audio ni pochettes). Pas encore de restauration de cet export.
- Mode hors ligne et Media Session pour les commandes que le navigateur prend en charge.

## Limites à connaître

- Ce n’est pas une application native iOS. La lecture écran verrouillé, les commandes et les transitions doivent être testées sur le vrai iPhone.
- Les MP4 restent entiers. Cette version ne convertit pas les vidéos en audio et ne réduit pas leur taille.
- Import depuis Fichiers dans l’app ; pas d’extension de réception dans le menu Partager iOS.
- Pas de conversion universelle des codecs ni de gapless garanti.
- Tags ID3 v2.2, frames compressées / chiffrées et certaines variantes de métadonnées non prises en charge. Lecture bornée à 8 Mo pour les tags ; possibilité de renseigner les informations manuellement.
- Formats non compatibles : un fichier peut être ajouté mais échouer à la lecture, avec message d’erreur.
- Les pochettes ont leur propre coût de stockage, non inclus dans le compteur du poids des fichiers audio.
- L’export de catalogue n’est PAS une sauvegarde de tes musiques.
- Effacer les données du site, changer de domaine, ou certaines contraintes de stockage peuvent rendre les fichiers locaux indisponibles. Garde les originaux. Safari et l’app installée peuvent avoir des stockages distincts.
- Doublons détectés seulement par nom, taille et date du fichier.

## Essais conseillés après mise à jour

0. Vérifier l’accueil Loan's Music noir, la carte Toutes les musiques, le logo, puis créer une playlist, toucher sa photo et ajouter plusieurs titres. Tester la recherche « ete » pour un titre « Été ».


1. Vérifier que les imports et favoris V0.1 sont toujours présents.
2. Importer un MP3 avec tags et un M4A ; contrôler titre/artiste/album/pochette/durée.
3. Créer une playlist, ajouter deux titres avec ⋯, changer leur ordre et la renommer.
4. Fermer puis rouvrir : contrôler la playlist, les morceaux, la file et la position.
5. Tester l’ordre de la file, « Lire ensuite », la répétition, les favoris et une pochette manuelle.
6. Vérifier lecture + transition au suivant écran verrouillé, les AirPods et le mode avion.
7. Supprimer une playlist de test : ses morceaux doivent rester dans Titres.
8. Supprimer un morceau de test : ses références doivent disparaître des playlists.

## Vérifications réalisées ici

- Syntaxe JavaScript et structure des fichiers.
- Tests de tags synthétiques MP3/M4A, tags invalides.
- Tests dans un DOM simulé : recherche, regroupements, playlists, édition, file et migration des stores existants.
- Tests du cache hors ligne dans un environnement simulé.
- V0.3 : tests d’accueil, recherche avec accents, conservation des pochettes, collection automatique et 500 permutations sans doublons ; chaque ordre possible de trois titres a été observé. Ces tests ne constituent pas une preuve statistique générale.

Pas de test dans un navigateur graphique, dans Safari ni sur iPhone dans cet environnement. Ces vérifications ne remplacent pas les essais réels ci-dessus. Les fichiers ont été préparés, pas publiés dans ton dépôt automatiquement.

## Organisation du code

| Fichier | Rôle |
| --- | --- |
| index.html | Structure des écrans et styles de base |
| style.css | Interface noire de Loan's Music |
| player.js | Stockage, import, moteur audio et commandes système |
| metadata.js | Lecture de tags et réduction des pochettes |
| app.js | Bibliothèque, playlists, file et restauration de session |
| sw.js | Cache des fichiers de l’interface, version v3 |
| manifest.webmanifest | Installation comme web app |
| icon.png | Icône |

Pour chaque future modification du code, incrémenter la version du cache dans sw.js. Garder le nom de la base IndexedDB et prévoir une migration lors d’un changement de schéma.
