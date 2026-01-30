/**
 * Creation des INDEX
 * Application de la regle ESR (Equality, Sort, Range)
 * Implementation d index TTL pour expiration automatique
 */

// Connexion a la base de donnees
const db = connect("mongodb://localhost:27017/football_db");

print("========================================");
print("CREATION DES INDEX OPTIMISES");
print("========================================");

// INDEX 1: Single Field Index sur match_id
print("----------------------------------------");
print("INDEX 1: Single Field sur match_id");

const startTime1 = Date.now();
db.matches.createIndex(
    { match_id: 1 },
    { name: "idx_match_id", unique: true }
);
const time1 = Date.now() - startTime1;

print("Index cree: idx_match_id");
print("   Type: Single Field (Unique)");
print("   Champs: { match_id: 1 }");
print("   Temps: " + time1 + " ms");
print("   Usage: Recherche rapide par identifiant unique");

// INDEX 2: Compound Index ESR sur competition
print("----------------------------------------");
print("INDEX 2: Compound Index ESR");

const startTime2 = Date.now();
db.matches.createIndex(
    { 
        competition: 1,    // E - Equality (filtre exact)
        statut: 1,         // E - Equality (filtre exact)
        date: -1           // S - Sort (tri decroissant)
    },
    { name: "idx_competition_statut_date" }
);
const time2 = Date.now() - startTime2;

print("Index cree: idx_competition_statut_date");
print("   Type: Compound Index (ESR Rule)");
print("   Champs: { competition: 1, statut: 1, date: -1 }");
print("   Temps: " + time2 + " ms");
print("   Regle ESR appliquee:");
print("     • E (Equality): competition, statut - Filtres exacts");
print("     • S (Sort): date - Tri chronologique inverse");
print("     • R (Range): Non utilise ici mais supporte");
print("   Usage: Requetes type 'Matchs LDC termines recents'");

// INDEX 3: Compound Index pour equipes
print("----------------------------------------");
print("INDEX 3: Compound Index Equipes");

const startTime3 = Date.now();
db.matches.createIndex(
    { equipe_domicile: 1, date: -1 },
    { name: "idx_equipe_domicile_date" }
);
db.matches.createIndex(
    { equipe_exterieur: 1, date: -1 },
    { name: "idx_equipe_exterieur_date" }
);
const time3 = Date.now() - startTime3;

print("Index crees: Equipes + Date");
print("   - idx_equipe_domicile_date { equipe_domicile: 1, date: -1 }");
print("   - idx_equipe_exterieur_date { equipe_exterieur: 1, date: -1 }");
print("   Temps: " + time3 + " ms");
print("   Usage: Historique des matchs d une equipe");

// INDEX 4: TTL Index pour expiration auto
print("----------------------------------------");
print("INDEX 4: TTL Index (Time-To-Live)");

const startTime4 = Date.now();
db.matches.createIndex(
    { expire_at: 1 },
    { 
        name: "idx_ttl_expire",
        expireAfterSeconds: 0  // Expire immediatement apres expire_at
    }
);
const time4 = Date.now() - startTime4;

print("Index TTL cree: idx_ttl_expire");
print("   Type: TTL Index (Time-To-Live)");
print("   Champs: { expire_at: 1 }");
print("   Temps: " + time4 + " ms");
print("   Configuration: expireAfterSeconds = 0");
print("   Comportement:");
print("     • Les matchs termines ont expire_at = now + 30 jours");
print("     • MongoDB supprime automatiquement les docs expires");
print("     • Passage en arriere-plan toutes les 60 secondes");
print("   Usage: Nettoyage automatique des vieux matchs");

// INDEX 5: Index pour statistiques
print("----------------------------------------");
print("INDEX 5: Index Spectateurs");

const startTime5 = Date.now();
db.matches.createIndex(
    { statut: 1, spectateurs: -1 },
    { 
        name: "idx_statut_spectateurs",
        partialFilterExpression: { spectateurs: { $exists: true } }
    }
);
const time5 = Date.now() - startTime5;

print("Index cree: idx_statut_spectateurs");
print("   Type: Compound Index avec Partial Filter");
print("   Champs: { statut: 1, spectateurs: -1 }");
print("   Temps: " + time5 + " ms");
print("   Filtre partiel: spectateurs existe");
print("   Usage: Top matchs par affluence");

// ANALYSE DES INDEX CREES
print("----------------------------------------");
print("ANALYSE DES INDEX");

// Lister tous les index
const indexes = db.matches.getIndexes();
print("Nombre total d index: " + indexes.length);

// Taille des index
const stats = db.matches.stats();
print("TAILLE DES INDEX SUR DISQUE:");
const indexSizes = stats.indexSizes;
let totalIndexSize = 0;

Object.keys(indexSizes).forEach(indexName => {
    const sizeMB = (indexSizes[indexName] / (1024 * 1024)).toFixed(2);
    totalIndexSize += indexSizes[indexName];
    print(indexName.padEnd(35) + " : " + String(sizeMB).padStart(8) + " MB");
});

const totalIndexSizeMB = (totalIndexSize / (1024 * 1024)).toFixed(2);
const collectionSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
const overhead = ((totalIndexSize / stats.size) * 100).toFixed(1);

print("----------------------------------------");
print("Taille collection: " + collectionSizeMB + " MB");
print("Taille totale index: " + totalIndexSizeMB + " MB");
print("Overhead: " + overhead + "% de la collection");

// VERIFICATION DES INDEX
print("----------------------------------------");
print("TEST RAPIDE DES INDEX");

// Test index unique
print("Test 1: Index match_id");
const test1 = db.matches.find({ match_id: 50000 }).explain("executionStats");
print("Type: " + test1.executionStats.executionStages.stage);
print("Index utilise: " + test1.executionStats.executionStages.indexName);
print("Temps: " + test1.executionStats.executionTimeMillis + " ms");

// Test index compose ESR
print("Test 2: Index ESR (competition + statut + date)");
const test2 = db.matches.find({
    competition: "Ligue des Champions",
    statut: "termine"
}).sort({ date: -1 }).limit(10).explain("executionStats");
print("Type: " + test2.executionStats.executionStages.stage);
print("Index utilise: " + test2.executionStats.executionStages.indexName);
print("Temps: " + test2.executionStats.executionTimeMillis + " ms");

// SAUVEGARDE CONFIGURATION
print("----------------------------------------");
print("SAUVEGARDE CONFIGURATION");

const indexConfig = {
    date_creation: new Date(),
    indexes: indexes,
    statistiques: {
        taille_collection_mb: parseFloat(collectionSizeMB),
        taille_index_mb: parseFloat(totalIndexSizeMB),
        overhead_pourcent: parseFloat(overhead),
        nombre_documents: db.matches.countDocuments({})
    }
};

db.index_configuration.insertOne(indexConfig);
print("Configuration sauvegardee dans 'index_configuration'");

print("========================================");
print("CREATION DES INDEX TERMINEE");
print("========================================");
print("Pret pour le benchmark avec index!");
print("Executer: mongosh football_db --file /scripts/bench_with_index.js");