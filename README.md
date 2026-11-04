# pcsi.os

Cockpit de travail pour la prépa CPGE PCSI : missions priorisées par pression (charge × échéance), kanban, emploi du temps et colloscope, mur d'erreurs en post-its (dessin au stylet), portails CPGE personnalisables, synchronisation cloud optionnelle (Supabase, QR code).

Application 100 % front, sans build : HTML + CSS + JavaScript.

## Lancer en local

Ouvrir `index.html` directement fonctionne, mais un petit serveur est recommandé (caméra du scanner QR, manifest PWA) :

```bash
python3 -m http.server 8080
# puis http://localhost:8080
```

Alternative : `npx serve .`

## Structure

```
index.html
css/   base, layout, components, overrides
js/    config, utils, state, ui, canvas, sync, missions, agenda, postits, data, portals, onboarding, app
```

Les scripts sont chargés dans cet ordre (portée globale partagée). Voir `CLAUDE.md` pour les conventions.

## Données

- Stockées dans le `localStorage` du navigateur (mode local par défaut).
- Export / import JSON depuis l'onglet « Sites & Liens ».
- Sync : renseigner un Sync ID (ou scanner un QR code) ; table Supabase `cockpit_sync`.

## Fichiers optionnels

Ajouter à la racine : `logo-ens.png`, `icon-192.png`, `icon-180.png`, `manifest.webmanifest`.
