# Market Master

Prototype web multijoueur inspire de RentGuessr, GeoGuessr et The Price is Right.

## Lancer

```bash
npm start
```

Puis ouvrir :

```text
http://localhost:4173
```

## Inclus dans le MVP

- Creation et rejointure de salon prive par code.
- Jusqu'a 20 joueurs en memoire cote serveur.
- Manches chronometrees avec prix masque.
- Plusieurs categories d'annonces, avec filtre obligatoire sur les annonces ayant au moins une image.
- Modes Classique, Chaos, Blitz et Expert.
- Calcul proportionnel du score : `max(0, 100 - pourcentage_d_erreur)`.
- Bonus de victoire et argent virtuel.
- Classement de manche et classement final.
- Joueurs de demonstration pour tester vite dans un seul navigateur.
- Selection aleatoire avec memoire par salon pour reduire fortement les repetitions.

## Source des annonces

Par defaut, le jeu exige un flux reel autorise. Le catalogue demo interne est desactive, donc si le statut indique `realFeedActive: false`, aucune partie ne demarre.

Le catalogue demo existe uniquement pour les tests techniques et ne s'active que si vous lancez le serveur avec :

```powershell
$env:ALLOW_DEMO_LISTINGS = "true"
npm start
```

Avant une mise en production avec Leboncoin, SeLoger, Bien'ici, Vinted, eBay, Facebook Marketplace ou une autre plateforme, il faut verifier les conditions d'utilisation et privilegier les API officielles, les partenariats ou les jeux de donnees autorises.

## Brancher un flux Leboncoin autorise

Le prototype propose trois façons d'alimenter le catalogue réel :

- Import automatique par lien Leboncoin depuis l'interface.
- Import par HTML depuis l'interface si Leboncoin renvoie HTTP 403 au serveur.
- Import manuel depuis l'interface si la lecture automatique est bloquee.
- Flux JSON autorise via `LISTINGS_FEED_URL` ou fichier local via `LISTINGS_FEED_FILE`.

L'import automatique lit seulement les metadonnees publiques accessibles normalement depuis la page fournie par l'utilisateur. Il ne contourne pas les protections du site, les captchas, les restrictions anti-bot ou les API privees.

Si l'import par lien renvoie HTTP 403, ouvrez l'annonce dans votre navigateur, affichez le code source (`Ctrl+U`), copiez tout (`Ctrl+A`, `Ctrl+C`) et collez-le dans "Import par HTML".

Le flux doit etre un tableau JSON ou un objet `{ "listings": [] }` au format :

```json
{
  "id": "lbc-123",
  "source": "Leboncoin - flux autorise",
  "category": "Vehicules",
  "title": "Titre de l'annonce",
  "description": "Description partielle",
  "images": ["https://..."],
  "location": "Ville ou region approximative",
  "metadata": {
    "Marque": "Renault",
    "Annee": "2020"
  },
  "actual_price": 12500
}
```

Seules les annonces ayant un prix valide et au moins une image sont conservees.

Exemple PowerShell :

```powershell
$env:LISTINGS_FEED_URL = "https://votre-domaine.example/listings.json"
npm start
```

Exemple avec un fichier local :

```powershell
$env:LISTINGS_FEED_FILE = "C:\chemin\vers\listings.json"
npm start
```

Pour verifier l'etat du catalogue :

```text
http://localhost:4173/api/listings/status
```

## Mettre cette V1 en ligne

Oui, cette version peut etre jouee a distance avec un autre joueur si elle est deployee sur un hebergeur Node.js.

Le serveur utilise automatiquement `process.env.PORT` et ecoute sur `0.0.0.0`, ce qui convient aux plateformes comme Render, Railway ou Fly.io. Une route de verification est disponible :

```text
/health
```

### Option simple : Render

1. Pousser ce dossier dans un depot GitHub.
2. Creer un nouveau Web Service sur Render.
3. Selectionner le depot GitHub.
4. Si le depot contient plusieurs dossiers, definir le Root Directory sur `outputs/market-master`.
5. Build Command : `npm install`
6. Start Command : `npm start`
7. Variables :
   - `NODE_ENV=production`
   - `ALLOW_DEMO_LISTINGS=false`
   - `DATABASE_URL=<url PostgreSQL>`
   - `ADMIN_EMAIL=<email du compte admin>`
   - `ADMIN_USERNAME=MMADMIN`

### Persistance des annonces sur Render

Render ne garantit pas la conservation des fichiers crees par l'application sur le disque local. Si le jeu sauvegarde les annonces uniquement dans `data/leboncoin-listings.json`, elles peuvent disparaitre apres un redeploiement ou un redemarrage.

Pour garder les annonces importees, les comptes, l'argent et les tickets d'or :

1. Creer une base PostgreSQL sur Render, Supabase, Neon ou Railway.
2. Copier l'URL de connexion PostgreSQL.
3. Ajouter cette URL dans les variables d'environnement du service Render :
   - cle : `DATABASE_URL`
   - valeur : l'URL PostgreSQL complete
4. Redeployer le service.
5. Verifier `https://votre-site.onrender.com/api/listings/status`.

Quand la base est bien branchee, le statut indique :

```json
{
  "storage": "postgresql",
  "persistentOnRender": true
}
```

Sans `DATABASE_URL`, le serveur reste compatible localement mais le statut indique `storage: "server-file"`, ce qui n'est pas fiable sur Render.

### Compte admin

Ne mettez pas l'email admin dans le code source. Configurez-le uniquement dans les variables d'environnement du serveur :

```text
ADMIN_EMAIL=<email du compte admin>
ADMIN_USERNAME=MMADMIN
```

Le navigateur ne reçoit qu'un indicateur `isAdmin` apres connexion. L'adresse admin reste donc une configuration privee du serveur.

Le fichier `render.yaml` est deja inclus pour faciliter un deploiement Blueprint.

### Option rapide : Railway

1. Creer un projet Railway.
2. Deployer depuis GitHub.
3. Si necessaire, definir le dossier racine sur `outputs/market-master`.
4. Railway detecte le projet Node via `package.json`.
5. Start Command : `npm start`

Le fichier `railway.json` est deja inclus.

### Important pour cette V1

- Les salons et joueurs sont en memoire serveur : il faut une seule instance active.
- Si le serveur redemarre, les salons en cours disparaissent.
- Les annonces importees et les comptes sont sauvegardes dans PostgreSQL si `DATABASE_URL` est configure. Sinon, ils restent sauvegardes en fichiers locaux pour le developpement.
- Pour une vraie production, il faudra aussi Redis pour les salons actifs.

## Evolution technique recommandee

- Remplacer le polling HTTP par Socket.IO.
- Ajouter PostgreSQL pour les comptes, statistiques et annonces.
- Ajouter Redis pour les salons actifs, sessions et matchmaking.
- Isoler un `listing-service` charge de normaliser les annonces.
- Ajouter authentification email, Google et Discord.
