# Flocon — document de conception

## Pitch

Un cristal de glace tombe dans la nuit. Tu le diriges à travers les nuages, et chaque nuage
change sa façon de pousser. À l'atterrissage, le flocon est photographié et rangé dans un
carnet. **Chaque chute produit un objet unique**, parce que la forme est l'enregistrement exact
du trajet. C'est vrai aussi dans la nature (diagramme de Nakaya).

Genre : adresse et création, avec une composante collection. Sessions de 45 à 70 secondes.

## Boucle de jeu

1. **Tomber** : le ciel défile et le doigt déplace le flocon (déplacement relatif, n'importe où sur l'écran).
2. **Choisir ses nuages** : chaque nuage ajoute une couche à la forme, et les poussières de vapeur accélèrent la croissance.
3. **Survivre** : grésil, grêle, oiseaux, branches et redoux abîment le flocon. Plus il est grand, plus il est exposé.
4. **Atterrir** sur la cible (moufle, écharpe, manche, luge, glace noire).
5. **Photo** : identification de la forme, score de beauté, étoiles, ajout au carnet, nouvelles formes découvertes.

## Le modèle de croissance

Le flocon a six branches. Chaque incrément de croissance ajoute un *segment* radial dont le
type dépend du nuage :

| Nuage | Effet | Couleur |
|---|---|---|
| Brume glacée | branches dendritiques ; au cœur des nuages les plus denses, des ramilles (fougère) | cyan |
| Air sec | plaques hexagonales, nervures en secteurs | bleu |
| Grand froid | aiguilles fines et raides | violet |
| Gouttelettes | perles de givre ; en excès, grésil | blanc |
| Aurore | branches teintées (fantaisie assumée) | vert-rose |
| Tourbillon | trois branches sur six poussent plus vite → flocon triangulaire | or |
| Redoux | **fonte** : la taille diminue | orange |

Propriétés techniques importantes :

- **Déterminisme et invariance au découpage** : croître de 0,1 dix fois donne la même
  géométrie que croître de 1 une fois. Chaque flocon est donc stocké dans le carnet sous
  forme d'un court *journal d'événements* (environ 1 Ko) et reconstruit à l'affichage.
- **Géométrie réelle pour les collisions** : un projectile ne casse une branche que s'il
  touche vraiment son contour. Une étoile d'aiguilles est donc plus facile à garder intacte
  qu'une dendrite touffue.

## Formes à découvrir (16)

Prisme, plaque hexagonale, plaque à secteurs, étoile à plaquettes, plaque étoilée, étoile
dendritique, dendrite fougère, étoile d'aiguilles, flocon givré, grésil, flocon fondu, étoile
brisée, agrégat, flocon boréal, flocon triangulaire, douze branches. Les formes inconnues
affichent un indice dans le carnet.

Distinctions : **Géant** (rayon ≥ 50 sans casse) et **Chef-d'œuvre** (grand, intact, sans
fonte, au moins trois types de croissance).

## Progression

- **Campagne** : 5 chapitres de 6 nuits. Chaque chapitre a son ambiance, introduit une ou deux
  mécaniques et se termine par une nuit de synthèse.
  1. *Les Cimes* : déplacement, brume, air sec, éclats d'étoile, grésil, première commande.
  2. *La Forêt* : grand froid, gouttelettes, oiseaux, branches de sapin, fougères.
  3. *Le Village* : redoux (fumées de cheminées), vent en rafales.
  4. *Le Blizzard* : rafales fortes, grêle, courants ascendants et descendants, autres flocons (agrégats).
  5. *L'Aurore* : aurore, tourbillon, flocon jumeau (douze branches), chef-d'œuvre final.
- **3 étoiles par nuit** : la première pour l'atterrissage, les deux autres pour des défis
  (éclats, taille, beauté, forme précise, ressemblance à un modèle, aucune casse, aucune fonte,
  chef-d'œuvre).
- **Commandes** (une par chapitre) : reproduire un flocon modèle. Un anneau autour du flocon
  prend la couleur du nuage nécessaire à ce moment. La ressemblance est calculée en comparant
  les profils radiaux.
- **Déblocages** : un chapitre terminé débloque le suivant et un support photo. Le flocon du jour
  s'ouvre après la nuit 1-3, la Tempête après le chapitre 1, le velours avec un chef-d'œuvre.
- **Flocon du jour** : la date sert de graine pour générer la commande et le ciel. Meilleur
  résultat du jour et série de jours consécutifs.
- **Tempête** : ciels générés, difficulté croissante, le score est la somme des beautés. On
  continue tant qu'on pose ses flocons.

## Direction artistique

- Nuit d'hiver, palette froide (indigo, bleu nuit), lumière chaude réservée aux fenêtres, aux étoiles collectées et aux cibles.
- Tout est procédural : ciels en dégradé, étoiles scintillantes, lune, aurores en rubans,
  silhouettes de montagnes, sapins et maisons, neige en parallaxe à trois couches, nuages en
  volutes additives, cristaux vectoriels mis en cache.
- Typographie : Fraunces (titres, élégante) et Nunito (interface, lisible et ronde).
- La photo finale simule une macrophotographie sur laine sombre, comme les vrais photographes de flocons.

## Son

Entièrement synthétisé (Web Audio) :

- musique générative par chapitre (nappes et boîte à musique sur une grille d'accords) ;
- chaque poussière captée joue une note **quantifiée sur le tempo et l'accord en cours**, si bien que la chute « compose » une mélodie ;
- vent et grésillement du redoux en ambiance continue ;
- cristal brisé, obturateur photo à l'atterrissage, arpège pour une nouvelle forme.

## Accessibilité et confort

- Une seule commande, utilisable d'une main et à n'importe quel endroit de l'écran. Sensibilité réglable.
- Les nuages se distinguent aussi par la forme de leurs particules (points, hexagones,
  aiguilles, gouttes, ondulations de chaleur), pas seulement par la couleur. Leur nom s'affiche avant qu'on les atteigne (option).
- Option « réduire les effets » : coupe flashs et secousses.
- Les projectiles venant d'en haut sont annoncés par des chevrons en bord d'écran.
- Pause automatique quand l'application passe en arrière-plan.

## Équilibrage

Un **pilote automatique** (`www/src/sim/bot.js`) joue les niveaux sans affichage. Il anticipe
les nuages, les projectiles, les éclats et la cible d'atterrissage. Il sert à :

- garantir que chaque niveau peut être terminé (test automatique) ;
- mesurer la durée des niveaux, les formes obtenues et la difficulté des défis ;
- faire tourner les démonstrations (`?autopilot`).

Les défis « aucune branche brisée » des chapitres 4 et 5 sont volontairement exigeants :
le pilote, qui esquive moins bien qu'un joueur attentif, les réussit rarement.

## Limites connues et pistes

- Pas de classement en ligne (aucun serveur, par choix). Le partage du flocon du jour se fait en texte.
- L'export d'image utilise le partage ou le téléchargement du navigateur. Dans une application
  Capacitor, il faudra les plugins Filesystem et Share.
- Pistes : éditeur de supports photo, défis hebdomadaires, nouveaux phénomènes (orages
  électriques, cristaux en colonnes), mode « contemplation » sans danger.
