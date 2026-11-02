# Guide d'utilisation

Fonctionnement détaillé de l'application : saisie, règles de comptage, statistiques, tarot, groupes et design.
Retour à la [présentation](../README.md) · [Installation](INSTALLATION.md)

## Utilisation

- **Nouvelle partie** : touchez 4 joueurs. Les deux premiers forment la première équipe, les deux suivants la seconde. Vous pouvez aussi tirer les équipes à la roue (voir ci-dessous), choisir la couleur de chaque équipe (bleu et rouge au départ), puis le score à atteindre.
- **Tirage à la roue** : une fois les 4 joueurs choisis, « Tirer les équipes à la roue » ouvre une roue avec la tête de chaque joueur. Premier lancer : le joueur qui ouvre la première équipe ; second lancer, parmi les trois restants : son partenaire ; les deux derniers forment l'autre équipe. On lance en touchant « Lancer » ou en faisant tourner la roue du doigt. Les trois répartitions possibles ont chacune une chance sur trois. À la fin : « Garder ces équipes » ou « Relancer ».
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
- **Graphiques en direct** : dans l'onglet Graphes et dans les profils, la partie en cours apparaît comme dernier point, en pointillés (provisoire). Les prises, contres, belotes, etc. y sont comptés tout de suite ; les victoires, places et podiums ne comptent qu'à la fin de la partie.
- **Onglet Graphes** : choisissez une statistique dans la liste et touchez les joueurs à comparer (8 au maximum). Une courbe par joueur montre la valeur cumulée après chaque partie du groupe. Touchez la courbe pour lire les valeurs de tous les joueurs à cette partie. Le tableau « Aujourd'hui » donne les valeurs actuelles.

## Règles de comptage

Notations utilisées :

- `A` : valeur de l'annonce (80 à 160 ; capot = 250 ; générale = 500) ;
- `m` : multiplicateur, qui vaut 1, ou 2 si contré, ou 4 si surcontré ;
- `p` : points de cartes faits par l'attaque, sur 162, sans la belote ;
- `p~` : `p` arrondi à la dizaine (le 5 profite à l'attaque) ;
- `b` : 20 points de belote.

**Sans contre :**

| Situation | Attaque | Défense |
|---|---|---|
| Contrat réussi (`p + b_attaque ≥ A`) | `A + p~ + b_attaque` | `160 − p~ + b_défense` |
| Contrat chuté | `0` (belote de l'attaque perdue, option) | `160 + A + b_défense` |
| Capot non annoncé réussi | `A + 250 + b_attaque` | `0 + b_défense` |

**Contré (`m = 2`) ou surcontré (`m = 4`), règle officielle de la Fédération Française de Belote** (« le gagnant prend tout », réglage par défaut des nouvelles parties) :

| Situation | Attaque | Défense |
|---|---|---|
| Contrat réussi | `m × (160 + A + b_attaque)` (250 au lieu de 160 en cas de capot) | `0 + b_défense` (la belote est imprenable) |
| Contrat chuté | `0` (ou sa belote si l'option « belote perdue » est décochée) | `m × (160 + A + b_défense)` |

**Exemple 1.** Annonce de 100 à cœur. L'attaque fait 96 points et a la belote : 96 + 20 = 116 ≥ 100, le contrat est réussi. L'attaque marque 100 + 100 + 20 = 220 (96 arrondi donne 100). La défense marque 160 − 100 = 60.

**Exemple 2.** La même donne, contrée : l'attaque marque 2 × (160 + 100 + 20) = 560, la défense 0. Surcontrée : 4 × 280 = 1 120.

**Exemple 3.** Annonce de 100 contrée qui chute, sans belote : la défense marque 2 × (160 + 100) = 520, l'attaque 0. Sans contre : 160 + 100 = 260.

L'ancienne règle (seule l'annonce est multipliée et chacun garde ses points : exemple 2 → 2×100 + 100 + 20 = 320 pour l'attaque, 60 pour la défense) reste disponible en décochant « Contré : le gagnant prend tout ». Les parties lancées avant la version 15 gardent l'ancienne règle. En bas de l'écran d'une partie, le cadre **Donnes contrées** indique la règle utilisée par cette partie ; **Passer à la règle officielle** (ou l'inverse) recalcule toutes ses donnes. Le même bouton apparaît aussi dans la saisie d'une donne contrée quand la partie utilise l'ancienne règle.

Plusieurs règles sont réglables dans **Groupe → Règles du groupe** :

- le décompte des donnes contrées (règle officielle ou ancienne règle) ;
- l'arrondi ;
- ce que marque la défense en cas de chute (160, 162, ou l'annonce seule) ;
- le capot non annoncé à 250 ;
- la belote perdue en cas de chute (la règle officielle dit qu'elle est imprenable : décochez pour la suivre) ;
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

**Menu d'ouverture.** Quand on lance l'app après l'avoir fermée, elle affiche la liste de vos groupes : touchez celui où vous jouez. Chaque carte indique les joueurs, le nombre de parties, les parties en cours et la date de la dernière partie ; le dernier groupe utilisé est entouré. Le même écran permet de créer un groupe ou d'en rejoindre un avec un code. Verrouiller le téléphone ou passer sur une autre app ne fait pas revenir ce menu : on retrouve le groupe et la partie qu'on regardait. Pour revenir au menu sans fermer l'app : nom du groupe en haut de l'onglet Parties → **Menu d'accueil**.

## Tarot

Le sélecteur **Contrée | Tarot**, en haut des onglets Parties, Joueurs, Graphes et Historique et dans les profils, choisit le jeu affiché. Les profils des joueurs sont communs aux deux jeux, mais leurs statistiques sont séparées.

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

## Modifier le design

### Couleurs des équipes (contrée)

À la création d'une partie, la rubrique **Couleurs des équipes** propose 9 couleurs pour chaque équipe : bleu, rouge, vert, orange, violet, rose, jaune, turquoise, noir. Le nom de l'équipe suit la couleur (« Victoire des Verts »). Les deux équipes ne peuvent pas avoir la même couleur. Une nouvelle partie reprend les couleurs de la précédente ; une revanche garde les siennes. Les anciennes parties restent en bleu et rouge. La palette est dans `TEAM_PALETTE`, au début de `js/app.js`.

### Logo

Le logo s'affiche à l'ouverture de l'app (écran d'accueil animé, puis en haut du menu des groupes). Pour le changer :

- **le plus simple** : remplacer le fichier `img/logo.jpg` par votre image, sous le même nom (image carrée, idéalement 640 × 640 pixels ; ses coins sont arrondis automatiquement) ;
- **ou** déposer votre image dans `img/` (par exemple `img/logo.png`) et l'indiquer dans `js/config.js` : `logo: 'img/logo.png'`. L'ancien logo dessiné est toujours là : `logo: 'img/logo.svg'`.

Les icônes de l'écran d'accueil du téléphone sont dans `icons/` (192, 512 et 180 pixels pour l'iPhone).

### Bandeau du haut

Chacun choisit sur son téléphone la couleur du bandeau du haut : **Groupe → Apparence → Bandeau du haut** (clair, vert, noir, bordeaux, bleu nuit ou sauge). Le logo d'ouverture et le menu des groupes restent toujours sur fond vert.

### Couleurs et formes de l'app

Tout l'aspect visuel est dans **`css/app.css`**. Les réglages du design actuel sont regroupés dans le bloc `:root` de la section « DESIGN MODERNE », à la fin du fichier :

| Variable | Rôle | Valeur actuelle |
|---|---|---|
| `--brand` | vert principal : ouverture, boutons, onglet actif | `#1d5a3c` |
| `--brand-2` | vert des liens et des boutons principaux | `#1f7a4c` |
| `--brand-soft` | fonds vert pâle, boutons clairs | `#e4f0e7` |
| `--paper` | fond des écrans (crème) | `#f6f2ea` |
| `--card` | fond des cartes | `#ffffff` |
| `--line` | fins traits autour des cartes | `#ebe3d6` |
| `--ink` | texte | `#26221c` |
| `--muted` | texte secondaire | `#827868` |
| `--red` | cœurs et carreaux, erreurs (début du fichier) | `#d7263d` |
| `--r-lg`, `--r-md` | arrondi des cartes et boutons | `18px`, `12px` |
| `--display`, `--body` | polices des titres et du texte (début du fichier) | Anybody, Atkinson Hyperlegible |

Les couleurs de bandeau proposées sont dans `HEADER_STYLES` (début de `js/app.js`) et dans les lignes `html[data-header="…"]` de `css/app.css`. Après une modification, augmentez `VERSION` dans `sw.js` (et `APP_BUILD` dans `js/app.js`) pour que les téléphones prennent la nouvelle version. Les couleurs des courbes sont dans `SERIES_COLORS` (début de `js/app.js`).
