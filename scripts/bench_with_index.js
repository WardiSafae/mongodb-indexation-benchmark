/**
 * Benchmark AVEC INDEX
 * Mesure les gains de performance apres indexation
 * Comparaison directe avec les resultats sans index
 */

// Connexion a la base de donnees
const db = connect("mongodb://localhost:27017/football_db");

print("========================================");
print("BENCHMARK AVEC INDEX");
print("========================================");

// Verification du nombre de documents
const totalDocs = db.matches.countDocuments({});
print("Nombre total de matchs: " + totalDocs);

// Verification des index
const indexes = db.matches.getIndexes();
print("Nombre d index: " + indexes.length);

// Tableau pour stocker les resultats
const results = [];

// REQUETE 1: Recherche par ID exact
print("----------------------------------------");
print("REQUETE 1: Recherche par match_id");

const query1 = db.matches.find({ match_id: 50000 }).explain("executionStats");
const indexUsed1 = query1.executionStats.executionStages.indexName || "N/A";

results.push({
    requete: "Filtre Simple (match_id)",
    temps_ms: query1.executionStats.executionTimeMillis,
    docs_examines: query1.executionStats.totalDocsExamined,
    docs_retournes: query1.executionStats.nReturned,
    type_scan: query1.executionStats.executionStages.stage,
    index_utilise: indexUsed1
});

print("Temps d execution: " + query1.executionStats.executionTimeMillis + " ms");
print("Documents examines: " + query1.executionStats.totalDocsExamined);
print("Documents retournes: " + query1.executionStats.nReturned);
print("Type de scan: " + query1.executionStats.executionStages.stage);
print("Index utilise: " + indexUsed1);

// REQUETE 2: Recherche par competition
print("----------------------------------------");
print("REQUETE 2: Filtrage par competition");

const query2 = db.matches.find({ 
    competition: "Ligue des Champions" 
}).explain("executionStats");

const indexUsed2 = query2.executionStats.executionStages.indexName || 
                   (query2.executionStats.executionStages.inputStage ? 
                    query2.executionStats.executionStages.inputStage.indexName : "N/A");

results.push({
    requete: "Filtre par competition",
    temps_ms: query2.executionStats.executionTimeMillis,
    docs_examines: query2.executionStats.totalDocsExamined,
    docs_retournes: query2.executionStats.nReturned,
    type_scan: query2.executionStats.executionStages.stage,
    index_utilise: indexUsed2
});

print("Temps d execution: " + query2.executionStats.executionTimeMillis + " ms");
print("Documents examines: " + query2.executionStats.totalDocsExamined);
print("Documents retournes: " + query2.executionStats.nReturned);
print("Type de scan: " + query2.executionStats.executionStages.stage);
print("Index utilise: " + indexUsed2);

// REQUETE 3: ESR - Equality + Sort + Range
print("----------------------------------------");
print("REQUETE 3: ESR (Competition + Statut + Tri par date)");

const query3 = db.matches.find({
    competition: "Ligue des Champions",
    statut: "termine"
}).sort({ date: -1 }).limit(20).explain("executionStats");

const indexUsed3 = query3.executionStats.executionStages.indexName || 
                   (query3.executionStats.executionStages.inputStage ? 
                    query3.executionStats.executionStages.inputStage.indexName : "N/A");

results.push({
    requete: "ESR (Competition + Statut + Sort)",
    temps_ms: query3.executionStats.executionTimeMillis,
    docs_examines: query3.executionStats.totalDocsExamined,
    docs_retournes: query3.executionStats.nReturned,
    type_scan: query3.executionStats.executionStages.stage,
    index_utilise: indexUsed3
});

print("Temps d execution: " + query3.executionStats.executionTimeMillis + " ms");
print("Documents examines: " + query3.executionStats.totalDocsExamined);
print("Documents retournes: " + query3.executionStats.nReturned);
print("Type de scan: " + query3.executionStats.executionStages.stage);
print("Index utilise: " + indexUsed3);
print("REGLES ESR APPLIQUEE:");
print("   E (Equality) : competition='Ligue des Champions', statut='termine'");
print("   S (Sort)     : date (tri decroissant)");

// REQUETE 4: Recherche par equipe
print("----------------------------------------");
print("REQUETE 4: Matchs d une equipe");

const query4 = db.matches.find({
    $or: [
        { equipe_domicile: "Real Madrid" },
        { equipe_exterieur: "Real Madrid" }
    ]
}).explain("executionStats");

// Pour OR, plusieurs index peuvent etre utilises
const stages4 = query4.executionStats.executionStages;
let indexUsed4 = "N/A";
if (stages4.inputStages) {
    indexUsed4 = stages4.inputStages.map(s => s.indexName).join(", ");
} else if (stages4.indexName) {
    indexUsed4 = stages4.indexName;
}

results.push({
    requete: "OR (Equipe domicile OU exterieur)",
    temps_ms: query4.executionStats.executionTimeMillis,
    docs_examines: query4.executionStats.totalDocsExamined,
    docs_retournes: query4.executionStats.nReturned,
    type_scan: query4.executionStats.executionStages.stage,
    index_utilise: indexUsed4
});

print("Temps d execution: " + query4.executionStats.executionTimeMillis + " ms");
print("Documents examines: " + query4.executionStats.totalDocsExamined);
print("Documents retournes: " + query4.executionStats.nReturned);
print("Index utilises: " + indexUsed4);

// REQUETE 5: Requete complexe avec range
print("----------------------------------------");
print("REQUETE 5: Range sur date + Filtre statut");

const dateDebut = new Date("2024-01-01");
const dateFin = new Date("2024-12-31");

const query5 = db.matches.find({
    date: { $gte: dateDebut, $lte: dateFin },
    statut: "termine"
}).sort({ spectateurs: -1 }).limit(10).explain("executionStats");

const indexUsed5 = query5.executionStats.executionStages.indexName || 
                   (query5.executionStats.executionStages.inputStage ? 
                    query5.executionStats.executionStages.inputStage.indexName : "N/A");

results.push({
    requete: "Range Date + Statut + Sort Spectateurs",
    temps_ms: query5.executionStats.executionTimeMillis,
    docs_examines: query5.executionStats.totalDocsExamined,
    docs_retournes: query5.executionStats.nReturned,
    type_scan: query5.executionStats.executionStages.stage,
    index_utilise: indexUsed5
});

print("Temps d execution: " + query5.executionStats.executionTimeMillis + " ms");
print("Documents examines: " + query5.executionStats.totalDocsExamined);
print("Documents retournes: " + query5.executionStats.nReturned);
print("Index utilise: " + indexUsed5);

// COMPARAISON AVANT/APRES
print("----------------------------------------");
print("COMPARAISON AVANT/APRES INDEXATION");

// Recuperer les resultats sans index
const resultsSansIndex = db.benchmark_results.findOne({ type: "sans_index" });

if (resultsSansIndex) {
    print("| Requete                                 | Sans Idx | Avec Idx |   Gain   |");
    print("|-----------------------------------------|----------|----------|----------|");
    
    results.forEach((r, i) => {
        const before = resultsSansIndex.resultats[i];
        const gain = before ? (before.temps_ms / r.temps_ms).toFixed(0) : "-";
        const requete = r.requete.padEnd(39);
        const avant = String(before ? before.temps_ms : "-").padStart(8);
        const apres = String(r.temps_ms).padStart(8);
        const gainStr = (gain !== "-" ? "x" + gain : "-").padStart(8);
        print("| " + requete + " | " + avant + " | " + apres + " | " + gainStr + " |");
    });
    
    print("|-----------------------------------------|----------|----------|----------|");
    
    // Calculer le gain moyen
    let totalGain = 0;
    let countGain = 0;
    results.forEach((r, i) => {
        const before = resultsSansIndex.resultats[i];
        if (before && before.temps_ms > 0 && r.temps_ms > 0) {
            totalGain += before.temps_ms / r.temps_ms;
            countGain++;
        }
    });
    const avgGain = (totalGain / countGain).toFixed(1);
    print("Gain moyen de performance: x" + avgGain);
}

// SAUVEGARDE DES RESULTATS
print("----------------------------------------");
print("SAUVEGARDE DES RESULTATS");

const summary = {
    date_test: new Date(),
    total_documents: totalDocs,
    avec_index: true,
    nombre_index: indexes.length,
    resultats: results
};

db.benchmark_results.insertOne({
    ...summary,
    type: "avec_index"
});

print("Resultats sauvegardes dans 'benchmark_results'");

// Ajouter à un fichier JSON
print("Export JSON...");
const resultsJson = JSON.stringify(summary, null, 2);
const fs = require('fs');
fs.writeFileSync('/results/stats_after.json', resultsJson);
print("Fichier exporte: /results/stats_after.json");

