# Les Fous de la Contrée

Application pour compter les points à la contrée et suivre les statistiques de chaque joueur sur la durée.
Elle s'installe sur iPhone et Android depuis le navigateur (« Ajouter à l'écran d'accueil »), sans store.
Les scores sont enregistrés sur le téléphone puis synchronisés sur un serveur gratuit (Supabase),
ce qui permet à tout le groupe de voir les mêmes profils, parties et statistiques.

Coût : 0 €. Temps d'installation : environ 20 minutes, une seule fois, par une seule personne.

---

## Vue d'ensemble

```
 Téléphone A ─┐                         ┌─ Supabase (base de données gratuite)
 Téléphone B ─┼── app web (GitHub Pages)┤   tables protégées, accès par code de groupe
 Téléphone C ─┘                         └─
```

- **GitHub Pages** héberge les fichiers de l'application (gratuit).
- **Supabase** stocke les données du groupe (gratuit jusqu'à 500 Mo, très largement suffisant).
- Chaque téléphone garde une copie locale : on peut saisir des donnes sans réseau, elles partent dès que le réseau revient.

---

## Étape 1 — Créer la base de données (Supabase)

1. Allez sur <https://supabase.com> et créez un compte (le plus simple : « Continue with GitHub » une fois l'étape 2 faite, ou avec votre e-mail).
2. Cliquez **New project**.
   - *Name* : `fous-de-la-contree`
   - *Database Password* : générez-en un et gardez-le de côté (l'application n'en a pas besoin).
   - *Region* : une région en Europe, par exemple **West EU (Paris)**.
   - Validez avec **Create new project**, puis attendez 1 à 2 minutes.
3. Dans le menu de gauche, ouvrez **SQL Editor**, puis **New query**.
4. Ouvrez le fichier `supabase/schema.sql` de ce dossier, copiez **tout** son contenu, collez-le, puis cliquez **Run**.
   Le message attendu est « Success. No rows returned ».
5. Récupérez les deux informations de connexion. Cliquez sur le bouton **Connect** en haut de la page, ou allez dans **Project Settings → API Keys** :
   - **Project URL**, du type `https://abcdefghijkl.supabase.co` ;
   - la clé **publishable**, qui commence par `sb_publishable_…`. Si vous ne voyez que l'ancien format, prenez la clé **anon public**, qui commence par `eyJ…`.

   ⚠️ Ne prenez jamais la clé **secret** ou **service_role**.

## Étape 2 — Renseigner la configuration

Ouvrez `js/config.js` avec un éditeur de texte (Bloc-notes, TextEdit en mode texte brut, VS Code…) et complétez-le :

```js
window.CONTREE_CONFIG = {
  supabaseUrl: 'https://abcdefghijkl.supabase.co',
  supabaseKey: 'sb_publishable_xxxxxxxxxxxxxxxx',
};
```

C'est le seul fichier à modifier.

## Étape 3 — Mettre l'application en ligne (GitHub Pages)

1. Créez un compte sur <https://github.com> si besoin.
2. Cliquez **+ → New repository**.
   - *Repository name* : `fous-de-la-contree`
   - Laissez **Public** (obligatoire pour GitHub Pages gratuit).
   - Validez avec **Create repository**.
3. Sur la page du dépôt vide, cliquez **uploading an existing file**.
   Glissez-déposez **le contenu** du dossier : `index.html`, `manifest.webmanifest`, `sw.js`, `README.md`, ainsi que les dossiers `css`, `js`, `fonts`, `icons`, `supabase` et `tests`. Cliquez ensuite **Commit changes**.
4. Allez dans **Settings → Pages**.
   - *Source* : **Deploy from a branch**
   - *Branch* : **main**, dossier **/ (root)**
   - Cliquez **Save**.
5. Après 1 à 2 minutes, l'adresse s'affiche en haut de cette page : `https://VOTRE-PSEUDO.github.io/fous-de-la-contree/`.

> Le dépôt étant public, `config.js` est visible de tous. Ce n'est pas un problème : la clé publique ne donne accès qu'aux 4 fonctions prévues, et chacune exige le **code du groupe**. C'est ce code qu'il faut garder entre joueurs.

## Étape 4 — Installer sur les téléphones

Ouvrez l'adresse obtenue à l'étape 3 sur chaque téléphone :

- **iPhone (Safari)** : bouton **Partager**, puis **Sur l'écran d'accueil**.
- **Android (Chrome)** : menu **⋮**, puis **Installer l'application** ou **Ajouter à l'écran d'accueil**.

L'icône « Fous Contrée » apparaît alors comme une application normale.

## Étape 5 — Créer le groupe et inviter les joueurs

1. Sur votre téléphone : **Créer un groupe** avec un nom. Un code de 8 caractères est créé.
2. Onglet **Groupe → Inviter** : envoyez le lien par SMS ou WhatsApp. Le lien ouvre l'app avec le code déjà rempli. Le code peut aussi se saisir à la main via **Rejoindre un groupe**.
3. Créez les profils des joueurs (onglet **Joueurs**), avec une photo si vous voulez.

---

## Utilisation

- **Nouvelle partie** : touchez 4 joueurs. Les deux premiers forment les Bleus, les deux suivants les Rouges. Vous pouvez aussi tirer les équipes au sort. Choisissez ensuite le score à atteindre.
- **Nouvelle donne**, après chaque main, indiquez :
  - le preneur, l'annonce et la couleur ;
  - le contre et le surcontre éventuels ;
  - les points comptés, par l'attaque ou par la défense au choix ;
  - le capot et la belote.

  Le résultat s'affiche avant d'enregistrer.
- Touchez une donne pour la **corriger** ou la **supprimer**. Juste après l'enregistrement, le bouton **Annuler** l'efface.
- La partie se termine automatiquement quand une équipe atteint le score. Si les deux le dépassent sur la même donne, la plus haute gagne. En cas d'égalité parfaite, on continue.
- Pendant une partie, le bloc **Joueurs** affiche au choix les stats de la partie ou celles de la carrière.
- Les autres téléphones voient les scores se mettre à jour toutes les 4 secondes pendant une partie.

## Règles de comptage

Notations utilisées :

- `A` : valeur de l'annonce (80 à 160 ; capot = 250 ; générale = 500) ;
- `m` : multiplicateur, qui vaut 1, ou 2 si contré, ou 4 si surcontré ;
- `p` : points de cartes faits par l'attaque, sur 162, sans la belote ;
- `p~` : `p` arrondi à la dizaine (le 5 profite à l'attaque) ;
- `b` : 20 points de belote.

| Situation | Attaque | Défense |
|---|---|---|
| Contrat réussi (`p + b_attaque ≥ A`) | `m·A + p~ + b_attaque` | `160 − p~ + b_défense` |
| Contrat chuté | `0` (la belote de l'attaque est perdue) | `160 + m·A + b_défense` |
| Capot non annoncé réussi | `m·A + 250 + b_attaque` | `0 + b_défense` |

**Exemple 1.** Annonce de 100 à cœur. L'attaque fait 96 points et a la belote : 96 + 20 = 116 ≥ 100, le contrat est réussi. L'attaque marque 100 + 100 + 20 = 220 (96 arrondi donne 100). La défense marque 160 − 100 = 60.

**Exemple 2.** La même donne, contrée : l'attaque marque 2×100 + 100 + 20 = 320.

**Exemple 3.** Annonce de 120 qui chute : la défense marque 160 + 120 = 280.

Plusieurs règles sont réglables dans **Groupe → Règles du groupe** :

- l'arrondi ;
- ce que marque la défense en cas de chute (160, 162, ou l'annonce seule) ;
- le capot non annoncé à 250 ;
- la belote perdue en cas de chute ;
- le sans atout et le tout atout ;
- le score cible.

Chaque partie garde les règles en vigueur au moment de son lancement.

## Statistiques calculées

| Statistique | Définition |
|---|---|
| Parties, victoires, % victoires / défaites | Parties terminées seulement |
| Prises, réussies, % réussite / chute | Donnes où le joueur est preneur, parties en cours comprises |
| Points moyens par contrat réussi | Moyenne des points marqués par l'équipe quand le contrat du joueur passe |
| Annonce moyenne | Moyenne des annonces de 80 à 160 (capot et générale exclus) |
| Contre réussi | Le joueur a contré et le contrat adverse a chuté |
| Surcontre réussi | Le joueur a surcontré et son contrat est passé |
| Chutes infligées en défense | Part des contrats adverses qui chutent quand le joueur défend |
| Capots | Capots réalisés comme preneur ; entre parenthèses, capots annoncés |
| Meilleur partenaire / adversaire redouté | Meilleur et pire taux de victoire, à partir de 2 parties ensemble |
| Évolution | % de victoires et % de prises réussies cumulés après chaque partie |

Exports CSV (ouvrables dans Excel) : **Groupe → Exporter**.

---

## Mettre à jour l'application

Après toute modification d'un fichier, changez la ligne `const VERSION = 'fdc-v1';` dans `sw.js` (par exemple en `fdc-v2`). Uploadez ensuite les fichiers sur GitHub. Les téléphones prendront la nouvelle version à l'ouverture suivante.

## Éviter la mise en veille du serveur

Sur l'offre gratuite, Supabase met le projet en pause après 7 jours sans activité. Les données sont conservées. Pour réveiller le projet, cliquez **Restore** sur sa page Supabase ; en attendant, l'app continue de fonctionner en local et se resynchronise après.

Pour éviter la pause, le fichier `.github/workflows/keepalive.yml` envoie une requête tous les 3 jours. Pour l'activer :

1. Créez le fichier sur GitHub via **Add file → Create new file**, avec le chemin `.github/workflows/keepalive.yml`. Les dossiers commençant par un point sont souvent ignorés par le glisser-déposer.
2. Ajoutez les secrets `SUPABASE_URL`, `SUPABASE_KEY` et `GROUP_CODE` dans **Settings → Secrets and variables → Actions**.

## Dépannage

| Symptôme | Cause probable |
|---|---|
| Badge « Erreur » rouge en haut | Touchez-le pour réessayer. Vérifiez l'URL et la clé dans `config.js`. |
| « Serveur non configuré » | Le script `schema.sql` n'a pas été exécuté entièrement. |
| « Code de groupe inconnu » | Code mal recopié : il n'y a ni 0, ni O, ni 1, ni I dans les codes. |
| L'app n'a pas pris une modification | Changez `VERSION` dans `sw.js`, puis fermez et rouvrez l'app. |
| Serveur injoignable depuis plusieurs jours | Projet Supabase en pause : cliquez **Restore** sur sa page. |

## Mode local

Sans configuration, l'app fonctionne entièrement sur un seul téléphone (« mode local »). Le bouton « Essayer avec des données de démonstration » remplit l'app avec 6 joueurs et une douzaine de parties fictives.

## Développement

- Tests du calcul des points et des statistiques : `node --test tests/scoring.test.js tests/stats.test.js`
- Aucune étape de compilation : HTML, CSS et JavaScript (modules ES) servis tels quels.

```
index.html            page unique
css/app.css           styles
js/config.js          configuration du serveur (à remplir)
js/scoring.js         calcul des points (règles)
js/stats.js           statistiques
js/store.js           stockage local + synchronisation
js/app.js             interface
supabase/schema.sql   base de données et sécurité
sw.js                 fonctionnement hors ligne
```
