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

## Déploiement (Vercel)

Site statique, sans build. Dans Vercel : *Add New Project* → importer le dépôt GitHub → **Framework Preset : Other**, laisser *Build Command* et *Output Directory* vides.

La conversion d'emploi du temps par IA passe par la fonction `api/ai-schedule.js` (`POST /api/ai-schedule`). Variables d'environnement à définir (*Settings → Environment Variables*), puis **redéployer** (elles ne sont lues qu'au déploiement) :

| Variable | Rôle |
|---|---|
| `GEMINI_API_KEY_1` (et `_2`, …) | Clé(s) Google AI Studio. Plusieurs variables = rotation. |
| `GEMINI_MODELS` | Optionnel. Modèles essayés dans l'ordre, séparés par des virgules (défaut `gemini-2.5-flash-lite,gemini-2.5-flash`). |
| `ALLOWED_ORIGIN` | Optionnel. Origines supplémentaires autorisées (le site lui-même l'est toujours). |

Limite Vercel : 4,5 Mo par requête. L'app envoie moins de pages si le document est trop lourd.
En local (`python3 -m http.server`), la fonction n'existe pas : saisir sa propre clé Gemini dans l'app, ou utiliser `vercel dev`.

## Structure

```
index.html
css/   base, layout, components, overrides
js/    config, utils, state, ui, canvas, sync, missions, agenda, postits, data, portals, onboarding, app
api/   ai-schedule.js (fonction Vercel)
```

Les scripts sont chargés dans cet ordre (portée globale partagée). Voir `CLAUDE.md` pour les conventions.

## Données

- Stockées dans le `localStorage` du navigateur (mode local par défaut).
- Export / import JSON depuis l'onglet « Sites & Liens ».
- Sync : renseigner un Sync ID (ou scanner un QR code) ; table Supabase `cockpit_sync`.

## Fichiers optionnels

Ajouter à la racine : `logo-ens.png`, `icon-192.png`, `icon-180.png`, `manifest.webmanifest`.
