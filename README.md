# 🔐 Key Inventory — PWA locale

PWA mobile-first pour inventorier des clés, suivre leurs prêts et rapprocher une clé inconnue des empreintes déjà enregistrées.

## V2
- IndexedDB local, sans serveur ni compte
- sites → serrures → clés physiques
- code compact `[SITE][TYPE][SERRURE][COPIE]`
- ajout manuel sans photo
- prêts / retours et historique événementiel
- aucune photo conservée : traitement uniquement en mémoire
- analyse V2 relative et normalisée
- écran de contrôle avec qualité par étape, nombre de creux, variation, creux principal et graphe
- création d'une empreinte de référence à partir de **3 prises successives**
- médiane des trois vecteurs pour construire la référence
- contrôle de répétabilité et détection de la prise la plus divergente
- recherche rapide avec une seule photo
- rapprochement proposé uniquement ; aucune copie créée automatiquement
- conservation des signatures V1, sans comparaison croisée V1/V2
- export JSON schéma V2 et import des sauvegardes V1/V2
- navigation basse avec emoji et gestion du Retour Android via History API
- manifest + service worker pour installation et fonctionnement hors ligne

## Analyse V2
La carte sombre au format ISO/CEI 7810 ID-1 sert de référence géométrique pour rendre les prises de vue plus comparables. L'analyse extrait une empreinte **relative** du profil de la clé, normalisée sur 64 points. Elle ne conserve ni photo, ni contour brut, ni mesure métrique de taillage.

Pour une empreinte de référence, trois acquisitions sont analysées puis comparées. La référence est construite par médiane point par point. Si une prise diverge trop, la PWA propose de reprendre uniquement cette prise.

## Lancer en local
Servir le dossier via HTTP : un service worker ne fonctionne pas correctement en ouvrant simplement `index.html` avec `file://`.
