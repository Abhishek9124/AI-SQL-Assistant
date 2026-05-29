import os
import random
import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "olympics.db"
CSV_PATH = BASE_DIR / "olympics.csv"

random.seed(42)

SUMMER_HOSTS = [
    (1896, "Athina"), (1900, "Paris"), (1904, "St. Louis"), (1908, "London"),
    (1912, "Stockholm"), (1920, "Antwerpen"), (1924, "Paris"), (1928, "Amsterdam"),
    (1932, "Los Angeles"), (1936, "Berlin"), (1948, "London"), (1952, "Helsinki"),
    (1956, "Melbourne"), (1960, "Roma"), (1964, "Tokyo"), (1968, "Mexico City"),
    (1972, "Munich"), (1976, "Montreal"), (1980, "Moskva"), (1984, "Los Angeles"),
    (1988, "Seoul"), (1992, "Barcelona"), (1996, "Atlanta"), (2000, "Sydney"),
    (2004, "Athina"), (2008, "Beijing"), (2012, "London"), (2016, "Rio de Janeiro"),
]
WINTER_HOSTS = [
    (1924, "Chamonix"), (1928, "St. Moritz"), (1932, "Lake Placid"),
    (1936, "Garmisch-Partenkirchen"), (1948, "St. Moritz"), (1952, "Oslo"),
    (1956, "Cortina d'Ampezzo"), (1960, "Squaw Valley"), (1964, "Innsbruck"),
    (1968, "Grenoble"), (1972, "Sapporo"), (1976, "Innsbruck"), (1980, "Lake Placid"),
    (1984, "Sarajevo"), (1988, "Calgary"), (1992, "Albertville"), (1994, "Lillehammer"),
    (1998, "Nagano"), (2002, "Salt Lake City"), (2006, "Torino"), (2010, "Vancouver"),
    (2014, "Sochi"),
]

# (Team, NOC, relative strength weight)
COUNTRIES = [
    ("United States", "USA", 10.0), ("Soviet Union", "URS", 7.5),
    ("Germany", "GER", 6.5), ("Great Britain", "GBR", 6.0), ("France", "FRA", 5.5),
    ("Italy", "ITA", 5.0), ("China", "CHN", 5.5), ("Australia", "AUS", 5.0),
    ("Japan", "JPN", 4.5), ("Canada", "CAN", 4.0), ("Sweden", "SWE", 3.5),
    ("Norway", "NOR", 3.0), ("Netherlands", "NED", 3.5), ("Hungary", "HUN", 3.0),
    ("Russia", "RUS", 5.0), ("Jamaica", "JAM", 2.5), ("Kenya", "KEN", 2.5),
    ("India", "IND", 2.5), ("Brazil", "BRA", 3.0), ("Spain", "ESP", 3.0),
    ("South Korea", "KOR", 3.5), ("Cuba", "CUB", 2.5), ("Finland", "FIN", 2.5),
    ("Switzerland", "SUI", 2.5), ("Poland", "POL", 2.5),
]

# Summer sports -> number of distinct events (drives "most events" query)
SUMMER_SPORTS = {
    "Athletics": 47, "Swimming": 34, "Wrestling": 18, "Gymnastics": 18,
    "Shooting": 15, "Rowing": 14, "Cycling": 18, "Boxing": 13, "Fencing": 10,
    "Weightlifting": 15, "Sailing": 10, "Canoeing": 16, "Judo": 14,
    "Basketball": 2, "Football": 2, "Hockey": 2, "Tennis": 5, "Diving": 8,
    "Archery": 4, "Equestrianism": 6,
}
WINTER_SPORTS = {
    "Cross Country Skiing": 12, "Speed Skating": 14, "Alpine Skiing": 11,
    "Biathlon": 11, "Figure Skating": 5, "Ice Hockey": 2, "Bobsleigh": 3,
    "Ski Jumping": 4, "Short Track Speed Skating": 8, "Luge": 4,
    "Freestyle Skiing": 10, "Snowboarding": 10,
}

SPORT_HEIGHT = {
    "Basketball": (193, 9), "Swimming": (184, 7), "Athletics": (178, 8),
    "Gymnastics": (164, 7), "Weightlifting": (170, 9), "Rowing": (188, 6),
    "Volleyball": (192, 8),
}

FIRST_M = ["James", "Liam", "Carlos", "Wei", "Hiroshi", "Lars", "Ivan", "Marco",
           "Pierre", "Ahmed", "David", "Sven", "Diego", "Yuki", "Noah", "Omar",
           "Felix", "Andre", "Tomas", "Raj"]
FIRST_F = ["Maria", "Anna", "Li", "Yuki", "Emma", "Sofia", "Olga", "Chloe",
           "Aiko", "Fatima", "Nadia", "Elena", "Ingrid", "Lucia", "Mei", "Sara",
           "Petra", "Zara", "Greta", "Priya"]
LAST = ["Smith", "Ivanov", "Müller", "Garcia", "Tanaka", "Johansson", "Rossi",
        "Dubois", "Kim", "Patel", "Nielsen", "Costa", "Andersson", "Novak",
        "Okafor", "Lopez", "Becker", "Silva", "Larsen", "Khan", "Petrov",
        "Yamamoto", "Mensah", "Kowalski", "Hansen"]

MEDALS = ["Gold", "Silver", "Bronze"]


def _athletes_for(year):
    """Participating-country count grows over time."""
    if year < 1900:
        return 14
    if year < 1936:
        return 18
    if year < 1960:
        return 22
    if year < 1992:
        return 24
    return len(COUNTRIES)


def generate_rows():
    rows = []
    next_id = 1
    weights = [c[2] for c in COUNTRIES]

    def games_block(year, city, season, sports):
        nonlocal next_id
        n_countries = _athletes_for(year)
        present = COUNTRIES[:n_countries]
        games = f"{year} {season}"
        for sport, n_events in sports.items():
            mu, sd = SPORT_HEIGHT.get(sport, (175, 9))
            for event_i in range(max(1, n_events // 2)):
                event = f"{sport} Event {event_i + 1}"
                # field of competitors for this event
                field = random.sample(present, k=min(len(present), random.randint(6, 12)))
                # medals to the strongest-weighted countries (with noise)
                ranked = sorted(field, key=lambda c: c[2] * random.random(), reverse=True)
                for rank, (team, noc, _w) in enumerate(field):
                    sex = "F" if random.random() < 0.42 else "M"
                    first = random.choice(FIRST_F if sex == "F" else FIRST_M)
                    name = f"{first} {random.choice(LAST)}"
                    age = max(15, int(random.gauss(25, 4)))
                    height = round(random.gauss(mu, sd)) if sex == "M" else round(random.gauss(mu - 11, sd))
                    weight = round(height - 100 + random.gauss(0, 8))
                    medal = None
                    if (team, noc) == (ranked[0][0], ranked[0][1]):
                        medal = "Gold"
                    elif len(ranked) > 1 and (team, noc) == (ranked[1][0], ranked[1][1]):
                        medal = "Silver"
                    elif len(ranked) > 2 and (team, noc) == (ranked[2][0], ranked[2][1]):
                        medal = "Bronze"
                    rows.append((next_id, name, sex, float(age), float(height),
                                 float(weight), team, noc, games, year, season,
                                 city, sport, event, medal))
                    next_id += 1

    for year, city in SUMMER_HOSTS:
        games_block(year, city, "Summer", SUMMER_SPORTS)
    for year, city in WINTER_HOSTS:
        games_block(year, city, "Winter", WINTER_SPORTS)

    # --- Seed a few real record-holders for flavour / well-known queries ---
    def seed(name, sex, age, h, w, team, noc, year, season, city, sport, event, medal):
        nonlocal next_id
        rows.append((next_id, name, sex, float(age), float(h), float(w), team,
                     noc, f"{year} {season}", year, season, city, sport, event, medal))
        next_id += 1

    # Michael Phelps — dominant gold count (Top athletes query)
    for yr, cty, n in [(2004, "Athina", 6), (2008, "Beijing", 8),
                       (2012, "London", 4), (2016, "Rio de Janeiro", 5)]:
        for i in range(n):
            seed("Michael Phelps", "M", 19 + (yr - 2004), 193, 88, "United States",
                 "USA", yr, "Summer", cty, "Swimming", f"Swimming Final {i+1}", "Gold")
    # Usain Bolt — Jamaica golds
    for yr, cty in [(2008, "Beijing"), (2012, "London"), (2016, "Rio de Janeiro")]:
        for ev in ["100m", "200m", "4x100m Relay"]:
            seed("Usain Bolt", "M", 21 + (yr - 2008), 195, 94, "Jamaica", "JAM",
                 yr, "Summer", cty, "Athletics", ev, "Gold")
    # Oscar Swahn — oldest gold medalist (real: age 64, 1912 Stockholm, Shooting)
    seed("Oscar Swahn", "M", 64, 178, 80, "Sweden", "SWE", 1912, "Summer",
         "Stockholm", "Shooting", "Running Target Team", "Gold")
    # A couple of Indian medal moments
    seed("Abhinav Bindra", "M", 25, 178, 70, "India", "IND", 2008, "Summer",
         "Beijing", "Shooting", "10m Air Rifle", "Gold")
    seed("Sushil Kumar", "M", 29, 166, 66, "India", "IND", 2012, "Summer",
         "London", "Wrestling", "Freestyle 66kg", "Silver")

    return rows


def build_from_csv():
    import pandas as pd  # only needed for the real dataset path
    print("Found olympics.csv — loading the real dataset…")
    df = pd.read_csv(CSV_PATH)
    conn = sqlite3.connect(DB_PATH)
    df.to_sql("athlete_events", conn, if_exists="replace", index=False)
    n = conn.execute("SELECT COUNT(*) FROM athlete_events").fetchone()[0]
    conn.close()
    print(f"Loaded {n:,} rows from olympics.csv into {DB_PATH.name}")


def build_sample():
    print("olympics.csv not found — generating a representative SAMPLE database…")
    rows = generate_rows()
    if DB_PATH.exists():
        DB_PATH.unlink()
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        """CREATE TABLE athlete_events (
            ID INTEGER, Name TEXT, Sex TEXT, Age REAL, Height REAL, Weight REAL,
            Team TEXT, NOC TEXT, Games TEXT, Year INTEGER, Season TEXT,
            City TEXT, Sport TEXT, Event TEXT, Medal TEXT
        )"""
    )
    conn.executemany(
        "INSERT INTO athlete_events VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", rows
    )
    conn.commit()
    n = conn.execute("SELECT COUNT(*) FROM athlete_events").fetchone()[0]
    conn.close()
    print(f"Generated {n:,} sample rows into {DB_PATH.name}")


if __name__ == "__main__":
    if CSV_PATH.exists():
        build_from_csv()
    else:
        build_sample()
