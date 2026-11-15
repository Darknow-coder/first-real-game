# Flocon

**Chaque flocon raconte sa chute.**
Un jeu mobile / web de **Darknow Games**.

Un minuscule cristal de glace tombe dans la nuit d'hiver. Tu le guides du doigt
à travers les nuages, et chaque nuage le fait pousser autrement :

- la brume glacée fait des branches ;
- l'air sec fait des plaques ;
- le grand froid fait des aiguilles ;
- les gouttelettes le givrent ;
- le redoux le fait fondre.

Au bout de la chute, pose-le sur la moufle : il est photographié et rangé dans
ton carnet. Comme un vrai flocon, sa forme est l'histoire exacte de son trajet,
donc chaque flocon est unique.

- **Commande** : glisser le doigt n'importe où (déplacement relatif). Au clavier : flèches / ZQSD.
- **Campagne** : 5 chapitres × 6 nuits = 30 niveaux, 3 étoiles par nuit (atterrir + 2 défis).
- **Commandes de flocons** : reproduire un flocon modèle ; un anneau coloré indique le nuage nécessaire.
- **Carnet** : tous tes flocons photographiés, 16 formes à découvrir (avec indices), 6 supports photo à débloquer, export en image.
- **Flocon du jour** : une commande générée à partir de la date, la même pour tout le monde, avec une série de jours.
- **Tempête** : mode sans fin, poser un maximum de flocons d'affilée sur des ciels générés de plus en plus rudes.
- Français / anglais, sauvegarde locale, jouable hors ligne (PWA).

Le choix du concept (et les pistes écartées) est expliqué dans [docs/CONCEPTS.md](docs/CONCEPTS.md).
La conception détaillée est dans [docs/DESIGN.md](docs/DESIGN.md).

## Jouer en ligne (sans rien installer)

**https://darknow-coder.github.io/first-real-game/**

Le jeu est publié automatiquement sur GitHub Pages à chaque push
(workflow `.github/workflows/pages.yml`) : les tests s'exécutent, puis le
dossier `www/` est mis en ligne. Sur téléphone, le lien s'ouvre directement ; sur
ordinateur, il fonctionne aussi (souris ou flèches du clavier).

Activation, une seule fois : sur GitHub, ouvrir **Settings → Pages** et choisir
**Source : GitHub Actions**, puis relancer la publication depuis l'onglet
**Actions** (« Publish the game on GitHub Pages » → **Run workflow**).

## Lancer le jeu en local

Aucune dépendance n'est nécessaire, seulement Node.js 18 ou plus récent.

```bash
npm start
```

Puis ouvrir http://localhost:8080 (sur ordinateur, passer le navigateur en vue mobile).
Le dossier `www/` est un site statique : n'importe quel serveur HTTP convient
(GitHub Pages, Netlify, `python3 -m http.server`…). Les modules ES ne
fonctionnent pas en ouvrant `index.html` directement depuis le disque (`file://`).

Paramètres d'URL utiles pour le développement :

| Paramètre | Effet |
|---|---|
| `?lang=en` | force la langue |
| `?reset` | repart d'une sauvegarde vierge |
| `?debug` | compteur d'images par seconde dans le titre de l'onglet, service worker désactivé |
| `?debug&level=2-3` | lance directement un niveau |
| `?debug&unlock=all` | débloque toute la campagne |
| `?autopilot&speed=4` | le pilote automatique joue, en accéléré |

## Tests

```bash
npm test
```

Tests unitaires (`node:test`) : croissance des cristaux (déterminisme et
reconstruction depuis le journal), classification, simulation, validité des
30 niveaux et des ciels générés, sauvegarde (y compris données corrompues),
traductions. Un test d'intégration fait jouer **chaque niveau** au pilote
automatique pour garantir qu'il peut être terminé.

```bash
npm run bot
```

Ce script fait jouer toute la campagne et affiche, pour chaque nuit, la durée, la forme obtenue et les étoiles gagnées par le pilote automatique. C'est l'outil d'équilibrage.

```bash
npm run e2e
```

Test de bout en bout dans Chromium (émulation mobile) via Playwright. Il nécessite `npx playwright install chromium` et un serveur lancé avec `npm start`.

Le cache hors ligne fonctionne en « réseau d'abord » : un joueur connecté voit toujours la
dernière version publiée.

## Transformer en application Android

Le jeu est déjà prêt pour [Capacitor](https://capacitorjs.com/) (gratuit et open source) :

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
```

```bash
npx cap init Flocon com.darknowgames.flocon --web-dir=www
```

```bash
npx cap add android
```

```bash
npx cap open android
```

Le jeu verrouille déjà l'orientation portrait (manifeste), gère les encoches
(`safe-area-inset`), met en pause quand l'application passe en arrière-plan, et
ne fait aucun appel réseau. Pour le bouton retour Android, brancher le plugin
`@capacitor/app` sur `window.__flocon.onBack()`.

## Structure

```
www/                 le jeu (site statique, dossier web de Capacitor)
  src/core/          audio synthétisé, entrées, sauvegarde, traductions, maths, aléatoire déterministe
  src/sim/           logique pure : cristal, nuages, monde, niveaux, objectifs, classification, générateur, pilote auto
  src/render/        rendu Canvas 2D procédural : ciels, nuages, cristaux, sol, photos, effets
  src/ui/            écrans DOM, interface en jeu
tests/               tests unitaires, validation des niveaux par pilote automatique, E2E
tools/               serveur de développement, génération des icônes
docs/                recherche de concept et document de conception
```

## Ressources et licences

- **Graphismes** : 100 % générés par le code (Canvas 2D). Aucune image importée, hormis les icônes rendues par le jeu lui-même.
- **Musique et sons** : 100 % synthétisés en direct (Web Audio API). Aucun fichier audio.
- **Polices** : [Fraunces](https://github.com/undercasetype/Fraunces) et [Nunito](https://github.com/googlefonts/nunito), sous licence SIL Open Font License 1.1, qui autorise l'usage commercial. Les licences sont dans `www/fonts/`.
- **Icônes de l'interface** : dessinées pour le jeu (SVG intégré).
