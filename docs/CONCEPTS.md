# Recherche de concept — Darknow Games

Ce document retrace la phase de conception : les pistes explorées, ce que la
recherche d'antériorité a révélé, la comparaison et le choix final.

Contraintes de départ :

* compréhensible en quelques secondes, assez profond pour donner envie de continuer ;
* agréable au doigt sur smartphone, en 2D, léger (navigateur puis Android) ;
* une vraie progression ;
* aucun budget, aucun service payant, uniquement des ressources originales ;
* **très différent de Marbl** (puzzle où une inclinaison globale fait rouler plusieurs billes à la fois).

J'ai donc écarté d'emblée tout ce qui reposait sur l'inclinaison, ou sur une seule
commande globale qui déplace plusieurs objets en même temps. C'est l'ADN de Marbl.

---

## 1. Les pistes explorées

| # | Concept | Genre | En une phrase |
|---|---------|-------|---------------|
| A | **Lanterne au fil de l'eau** | adresse / physique | On ne touche jamais le bateau : on touche l'eau, l'onde le pousse le long d'une rivière. |
| B | **Le Gardien du phare** | gestion temps réel | On oriente le faisceau d'un phare pour éclairer les navires au bon moment. |
| C | **Montgolfière** | navigation calme | Maintenir = chauffer et monter ; chaque altitude a un vent différent : on navigue en choisissant sa couche. |
| D | **Marée haute** | défense / fluide | On dessine des murets dans le sable pour protéger son château de la marée qui monte. |
| E | **Coupe-feu** | stratégie temps réel | On trace des tranchées pour contenir un feu de forêt poussé par le vent. |
| F | **Mèche** | arcade / dessin | On dessine une traînée de poudre, l'étincelle la suit : il faut atteindre les feux d'artifice avant qu'elle ne nous rattrape. |
| G | **Gonfle** | arcade une touche | Un poisson-globe : gonflé il monte mais ne passe plus partout, dégonflé il passe mais coule et devient vulnérable. |
| H | **Flocon** | adresse / création / collection | On guide un cristal de glace qui tombe à travers des nuages ; chaque nuage le fait pousser autrement. Chaque chute crée un flocon unique. |

## 2. Recherche d'antériorité (ce qui a changé mon choix)

Mon concept favori au départ était **A (Lanterne au fil de l'eau)**. Avant de coder,
j'ai vérifié s'il existait déjà. Résultat : oui, plusieurs fois, y compris
la combinaison exacte « lanterne + rivière + ondes » :

* [Ripple (DigiPen)](https://digipen.edu/showcase/student-games/ripple) : guider une lanterne sur une rivière uniquement avec des ondes ;
* [BoatPassGone](https://apps.apple.com/mx/app/boatpassgone/id6747926122) : toucher l'eau pour pousser un bateau sur une rivière pleine d'obstacles ;
* [Water Ripples](https://toucharcade.com/games/water-ripples), [Calm Waters](https://oriondark7.itch.io/calmwaters), [Ripple Ruler](https://winteralexander.itch.io/ripple-ruler), [Go With The Flow](https://diffthought.itch.io/go-with-the-flow), [Tap The Water](https://apps.apple.com/us/app/id1600675221)…

Les retours de joueurs sur ces jeux citent aussi un défaut réel : le contrôle
indirect est souvent jugé imprécis. Ce concept est donc devenu un petit genre à part entière. Je l'ai abandonné.

J'ai ensuite fait la même vérification pour les autres pistes :

* **B — Phare** : genre déjà bien rempli ([Lunhavn](https://apps.apple.com/app/id6785853153), [The Lighthouse HD](https://www.pocketgamer.com/the-lighthouse-hd/review), [Beacon: Save the Ships](https://playgama.com/game/beacon-save-the-ships)…).
* **C — Montgolfière** : la navigation par couches de vent existe ([Hot-Air Balloon Challenge](https://banjochris.itch.io/hot-air-balloon-challenge), [Hotairballoon Navigation](https://apps.apple.com/app/id1097147788)…).
* **D — Marée haute** : beaucoup de précédents ([Castle Splash](https://jameeb55.itch.io/castle-splash), [Against the Tide](https://matthiaskarst.itch.io/against-the-tide), [Sandcastle Defense](https://pmelga01.itch.io/sandcastle-defense), et un jeu Steam ambitieux en préparation, SandFlow).
* **E — Coupe-feu** : existe ([Backburn](https://apps.apple.com/app/id6792957422), [Fight the Fire](https://apps.apple.com/us/app/fight-the-fire/id900824901), [Firefront](https://thalisgold.github.io/Firefront)…).
* **F — Mèche** : un seul petit précédent proche ([ShortFused](https://papercookies.itch.io/shortfused/purchase)).
* **H — Flocon** : **aucun jeu trouvé** où l'on guide un cristal de glace dont la forme dépend des conditions traversées. Je n'ai trouvé que les références scientifiques sur lesquelles le concept s'appuie (diagramme de Nakaya : la forme dépend de la température et de l'humidité rencontrées pendant la chute).

> Honnêtement : presque toutes les mécaniques simples ont déjà été tentées
> quelque part, surtout dans des game jams. La question utile n'est donc pas
> « est-ce que ça n'a jamais existé ? », mais « est-ce que ça forme déjà un
> genre reconnaissable ? ». A, B, D et E en forment un. Pas H.

## 3. Comparaison

Notes de 1 à 5. Pour la ligne « Distance avec Marbl », 5 = très différent.

| Critère | A Lanterne | B Phare | C Montgolfière | D Marée | E Coupe-feu | F Mèche | G Gonfle | **H Flocon** |
|---|---|---|---|---|---|---|---|---|
| Originalité (après vérification) | 1 | 1 | 2 | 1 | 2 | 4 | 3 | **5** |
| Compris en quelques secondes | 5 | 4 | 4 | 5 | 4 | 4 | 5 | **4** |
| Potentiel ludique (profondeur) | 4 | 3 | 3 | 4 | 4 | 3 | 3 | **4** |
| Confort tactile | 4 | 4 | 4 | 5 | 4 | 2 | 5 | **5** |
| Fidélisation | 3 | 3 | 3 | 3 | 3 | 3 | 3 | **4** |
| Identité visuelle / sonore | 4 | 4 | 4 | 4 | 3 | 4 | 3 | **5** |
| Faisabilité sans budget | 4 | 5 | 5 | 3 | 4 | 4 | 5 | **4** |
| Distance avec Marbl | 2 | 5 | 5 | 4 | 4 | 5 | 5 | **5** |

Remarques :

* **F (Mèche)** est original et nerveux, mais dessiner en continu cache l'écran
  sous la main et fatigue vite. Sur téléphone, le risque est élevé.
* **G (Gonfle)** est excellent pour du « encore une partie », mais on le prend
  pour un dérivé de Flappy Bird au premier coup d'œil. C'est exactement ce que le brief demande d'éviter.
* **A** était objectivement le plus « jouet » des huit (toucher l'eau fait plaisir
  tout de suite), mais l'originalité était le premier critère.

## 4. Le choix : **Flocon**

**Le principe tient en une phrase : chaque flocon raconte sa chute.**

Un minuscule cristal de glace tombe dans la nuit d'hiver. On le dirige du doigt.
Les nuages qu'il traverse le font pousser différemment :

* la brume glacée humide fait pousser des branches ;
* l'air sec fait des plaques hexagonales ;
* le grand froid fait des aiguilles ;
* les gouttelettes givrent ;
* le redoux le fait fondre.

Au bout de la chute, on doit atterrir sur une moufle sombre. Le flocon est alors
photographié et rangé dans le carnet. Il est unique, parce que sa forme est
l'histoire exacte du trajet choisi. C'est vrai aussi pour les vrais flocons :
leur forme enregistre ce qu'ils ont traversé.

### Pourquoi c'est le plus prometteur

1. **Une vraie identité, impossible à confondre.** Nuit d'hiver, aurores
   boréales, cristaux procéduraux. Le jeu ne ressemble à aucun jeu populaire.
2. **Une récompense unique à chaque partie.** On ne gagne pas un score
   abstrait : on obtient un objet beau, qui nous appartient et qu'on peut collectionner, comparer ou exporter en image.
3. **Une commande simple pour un vrai choix.** On glisse le doigt pour se
   déplacer, comme dans beaucoup de jeux mobiles. Mais chaque déplacement est une
   décision : aller chercher des branches à gauche, ou éviter le grésil à droite et rester en plaque ?
4. **Une profondeur qui vient de la science.** Une quinzaine de formes à
   découvrir (dendrite fougère, plaque à secteurs, étoile d'aiguilles, grésil,
   flocon à douze branches…), comme une collection.
5. **Une progression naturelle.** Nuits de campagne avec objectifs, « commandes » de
   flocons à reproduire, mode Tempête sans fin, flocon du jour.
6. **Entièrement procédural.** Graphismes et sons sont générés par le code :
   aucune ressource sous licence douteuse, et un poids minimal.

### Faiblesses assumées

* Le rythme est plus **contemplatif** qu'un jeu d'arcade. Il plaira davantage aux
  amateurs de jeux « cosy » et créatifs qu'aux chasseurs de réflexes.
  Pour corriger cela, j'ajoute des dangers (grésil, grêle, redoux, rafales), des objectifs
  exigeants à chaque nuit et un mode Tempête plus nerveux.
* Il n'y a **qu'un seul geste** (diriger). La profondeur doit venir du contenu
  (agencement des nuages, dangers, objectifs), pas des commandes.
* Sans serveur, les records sont **locaux**. Pas de classement en ligne : c'est une limite
  réelle pour la rétention compétitive, mais ajouter un serveur irait contre la contrainte « zéro service ».
* Rien ne garantit un succès. Le pari est celui de la singularité et du soin, pas celui
  d'une formule éprouvée.
