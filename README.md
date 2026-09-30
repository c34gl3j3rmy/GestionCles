# 🔐 Key Inventory — PWA locale

PWA mobile-first pour inventorier des clés, suivre leurs prêts et rapprocher une clé inconnue des empreintes déjà enregistrées.

## V1
- IndexedDB local, sans serveur ni compte
- sites → serrures → clés physiques
- code compact `[SITE][TYPE][SERRURE][COPIE]`
- ajout manuel sans photo
- prêts / retours et événements
- analyse d'image en mémoire ; aucune photo conservée
- empreinte visuelle versionnée et rapprochement technique
- export / import JSON versionné
- navigation basse avec emoji et gestion du Retour Android via History API
- manifest + service worker pour installation / hors ligne

## Analyse d'image
La V1 contient le pipeline et une empreinte visuelle non réversible destinée au tri des correspondances. Le module `src/services/analyzer.js` est volontairement isolé et versionné pour permettre l'étalonnage ultérieur de la détection des creux sur les prises de vue réelles. Les coordonnées métriques temporaires et le contour brut ne sont jamais persistés.

## Lancer en local
Servir le dossier via HTTP (un service worker ne fonctionne pas correctement en ouvrant simplement `index.html` avec `file://`). Par exemple avec n'importe quel petit serveur web local.
