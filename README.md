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

C'est le seul fichier à modifier. Pour notre groupe, il est **déjà rempli** dans chaque version livrée : il suffit de tout remplacer sur GitHub, `js/config.js` compris.

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
- **Titre de partie** (facultatif) : à la création d'une partie, ou plus tard avec « Donner un titre / Renommer » en bas de l'écran de la partie. Il s'affiche en haut de la partie, dans les listes, les profils et les exports.
- **% de prises sur les donnes jouées** : nombre de prises du joueur divisé par le nombre de donnes distribuées pendant qu'il était à la table (donnes « tous passent » comprises). Exemple : 2 prises sur 8 donnes = 25 %. Disponible pour la partie en cours, dans le profil (carrière), dans les graphiques et l'export.
- **Mise à jour** : si une version plus récente est en ligne, un bandeau « Mettre à jour » apparaît. Le bouton **Groupe → Forcer la mise à jour de l'app** vide la mémoire de l'app et recharge la dernière version (les parties et joueurs ne sont pas touchés).
- **Pendant une partie** (contrée et tarot), un graphique sous les cartes des joueurs suit une statistique au choix, une courbe par joueur, recalculée après chaque donne : % de prises réussies, prises réussies, points moyens par contrat réussi (contrée) ou gain moyen par prise (tarot), contres, belotes, petits au bout, score… Le bouton « Cette partie | Carrière » choisit entre les statistiques de la partie seule et celles de toute la carrière.
- **Graphiques en direct** : dans l'onglet Graphiques et dans les profils, la partie en cours apparaît comme dernier point, en pointillés (provisoire). Les prises, contres, belotes, etc. y sont comptés tout de suite ; les victoires, places et podiums ne comptent qu'à la fin de la partie.
- **Onglet Graphiques** : choisissez une statistique dans la liste et touchez les joueurs à comparer (8 au maximum). Une courbe par joueur montre la valeur cumulée après chaque partie du groupe. Touchez la courbe pour lire les valeurs de tous les joueurs à cette partie. Le tableau « Aujourd'hui » donne les valeurs actuelles.

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
| Prises, réussies, % réussite / chute | Contrats auxquels le joueur a participé : ses prises **solo** (il est le seul de son équipe à avoir annoncé) et les prises **partagées** (son partenaire avait aussi annoncé ; elles comptent pour les deux). Parties en cours comprises |
| Prises solo / partagées | Les mêmes chiffres séparés selon le type de prise. Dans la saisie, la case « … avait aussi annoncé » rend la prise partagée |
| Points moyens par contrat réussi | Moyenne des points marqués par l'équipe sur les contrats réussis auxquels le joueur a participé |
| Annonce moyenne | Moyenne des annonces de 80 à 160 faites comme preneur (dernière annonce de l'équipe ; capot et générale exclus) |
| Contre réussi | Le joueur a contré et le contrat adverse a chuté |
| Surcontre réussi | Le joueur a surcontré et son contrat est passé |
| Chutes infligées en défense | Part des contrats adverses qui chutent quand le joueur défend |
| Capots | Capots réalisés comme preneur ; entre parenthèses, capots annoncés |
| Meilleur partenaire / adversaire redouté | Meilleur et pire taux de victoire, à partir de 2 parties ensemble |
| Évolution | % de victoires et % de prises réussies cumulés après chaque partie |

Exports CSV (ouvrables dans Excel) : **Groupe → Exporter**.

### Stats d'un joueur pour une partie

Dans l'écran d'une partie (contrée ou tarot), **touchez la carte d'un joueur** : sa fiche s'ouvre, présentée comme la carrière mais **calculée uniquement sur cette partie**.

- En haut, l'interrupteur **Cette partie | Carrière** permet de passer de l'une à l'autre ; la flèche retour ramène à la partie.
- « La partie » remplace le bloc « Parties » : score de son équipe et des adversaires, statut (en cours, gagnée, perdue) et objectif à la contrée ; place actuelle (ou finale) et points au tarot.
- Puis les mêmes blocs que la carrière (prises, niveau des prises au tarot, contres et défense, exploits…), avec les chiffres de cette partie seulement.
- « Évolution dans la partie » : la statistique choisie, recalculée après chaque donne.
- Non affichés, car sans intérêt sur une seule partie : séries de victoires, partenaires et adversaires, dernières parties (et le bloc « À 5 joueurs » si la partie n'est pas à 5).

## Plusieurs groupes et « Toutes ses stats »

Un même téléphone peut suivre **plusieurs groupes**, par exemple un groupe avec certains amis et un autre avec d'autres. Pour passer de l'un à l'autre, touchez le nom du groupe en haut de l'onglet Parties. Le menu qui s'ouvre permet aussi d'**en rejoindre un autre** (avec son code) ou d'en **créer un nouveau**. On le retrouve dans **Groupe → Mes groupes**.

Chaque groupe garde ses propres profils, parties, classements et graphiques. Rien ne change pour jouer : un profil reste une simple fiche que n'importe qui peut créer en quelques secondes.

**Reprendre des joueurs d'un autre groupe.** Dans le nouveau groupe, onglet **Joueurs** (ou l'écran d'accueil s'il n'y a encore personne), touchez **Reprendre des joueurs d'un autre groupe**. Choisissez les joueurs (ou **Tous** pour un groupe entier), puis **Ajouter**. Chaque joueur repris reçoit une fiche dans ce groupe, déjà reliée à celle de l'autre groupe : même photo et « Toutes ses stats » additionne les groupes. Ses statistiques ne sont pas recopiées : chaque groupe compte les siennes. Si un joueur du même nom existe déjà dans le groupe (« relier »), sa fiche est reliée au lieu d'en créer une deuxième. Le bouton n'apparaît que si le téléphone suit au moins deux groupes.

**Relier des fiches (facultatif).** Dans le profil d'un joueur, touchez **Relier à un autre groupe**, puis sa fiche dans chacun de vos autres groupes. N'importe qui ayant accès aux deux groupes peut le faire ; l'intéressé n'a pas besoin d'être là. Ensuite :
- sa **photo** est la même partout (la changer dans un groupe la change dans les autres) ;
- le bouton **Toutes ses stats** affiche ses statistiques additionnées sur tous les groupes reliés, contrée et tarot, avec les courbes d'évolution. Exemple : 4 victoires sur 9 parties dans un groupe et 2 sur 5 dans l'autre donnent 6 sur 14, soit 43 %.

Le total d'une personne n'est calculé que sur un téléphone qui suit **tous** les groupes concernés. Chaque groupe reste privé et protégé par son code.

Pour retirer un lien, rouvrez **Liens** et touchez la fiche marquée ✓.

**Renommer un groupe.** Onglet **Groupe**, bouton **Renommer** à côté du nom. Le nouveau nom arrive sur les autres téléphones à la synchronisation suivante (quelques secondes), y compris chez ceux qui rejoignent le groupe plus tard. Le code d'invitation ne change pas. Techniquement, le nouveau nom est rangé dans les réglages du groupe, qui se synchronisent comme les parties : aucune modification de la base Supabase n'est nécessaire.

## Tarot

Le sélecteur **Contrée | Tarot**, en haut des onglets Parties, Joueurs, Graphiques et Historique et dans les profils, choisit le jeu affiché. Les profils des joueurs sont communs aux deux jeux, mais leurs statistiques sont séparées.

**Une partie** se joue à 3, 4 ou 5 joueurs, touchés dans l'ordre où ils sont assis : l'app indique qui donne. Elle dure soit un **nombre de donnes fixé**, auquel cas elle se termine toute seule, soit en **partie libre**, et on la termine avec « Terminer la partie ». Le gagnant est le 1ᵉʳ au classement ; le podium regroupe les 3 premiers, ex aequo compris.

**Saisie d'une donne :**
- le preneur et le contrat ;
- à 5, le joueur appelé (« lui-même » si le preneur s'est appelé) ;
- le nombre de bouts de l'attaque et ses points, ou ceux de la défense (demi-points acceptés : 45,5) ;
- en option : petit au bout, poignées, chelem et misères.

**Barème (Fédération Française de Tarot).** Notations : *P* = points de l'attaque sur 91, *O* = objectif (0 bout : 56, 1 : 51, 2 : 41, 3 : 36), *k* = Petite 1, Garde 2, Garde sans 4, Garde contre 6, *e* = |*P* − *O*| arrondi au point supérieur.

| Élément | Valeur, vue du preneur |
|---|---|
| Contrat | ±(25 + *e*) × *k* (+ si *P* ≥ *O*) |
| Petit au bout | ±10 × *k* au camp qui l'a mené au dernier pli (à l'autre camp s'il y est pris) |
| Poignée simple / double / triple | ±20 / 30 / 40 au camp qui gagne la donne |
| Chelem | +400 annoncé réussi, +200 non annoncé réussi, −200 annoncé raté |
| Misère (option) | +10 de chaque autre joueur pour celui qui l'annonce |

La somme *D* de ces éléments est retirée à chaque défenseur. Le preneur gagne +2*D* à 3 joueurs et +3*D* à 4. À 5, il gagne +2*D* et l'appelé +*D*, ou +4*D* s'il est seul.

*Exemple : à 4, Garde, 2 bouts, 47 points → (25 + 6) × 2 = 62 ; preneur +186, chaque défenseur −62.*

**Statistiques tarot :**
- parties, victoires, podiums, place moyenne, score final moyen et meilleur score ;
- prises réussies au total et par contrat, **niveau des prises** (part de Petites, Gardes, Gardes sans et Gardes contre parmi ses prises, avec une barre de répartition), gain moyen par prise réussie, bouts moyens ;
- à 5 : fois appelé, réussite comme appelé, fois appelé lui-même, meilleur partenaire ;
- % de contrats chutés en défense ;
- petits au bout, poignées, chelems et misères ;
- courbes d'évolution.

Les règles par défaut du tarot se règlent dans **Groupe → Règles du tarot**.

---

## Mettre à jour l'application

Remplacez tous les fichiers sur GitHub par ceux de la nouvelle version (`js/config.js` est déjà rempli). Si vous modifiez vous-même un fichier, changez aussi la ligne `const VERSION = 'fdc-vN';` dans `sw.js` (en augmentant N) et `APP_BUILD` dans `js/app.js`. Les téléphones prendront la nouvelle version à l'ouverture suivante.

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
| L'app n'a pas pris une modification | Vérifiez le numéro en bas de l'onglet Groupe, puis touchez « Forcer la mise à jour de l'app ». |
| Serveur injoignable depuis plusieurs jours | Projet Supabase en pause : cliquez **Restore** sur sa page. |

## Mode local

Sans configuration, l'app fonctionne entièrement sur un seul téléphone (« mode local »). Le bouton « Essayer avec des données de démonstration » remplit l'app avec 6 joueurs et une douzaine de parties fictives.

## Développement

- Tests du calcul des points et des statistiques : `node --test tests/scoring.test.js tests/stats.test.js tests/tarot.test.js`
- Aucune étape de compilation : HTML, CSS et JavaScript (modules ES) servis tels quels.

```
index.html            page unique
css/app.css           styles
js/config.js          configuration du serveur (à remplir)
js/scoring.js         calcul des points de la contrée
js/tarot.js           calcul des points du tarot
js/tarot-stats.js     statistiques du tarot
js/stats.js           statistiques
js/store.js           stockage local + synchronisation
js/app.js             interface
supabase/schema.sql   base de données et sécurité
sw.js                 fonctionnement hors ligne
```
