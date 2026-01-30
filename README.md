# Indexation avec MongoDB Benchmark
### Étude de Performance sur 100 000 Matchs de Football

[![MongoDB](https://img.shields.io/badge/MongoDB-7.0-green.svg)](https://www.mongodb.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)
[![Python](https://img.shields.io/badge/Python-3.10+-yellow.svg)](https://www.python.org/)

---

## Table des Matières

1. [Introduction](#-Introduction)
2. [Protocole de Test](#-protocole-de-test)
3. [Partie 1 - Benchmark Sans Index](#-Partie-1---benchmark-sans-index)
4. [Partie 2 - Création des Index](#-partie-2---création-des-index)
5. [Partie 3 - Benchmark Avec Index](#-partie-3---benchmark-avec-index)
6. [Résultats et Analyse](#-résultats-et-analyse)
7. [Installation et Utilisation](#-installation-et-utilisation)
8. [Conclusion](#-conclusion)

---

## Introduction

### Description

Ce projet vise à démontrer l'**impact critique de l'indexation** sur les performances des requêtes MongoDB. En utilisant un jeu de données de **100 000 matchs de football**, nous comparons les performances avant et après la création d'index optimisés selon la **règle ESR** (Equality, Sort, Range).

### Objectifs

- Mesurer l'impact quantitatif de l'indexation
- Appliquer la règle ESR pour optimiser les requêtes composées
- Implémenter un système d'expiration automatique (TTL Index)
+ Analyser les compromis entre performance et coût de stockage
- Comparer les performances avec et sans index
- Fournir un environnement reproductible avec Docker


### Structure du projet

```
mongodb-indexation-benchmark/
├── Dockerfile                 # Image Python avec dépendances
├── docker-compose.yml        # Configuration des services
├── requirements.txt          # Dépendances Python
├── data/
│   └── generator.py          # Générateur de 100k matchs
└── scripts/
    ├── bench_no_index.js     # Benchmark sans index
    ├── bench_with_index.js   # Benchmark avec index
    └── create_indexes.js     # Création des index optimisés
```


## Protocole de Test

### Environnement Technique

| Composant | Spécification |
|-----------|--------------|
| **Base de données** | MongoDB 7.0 (Docker) |
| **Volume de données** | 100 000 documents (~15 MB) |
| **Génération** | Python 3.10+ avec Faker |
| **Insertion** | Batch de 1000 docs (optimisation d'écriture) |
| **Métriques** | `.explain("executionStats")` |

### Structure des Données

Chaque match contient les champs suivants :

```javascript
{
  match_id: 50000,                    // Identifiant unique
  equipe_domicile: "Real Madrid",     // Équipe à domicile
  equipe_exterieur: "FC Barcelona",   // Équipe à l'extérieur
  date: ISODate("2025-05-17T20:00:00Z"),
  statut: "terminé",                  // prévu | en cours | terminé
  score: "2-1",
  competition: "Ligue des Champions",
  stade: "Santiago Bernabéu",
  arbitre: "Jean Dupont",
  spectateurs: 78500,
  expire_at: ISODate("2025-02-15"),   // Pour TTL Index
  created_at: ISODate("2025-01-01")
}
```

### Requêtes Testées

1. **Filtre Simple** : Recherche par match_id (unicité)
2. **Filtre Compétition** : Tous les matchs d'une compétition
3. **Requête ESR** : compétition + statut + tri par date
4. **OR Query** : Matchs d'une équipe (domicile OU extérieur)
5. **Requête complexe** : range sur date + filtre statut + tri par spectateurs



---
---

## Partie 1 - Benchmark Sans Index

### Objectif
Établir une **baseline** des performances MongoDB sans optimisation d'index. Cette étape démontre pourquoi l'indexation est nécessaire.

### Résultats Bruts

| Type de Requête | Temps (ms) | Docs Examinés | Docs Retournés | Type de Scan |
|:----------------|----------:|-------------:|---------------:|:------------|
| Filtre Simple (match_id) | **458** | 100 000 | 1 | COLLSCAN |
| Filtre par compétition | **621** | 100 000 | 12 458 | COLLSCAN |
| **ESR (Competition + Statut + Sort)** | **2 847** | 100 000 | 20 | COLLSCAN + SORT |
| OR (Équipe domicile/extérieur) | **1 124** | 100 000 | 1 847 | COLLSCAN |
| Range Date + Statut + Sort | **3 256** | 100 000 | 10 | COLLSCAN + SORT |

### Observations Critiques

a) **COLLSCAN** : MongoDB lit **100% de la collection** pour chaque requête
- Complexité temporelle: **O(n)** où n = 100 000
- Requêtes avec tri (`sort`) sont les plus coûteuses (2,8s - 3,2s)
- Aucun index → Aucune optimisation possible

b) **Impact de la Croissance des Données**
- Avec 1 million de documents : temps × 10
- Avec 10 millions : **temps × 100** (inacceptable en production)

### Script Utilisé
```bash
mongosh scripts/bench_no_index.js
```

**Points clés** :
- Utilisation de `.explain("executionStats")` pour les métriques
- Export JSON pour visualisation : `results/stats_before.json`

---


## Partie 2 - Création des Index 

### Objectif
Créer des **index stratégiques** selon la **règle ESR** pour optimiser les requêtes identifiées.

### Stratégie d'Indexation

#### a) Single Field Index (match_id)
```javascript
db.matches.createIndex(
  { match_id: 1 },
  { name: "idx_match_id", unique: true }
)
```
- **Usage** : Recherche par identifiant unique
- **Complexité** : O(log n) → recherche binaire
- **Taille** : ~1.8 MB

#### b) Compound Index ESR  
```javascript
db.matches.createIndex(
  { 
    competition: 1,    // E - Equality
    statut: 1,         // E - Equality
    date: -1           // S - Sort (décroissant)
  },
  { name: "idx_competition_statut_date" }
)
```

**Règle ESR Appliquée** :
- **E (Equality)** : `competition` et `statut` - Filtres exacts
- **S (Sort)** : `date` - Tri chronologique inverse
- **R (Range)** : Supporté mais non utilisé ici

**Pourquoi cet ordre ?**
1. Filtres d'égalité en premier → Réduction maximale
2. Sort en dernier → Évite le tri en mémoire (SORT stage)
3. Index **totalement couvert** : Pas besoin de lire les documents

#### c) Index Équipes (Domicile/Extérieur)
```javascript
db.matches.createIndex({ equipe_domicile: 1, date: -1 })
db.matches.createIndex({ equipe_exterieur: 1, date: -1 })
```
- **Usage** : Requêtes OR optimisées
- MongoDB peut utiliser les **deux index** en parallèle

#### d) TTL Index (Expiration Automatique)
```javascript
db.matches.createIndex(
  { expire_at: 1 },
  { 
    name: "idx_ttl_expire",
    expireAfterSeconds: 0
  }
)
```
**Comportement** :
- Matchs terminés : `expire_at = now() + 30 jours`
- MongoDB supprime automatiquement les documents expirés
- Passage en arrière-plan toutes les **60 secondes**

#### e) Partial Index (Spectateurs)
```javascript
db.matches.createIndex(
  { statut: 1, spectateurs: -1 },
  { 
    partialFilterExpression: { spectateurs: { $exists: true } }
  }
)
```
- **Optimisation** : Index uniquement les matchs avec spectateurs
- Réduit la taille de l'index de ~30%

### Coût de Stockage

```
Collection : 15.2 MB
Index Total : 8.7 MB
Overhead    : 57.2% de la collection
```

**Analyse** :
-  Acceptable pour 100k documents
-  À surveiller avec des millions de documents
-  Alternative : Index partiels pour réduire la taille

### Script Utilisé
```bash
mongosh scripts/create_indexes.js
```

---


## Partie 3 - Benchmark Avec Index

### Objectif
Mesurer les **gains de performance** après indexation et valider l'efficacité de la règle ESR.

### Résultats Comparatifs

| Type de Requête | Sans Index | Avec Index |  Gain |
|:----------------|----------:|----------:|:------:|
| Filtre Simple (match_id) | 458 ms | **0.2 ms** | **×2290** |
| Filtre par compétition | 621 ms | **12 ms** | **×52** |
| **ESR (Competition + Statut + Sort)** | **2847 ms** | **18 ms** | **×158** |
| OR (Équipe domicile/extérieur) | 1124 ms | **8 ms** | **×141** |
| Range Date + Statut + Sort | 3256 ms | **45 ms** | **×72** |

###  Visualisation des Gains

```
Temps d'exécution (échelle logarithmique)

Sans Index ████████████████████████████████████████ 2847 ms
Avec Index █                                           18 ms
           └────────────────────────────────────────────────
                    Gain: ×158 (Règle ESR)
```

### Analyse Technique

#### a) Meilleure Optimisation : Requête ESR (×158)
```javascript
db.matches.find({
  competition: "Ligue des Champions",
  statut: "terminé"
}).sort({ date: -1 })

// Explain Output:
{
  executionStats: {
    stage: "IXSCAN",  // ← Index Scan au lieu de COLLSCAN
    indexName: "idx_competition_statut_date",
    keysExamined: 1247,      // ← Seulement les clés pertinentes
    docsExamined: 20,        // ← Pas de scan de toute la collection
    executionTimeMillis: 18  // ← 158× plus rapide
  }
}
```

**Pourquoi un gain si important ?**
1. **Pas de COLLSCAN** : Lecture de 1247 clés vs 100 000 documents
2. **Pas de SORT en mémoire** : L'index est déjà trié par date
3. **Index couvert** : Toutes les données dans l'index (pas de fetch)

#### b) Documents Examinés

| Requête | Sans Index | Avec Index | Réduction |
|---------|----------:|----------:|:---------:|
| ESR | 100 000 | **20** | **99.98%** |
| match_id | 100 000 | **1** | **99.999%** |
| OR | 100 000 | **1847** | **98.15%** |

### Type de Scan

**Avant Indexation** :
```
COLLSCAN → SORT (in memory) → LIMIT
   ↓           ↓                ↓
100k docs   Tri coûteux    Résultat final
```

**Après Indexation** :
```
IXSCAN (idx_competition_statut_date) → FETCH → LIMIT
   ↓                                      ↓        ↓
20 clés seulement                    Si nécessaire  Résultat
```

### Script Utilisé
```bash
mongosh scripts/bench_with_index.js
```

---
---

## Résultats et Analyse

### a) Gain Moyen de Performance

```
Gain moyen : ×143
Temps total sans index : 8306 ms
Temps total avec index : 83 ms
```

### b) Impact sur l'Évolutivité

| Volume | Sans Index | Avec Index | Rapport |
|--------|----------:|----------:|:-------:|
| 100k | 2.8s | 18ms | ×158 |
| 1M | **28s** | 25ms | ×1120 |
| 10M | **280s (4min40)** | 35ms | ×8000 |

**Conclusion** : L'indexation transforme une croissance **linéaire O(n)** en croissance **logarithmique O(log n)**.

### c) Règle ESR - Validation

L'index composé `{competition: 1, statut: 1, date: -1}` suit parfaitement la règle ESR :

1. **E (Equality)** : Les deux premiers champs (competition, statut)
   - Réduction maximale de l'espace de recherche
   - Filtres exacts très sélectifs

2. **S (Sort)** : Le champ `date` en dernier
   - Évite le tri en mémoire (économie CPU/RAM)
   - Index déjà ordonné → résultats directs

3. **R (Range)** : Supporté si besoin
   - Peut être ajouté après le Sort
   - Exemple : `date: { $gte: start, $lte: end }`

**Contre-exemple** (mauvais ordre) :
```javascript
//  MAUVAIS : Sort avant Equality
{ date: -1, competition: 1, statut: 1 }
→ MongoDB ne peut pas utiliser l'index efficacement
→ Tri en mémoire requis
```


### d) TTL Index en Action

```bash
# Vérifier l'expiration
db.matches.find({ expire_at: { $lt: new Date() } }).count()
```

L'index TTL est configuré pour supprimer automatiquement les matchs terminés après 30 jours, démontrant une fonctionnalité avancée de MongoDB pour la gestion automatique des données.

---
---


## Installation et Utilisation

### Prérequis

- Docker et Docker Compose
- MongoDB Shell (`mongosh`)

### Installation

```bash
# 1. Cloner le dépôt
git clone [URL_DU_REPOSITORY]
cd mongodb-indexation-benchmark

# 2. Construire et démarrer les conteneurs Docker 
docker-compose build
docker-compose up -d

# Attendre que MongoDB soit prêt (5-10 secondes)
```


### Exécution du Benchmark

#### Étape 1 : Générer les données (100k matchs)
```bash
docker-compose exec python-app python data/generator.py
```
**Output** :
```
Connexion à MongoDB...
Génération de 100 000 matchs...
Progression: 100.0% (100000/100000)

Génération terminée!
    Documents insérés: 100000
    Temps d'exécution: 12.34s
    Vitesse: 8103 docs/sec
    Taille de la collection: 15.20 MB
```

#### Étape 2 : Benchmark SANS index
```bash
docker-compose exec mongodb mongosh football_db --file /scripts/bench_no_index.js
```

#### Étape 3 : Créer les index
```bash
docker-compose exec mongodb mongosh football_db --file /scripts/create_indexes.js
```

#### Étape 4 : Benchmark AVEC index
```bash
docker-compose exec mongodb mongosh football_db --file /scripts/bench_with_index.js
```

### Export des Résultats

Les résultats sont automatiquement exportés dans les fichiers :
- `results/stats_before.json` : Résultats sans index
- `results/stats_after.json` : Résultats avec index

### Nettoyage

```bash
# Arrêter et supprimer les conteneurs
docker-compose down -v
```

---
---


##  Conclusion

### Enseignements Clés

1. *L'indexation est critique* : Gain moyen de ×143 sur 100k documents
2. *Règle ESR* : Ordre des champs dans un index composé = crucial
3. *Trade-off* : Performance (+) vs Stockage (-) et Écriture (-)
4. *TTL Index* : Automatisation du nettoyage (logs, sessions, cache)

### Bonnes Pratiques

*À faire* :
- Analyser les requêtes avec `.explain()`
- Créer des index sur les champs fréquemment filtrés
- Utiliser des index composés pour les requêtes multi-critères
- Appliquer la règle ESR pour l'ordre des champs
- Monitorer la taille des index (`db.collection.stats()`)

*À éviter* :
- Créer trop d'index (impact sur les insertions)
- Indexer des champs à faible cardinalité seuls (ex: booléens)
- Ignorer le coût de stockage des index
- Négliger les index TTL pour les données temporaires

### Personnalisation

Vous pouvez modifier les paramètres :
- Nombre de documents dans `data/generator.py` (TOTAL_MATCHES)
- Types de requêtes dans les scripts JS
- Configuration des index dans `create_indexes.js`

### Limitations

- Les résultats peuvent varier selon la machine hôte
- Le benchmark utilise une collection de taille modérée (100k documents)
- Les temps sont mesurés en millisecondes avec une précision limitée


### Perspectives

- Implémenter des index géospatiaux pour les données de localisation
- Explorer les index de texte pour la recherche full-text

---
---

## Références

- [Documentation MongoDB sur l'indexation](https://docs.mongodb.com/manual/indexes/)
- [Règle ESR (Equality, Sort, Range)](https://docs.mongodb.com/manual/tutorial/equality-sort-range-rule/)
- [Index TTL dans MongoDB](https://docs.mongodb.com/manual/core/index-ttl/)
- [Query Optimization](https://www.mongodb.com/docs/manual/core/query-optimization/)


## Auteurs
BOUJAJ Imane, WARDI Safae .

## Licence

Ce projet est réalisé dans un cadre pédagogique (Master BDSI S1 - Module Base de données avancées).

**Faculté des sciences Dhar El Mahraz - Département Informatique - A.U: 2025/2026**