# Music local — prototype web 0.1

Lecteur personnel conçu pour un premier essai sur iPhone. Le site et son code sont publics ; les morceaux importés sont enregistrés uniquement dans IndexedDB sur l’appareil. Aucun analytics, dépendance externe ou téléversement de musique. Aucun compte utilisateur dans le lecteur.

## Déposer sur GitHub

1. Décompresser `Music-local-web-0.1.zip`.
2. Ouvrir https://github.com/hoarauloan-dot/music-local
3. Cliquer sur **Add file → Upload files**.
4. Déposer les quatre fichiers **index.html**, **sw.js**, **manifest.webmanifest**, **icon.png**, directement à la racine du dépôt. Ne pas déposer le ZIP ni le dossier qui les contient. README.md est facultatif et peut remplacer celui du dépôt.
5. Cliquer **Commit changes** pour enregistrer dans la branche principale.
6. Ouvrir **Settings → Pages** (sur mobile, Settings peut être dans le menu `…`).
7. Sous **Build and deployment**, choisir **Deploy from a branch**. Choisir **main** et **/ (root)**, puis **Save**. Si la branche principale porte un autre nom, sélectionner celle où se trouvent les fichiers.
8. Attendre la réussite du déploiement, visible dans l’onglet Actions / la page Pages.
9. Ouvrir l’adresse affichée par GitHub Pages, normalement https://hoarauloan-dot.github.io/music-local/

Ce lien est l’adresse attendue, pas un déploiement déjà réalisé ou vérifié. Le dépôt n’a pas été modifié depuis cet environnement.

## Tester sur l’iPhone

1. Ouvrir le site dans **Safari**.
2. Partager → **Sur l’écran d’accueil** → Ajouter (activer « Ouvrir comme app web » si proposé).
3. Lancer **Music local depuis cette icône**, puis attendre **Prêt hors ligne**.
4. Importer deux petits MP3 depuis Fichiers. Commencer par des fichiers connus et lisibles.
5. Lire le premier, avancer à quelques secondes de la fin, verrouiller l’écran et vérifier le passage au suivant.
6. Tester pause/reprise et suivant/précédent depuis l’écran verrouillé, puis les AirPods.
7. Fermer le lecteur, activer le mode avion, le rouvrir depuis l’icône et vérifier bibliothèque + lecture.

Ne pas importer toute sa collection avant ces essais. Safari et l’app d’écran d’accueil peuvent avoir des stockages distincts. Garder les originaux : les copies peuvent disparaître après suppression des données du site ou sous certaines contraintes de stockage. La demande de stockage persistant est soumise au navigateur.

## Fonctions présentes

- Import MP3, M4A, WAV, MP4 ; la lecture dépend du codec accepté par Safari.
- Copies locales persistantes ; import séquentiel, erreurs de stockage affichées.
- Détection simple des doublons par nom, taille et date (pas une comparaison du contenu).
- Recherche, favoris, édition du titre et de l’artiste, suppression confirmée.
- Mini-lecteur, écran de lecture, progression, précédent/suivant.
- File issue de la liste lancée, aléatoire et répétition arrêt/file/titre.
- Intégration Media Session lorsque disponible.
- Cache des fichiers de l’interface pour l’ouverture hors ligne.

## Limites assumées de ce premier jalon

- Les métadonnées intégrées et pochettes ne sont pas encore lues ; le nom du fichier devient le titre.
- Pas encore de playlists, classement Artistes/Albums ou réordonnancement de la file.
- MP4 conservé en entier : pas d’extraction audio ni de gain de stockage dans ce prototype.
- Pas de réception via le menu Partager iOS ; utiliser Importer dans le lecteur.
- Pas de restauration de la file ou de la position après fermeture.
- Pas d’export/sauvegarde de bibliothèque dans cette version.
- Un fichier peut être importé même si son codec est illisible ; l’erreur est signalée à la lecture.
- La continuité audio en arrière-plan dépend de Safari/iOS et reste à valider sur le vrai iPhone. Le prochain fichier est préparé pendant la lecture, sans garantie de fonctionnement écran verrouillé.

## Vérification effectuée

Syntaxe JavaScript, manifest, références de fichiers et archive vérifiés. Tests de logique de file/répétition et du service worker effectués avec un environnement simulé. Aucun test réel dans Safari, sur iPhone ou dans un navigateur graphique n’a été effectué ici.

## Mises à jour futures

Après modification des fichiers, changer la version du cache dans sw.js (`v1` → `v2`, etc.) avant publication. Le cache de l’interface est distinct de la bibliothèque IndexedDB et son renouvellement ne doit pas effacer les morceaux. Garder le même domaine et le même chemin pour conserver l’accès au stockage local.
