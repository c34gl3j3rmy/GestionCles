# 🔐 Système personnel de gestion des clés

## 📖 Objectif

Ce système a pour but de :

* Identifier de manière unique chaque clé
* Marquer les clés avec un code compact
* Assurer la traçabilité des copies
* Suivre les prêts et retours

---

# 🧱 Structure du code écrit sur les clés

Format :

```
[SITE][TYPE][SERRURE][COPIE]
```

---

## 🔎 Définition des champs

### 1️⃣ SITE (chiffre)

Identifie le lieu ou la catégorie d’objet.

| Code | Signification                         |
| ---- | ------------------------------------- |
| 0    | Objet mobile (non lié à un lieu fixe) |
| 1    | Maison principale                     |
| 2    | Résidence séniors Hespérides          |
| 3    | Père                                  |
| 4    | Ancien appartement                    |
| 5    | Appartement en rénovation             |

ℹ️ Si le nombre de sites dépasse 9, la numérotation passe naturellement à deux chiffres.

---

### 2️⃣ TYPE (lettre)

Identifie la catégorie d’accès.

| Lettre | Signification     |
| ------ | ----------------- |
| P      | Porte             |
| G      | Garage            |
| B      | Boîte aux lettres |
| C      | Cadenas / Antivol |
| T      | Local technique   |
| V      | Véhicule          |
| S      | Stockage / cave   |

---

### 3️⃣ SERRURE (chiffre)

Identifie la serrure spécifique au sein du site et du type.

Exemple pour un site donné :

* 1 = Porte d’entrée
* 2 = Porte arrière
* 3 = Garage

ℹ️ Si le nombre de serrures dépasse 9 pour un même site et un même type, la numérotation passe naturellement à deux chiffres.

---

### 4️⃣ COPIE (lettre)

Identifie la clé physique.

* A = Première clé
* B = Deuxième exemplaire
* C = Troisième exemplaire
* etc.

---

Exemples :

```
0C1A → Site 0 (Objet mobile) – Cadenas – Serrure n°1 – Clé A (copie A)
1P3C → Site 1 (Maison principale) – Porte – Serrure n°3 – Clé C (copie C)
2B1B → Site 2 (Résidence séniors Hespérides) – Boîte aux lettres – Serrure n°1 – Clé B (copie B)
3P2B → Site 3 (Maison papa) – Porte – Serrure n°2 - Clé B (deuxième exemplaire détenu dans le foyer)
```

---

# 🗄 Stockage des informations

Chaque **clé physique** correspond à **une entrée**.

## 📌 Titre de l’entrée

Le titre correspond au code écrit sur les clés :

```
1P1A
```

---

## 📋 Champs recommandés

* Site
* Type
* Serrure (description précise)
* Copie
* Statut (En réserve / Prêtée / Perdue)
* Détenteur actuel
* Date de remise
* Date de retour
* Remarques

---

# 🔁 Gestion des prêts

## 📤 Lorsqu’une clé est prêtée

1. Modifier le champ **Statut → Prêtée**
2. Indiquer le **Détenteur actuel**
3. Renseigner la **Date de remise**

Exemple d’historique :

```
2026-02-28 : remise à Jean (travaux plomberie)
```

---

## 📥 Lorsqu’une clé est rendue

1. Modifier **Statut → Disponible**
2. Renseigner la **Date de retour**
3. Ajouter une ligne dans l’historique

Exemple :

```
2026-03-15 : clé récupérée
```

---

# 🕓 Historique des mouvements

L’historique est conservé dans le champ Notes.

Format recommandé :

```
AAAA-MM-JJ : action - personne - motif
```

Exemple :

```
2026-02-28 : remise à Jean (travaux plomberie)
2026-03-15 : clé récupérée
```

Ce journal conserve la traçabilité même si les champs principaux sont modifiés.

---

# 🔒 Principe de sécurité

Le code inscrit sur la clé :

* Ne contient aucune adresse
* Ne révèle pas la nature du lieu
* N’indique pas la serrure précise

---

# 🚨 Procédure en cas de perte

Si une clé est déclarée perdue :

1. Modifier le statut → Perdue
2. Ajouter une ligne dans l’historique
3. Évaluer le risque
4. Décider si un changement de serrure est nécessaire
5. Mettre à jour les autres copies si applicable

Exemple d’historique :

```
2026-05-12 : clé déclarée perdue
```
