# CLAUDE.md — pcsi.os

Cockpit de prépa PCSI : missions, emploi du temps, mur d'erreurs, portails. Front pur (HTML/CSS/JS), aucune étape de build. Données en localStorage, sync optionnelle via Supabase.

## Arborescence
- `index.html` : structure + 10 modales + CDN (Tailwind, Phosphor, qrcodejs, html5-qrcode, polices).
- `css/` (ordre de cascade = ordre de chargement) : `base` (thème/reset) → `layout` (grille, sidebar) → `components` (boutons, modales, post-its…) → `overrides` (glass, kanban, sites, mobile).
- `js/` (scripts classiques, portée globale partagée, **ordre de chargement critique**) :
  `config` → `utils` → `state` → `ui` → `canvas` → `sync` → `missions` → `agenda` → `postits` → `data` → `portals` → `onboarding` → `app`.

## Conventions
- Pas de modules ES : `let state` & co sont des globales lexicales partagées entre scripts. Ne pas passer en `type="module"` sans réécrire les `onclick` inline.
- Tout handler appelé depuis le HTML est exposé via `window.nom = ...`.
- Les rendus utilisent des template literals + `escapeHtml()` pour toute donnée utilisateur.
- Après toute mutation : `saveState()` puis le `render*()` concerné, puis `showToast()`.
- Selects maison : `mountCustomSelect(mountId, selectId, options, valeurInitiale, onChange)`, valeur lue dans `customSelectValues[selectId]`.
- Dates en ISO `YYYY-MM-DD` ; semaine du lundi au samedi (`dayOfWeek` 0–5).
- Ne pas ajouter de CSS ailleurs que dans le fichier du rôle concerné ; un override va dans `overrides.css`.

## État clé (`state`, persisté sous `pcsi_minimal_saas_v2`)
- `tasks[]` : `{id,title,note,subject,status('todo'|'in_progress'|'done'),duration,dueDate,createdAt}`
- `schedule[]` : `{id,title,subject,type,start,end,room}` + `dayOfWeek` (récurrent) **ou** `date` (ponctuel)
- `postits[]` : `{id,subject,errType,color,source,text,rot,imageData}`
- `errorTypes[]`, `portals[]`
- UI : `activeTab`, `sidebarCollapsed`, `cahierMode`, `cahierSubjFilter`, `postitSubjFilter`, `postitTypeFilter`

## Sync Supabase
- Table `cockpit_sync` (`id` = Sync ID, `payload` = state). Config dans `supaConfig`, clé `pcsi_supabase_cfg_v2`.
- Flags : `syncDirty`, `syncOk`, `syncVersion`, `lastDataSig`. Push différé 700 ms dans `saveState()`.
- Vide = mode local. `SUPABASE_URL` / `SUPABASE_KEY` dans `js/config.js` (clé publishable).

## Pression (`computePressure` dans `missions.js`)
Constantes `WORK_H_PER_DAY`, `LOAD_GAIN`, `URGENCY_MAX`, `URGENCY_DECAY` ; score 0–100 → couleur HSL vert→rouge ; `RETARD` si échéance passée.

## Assets attendus à la racine (optionnels)
`logo-ens.png`, `icon-192.png`, `icon-180.png`, `manifest.webmanifest`.
