/**
 * Benchmark SANS INDEX
 * Mesure les performances des requetes avant indexation
 * Utilise explain("executionStats") pour analyser l execution
 */

// Connexion a la base de donnees
const db = connect("mongodb://localhost:27017/football_db");

print("========================================");
print("BENCHMARK SANS INDEX");
print("========================================");

// Verification du nombre de documents
const totalDocs = db.matches.countDocuments({});
print("Nombre total de matchs: " + totalDocs);

// Suppression de tous les index existants (sauf _id)
print("Suppression des index existants...");
db.matches.dropIndexes();
print("Index supprimes");

// Tableau pour stocker les resultats
const results = [];

// REQUETE 1: Recherche par ID exact
print("----------------------------------------");
print("REQUETE 1: Recherche par match_id");

const query1 = db.matches.find({ match_id: 50000 }).explain("executionStats");
results.push({
    requete: "Filtre Simple (match_id)",
    temps_ms: query1.executionStats.executionTimeMillis,
    docs_examines: query1.executionStats.totalDocsExamined,
    docs_retournes: query1.executionStats.nReturned,
    type_scan: query1.executionStats.executionStages.stage
});

print("Temps d execution: " + query1.executionStats.executionTimeMillis + " ms");
print("Documents examines: " + query1.executionStats.totalDocsExamined);
print("Documents retournes: " + query1.executionStats.nReturned);
print("Type de scan: " + query1.executionStats.executionStages.stage);

// REQUETE 2: Recherche par competition
print("----------------------------------------");
print("REQUETE 2: Filtrage par competition");

const query2 = db.matches.find({ 
    competition: "Ligue des Champions" 
}).explain("executionStats");

results.push({
    requete: "Filtre par competition",
    temps_ms: query2.executionStats.executionTimeMillis,
    docs_examines: query2.executionStats.totalDocsExamined,
    docs_retournes: query2.executionStats.nReturned,
    type_scan: query2.executionStats.executionStages.stage
});

print("Temps d execution: " + query2.executionStats.executionTimeMillis + " ms");
print("Documents examines: " + query2.executionStats.totalDocsExamined);
print("Documents retournes: " + query2.executionStats.nReturned);
print("Type de scan: " + query2.executionStats.executionStages.stage);

// REQUETE 3: ESR - Equality + Sort + Range
print("----------------------------------------");
print("REQUETE 3: ESR (Competition + Statut + Tri par date)");

const query3 = db.matches.find({
    competition: "Ligue des Champions",
    statut: "termine"
}).sort({ date: -1 }).limit(20).explain("executionStats");

results.push({
    requete: "ESR (Competition + Statut + Sort)",
    temps_ms: query3.executionStats.executionTimeMillis,
    docs_examines: query3.executionStats.totalDocsExamined,
    docs_retournes: query3.executionStats.nReturned,
    type_scan: query3.executionStats.executionStages.stage
});

print("Temps d execution: " + query3.executionStats.executionTimeMillis + " ms");
print("Documents examines: " + query3.executionStats.totalDocsExamined);
print("Documents retournes: " + query3.executionStats.nReturned);
print("Type de scan: " + query3.executionStats.executionStages.stage);

// REQUETE 4: Recherche par equipe
print("----------------------------------------");
print("REQUETE 4: Matchs d une equipe");

const query4 = db.matches.find({
    $or: [
        { equipe_domicile: "Real Madrid" },
        { equipe_exterieur: "Real Madrid" }
    ]
}).explain("executionStats");

results.push({
    requete: "OR (Equipe domicile OU exterieur)",
    temps_ms: query4.executionStats.executionTimeMillis,
    docs_examines: query4.executionStats.totalDocsExamined,
    docs_retournes: query4.executionStats.nReturned,
    type_scan: query4.executionStats.executionStages.stage
});

print("Temps d execution: " + query4.executionStats.executionTimeMillis + " ms");
print("Documents examines: " + query4.executionStats.totalDocsExamined);
print("Documents retournes: " + query4.executionStats.nReturned);

// REQUETE 5: Requete complexe avec range
print("----------------------------------------");
print("REQUETE 5: Range sur date + Filtre statut");

const dateDebut = new Date("2024-01-01");
const dateFin = new Date("2024-12-31");

const query5 = db.matches.find({
    date: { $gte: dateDebut, $lte: dateFin },
    statut: "termine"
}).sort({ spectateurs: -1 }).limit(10).explain("executionStats");

results.push({
    requete: "Range Date + Statut + Sort Spectateurs",
    temps_ms: query5.executionStats.executionTimeMillis,
    docs_examines: query5.executionStats.totalDocsExamined,
    docs_retournes: query5.executionStats.nReturned,
    type_scan: query5.executionStats.executionStages.stage
});

print("Temps d execution: " + query5.executionStats.executionTimeMillis + " ms");
print("Documents examines: " + query5.executionStats.totalDocsExamined);
print("Documents retournes: " + query5.executionStats.nReturned);

// SAUVEGARDE DES RESULTATS
print("----------------------------------------");
print("SAUVEGARDE DES RESULTATS");

// Creer un document recapitulatif
const summary = {
    date_test: new Date(),
    total_documents: totalDocs,
    avec_index: false,
    resultats: results
};

// Sauvegarder dans une collection separee
db.benchmark_results.insertOne({
    ...summary,
    type: "sans_index"
});

print("Resultats sauvegardes dans la collection 'benchmark_results'");

// Afficher le resume
print("RESUME DES PERFORMANCES (SANS INDEX):");
print("| Requete                                 | Temps(ms) | Docs Examine |");
print("|-----------------------------------------|-----------|--------------|");
results.forEach(r => {
    const requete = r.requete.padEnd(39);
    const temps = String(r.temps_ms).padStart(8);
    const docs = String(r.docs_examines).padStart(12);
    print("| " + requete + " | " + temps + " | " + docs + " |");
});
print("|-----------------------------------------|-----------|--------------|");


// Ajouter à un fichier JSON
print("Export JSON...");
const resultsJson = JSON.stringify(summary, null, 2);
const fs = require('fs');
fs.writeFileSync('/results/stats_before.json', resultsJson);
print("Fichier exporte: /results/stats_before.json");

