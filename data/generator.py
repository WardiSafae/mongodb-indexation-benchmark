"""
Generateur de 100 000 matchs de football pour MongoDB
Utilise Faker pour generer des donnees realistes
"""

from pymongo import MongoClient
from faker import Faker
import random
from datetime import datetime, timedelta
import time
import os

# Configuration
fake = Faker('fr_FR')
BATCH_SIZE = 1000
TOTAL_MATCHES = 100000

# Configuration MongoDB via variables d'environnement
MONGO_HOST = os.getenv('MONGO_HOST', 'localhost')
MONGO_PORT = os.getenv('MONGO_PORT', '27017')

# Donnees de reference
COMPETITIONS = [
    "Coupe du Monde",
    "Ligue des Champions",
    "Ligue Europa",
    "Premier League",
    "La Liga",
    "Serie A",
    "Bundesliga",
    "Ligue 1"
]

TEAMS = [
    "Real Madrid", "FC Barcelona", "Bayern Munich", "Manchester City",
    "Liverpool", "PSG", "Juventus", "AC Milan", "Inter Milan",
    "Arsenal", "Chelsea", "Manchester United", "Tottenham",
    "Atletico Madrid", "Borussia Dortmund", "Ajax", "Porto",
    "Benfica", "Lyon", "Marseille", "Monaco", "Napoli"
]

STATUSES = ["prevu", "en cours", "termine"]
STADES = [
    "Camp Nou", "Santiago Bernabeu", "Allianz Arena", "Old Trafford",
    "Anfield", "Parc des Princes", "San Siro", "Emirates Stadium",
    "Stamford Bridge", "Signal Iduna Park", "Etihad Stadium"
]


def generate_match(match_id):
    """Genere un match de football avec des donnees realistes"""
    status = random.choice(STATUSES)
    home_team = random.choice(TEAMS)
    # Eviter que la meme equipe joue contre elle-meme
    away_team = random.choice([t for t in TEAMS if t != home_team])
    
    # Generation du score en fonction du statut
    if status == "termine":
        home_score = random.randint(0, 5)
        away_score = random.randint(0, 5)
        score = f"{home_score}-{away_score}"
    elif status == "en cours":
        home_score = random.randint(0, 3)
        away_score = random.randint(0, 3)
        score = f"{home_score}-{away_score}"
    else:
        score = "0-0"
    
    # Date aleatoire entre il y a 2 ans et dans 6 mois
    base_date = datetime.now()
    random_days = random.randint(-730, 180)
    match_date = base_date + timedelta(days=random_days)
    
    # TTL: matchs termines expirent dans 30 jours
    expire_at = None
    if status == "termine":
        expire_at = datetime.now() + timedelta(days=30)
    
    return {
        "match_id": match_id,
        "equipe_domicile": home_team,
        "equipe_exterieur": away_team,
        "date": match_date,
        "statut": status,
        "score": score,
        "competition": random.choice(COMPETITIONS),
        "stade": random.choice(STADES),
        "arbitre": fake.name(),
        "spectateurs": random.randint(10000, 90000) if status != "prevu" else None,
        "expire_at": expire_at,
        "created_at": datetime.now()
    }


def main():
    """Fonction principale pour inserer les matchs par lots"""
    print("Connexion a MongoDB...")
    
    # Connexion a MongoDB (dans le conteneur Docker)
    mongo_url = f"mongodb://{MONGO_HOST}:{MONGO_PORT}/"
    client = MongoClient(mongo_url)
    db = client['football_db']
    collection = db['matches']
    
    # Nettoyage de la collection
    print("Suppression des anciennes donnees...")
    collection.drop()
    
    print(f"Generation de {TOTAL_MATCHES} matchs...")
    start_time = time.time()
    
    # Insertion par lots pour optimiser les performances
    for batch_start in range(0, TOTAL_MATCHES, BATCH_SIZE):
        batch = []
        for i in range(batch_start, min(batch_start + BATCH_SIZE, TOTAL_MATCHES)):
            batch.append(generate_match(i + 1))
        
        # Insertion par lot
        collection.insert_many(batch, ordered=False)
        
        # Affichage de la progression
        progress = ((batch_start + BATCH_SIZE) / TOTAL_MATCHES) * 100
        print(f"   Progression: {min(progress, 100):.1f}% ({batch_start + len(batch)}/{TOTAL_MATCHES})")
    
    elapsed_time = time.time() - start_time
    
    # Statistiques finales
    total_docs = collection.count_documents({})
    print(f"Generation terminee!")
    print(f"   Documents inseres: {total_docs}")
    print(f"   Temps d execution: {elapsed_time:.2f}s")
    print(f"   Vitesse: {total_docs/elapsed_time:.0f} docs/sec")
    
    # Taille de la collection
    stats = db.command("collstats", "matches")
    size_mb = stats['size'] / (1024 * 1024)
    print(f"   Taille de la collection: {size_mb:.2f} MB")


if __name__ == "__main__":
    main()