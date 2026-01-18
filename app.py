from flask import Flask, render_template, request, redirect, jsonify
import sqlite3
from datetime import datetime

app = Flask(__name__)
DB = "bjj.db"

def get_db():
    return sqlite3.connect(DB)

def init_db():
    db = get_db()
    c = db.cursor()

    c.execute('''CREATE TABLE IF NOT EXISTS journal
                 (id INTEGER PRIMARY KEY,
              content TEXT,
              timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS move_maps
                 (id INTEGER PRIMARY KEY,
              name TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP)''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS moves
                 (id INTEGER PRIMARY KEY,
              name TEXT,
              x INTEGER,
              y INTEGER,
              map_id INTEGER DEFAULT 1,
              FOREIGN KEY(map_id) REFERENCES move_maps(id))''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS move_profiles
                 (id INTEGER PRIMARY KEY,
              name TEXT UNIQUE,
              hit_count INTEGER DEFAULT 0,
              notes TEXT)''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS transitions
                 (id INTEGER PRIMARY KEY,
              from_move_id INTEGER,
              to_move_id INTEGER,
              FOREIGN KEY(from_move_id) REFERENCES moves(id),
              FOREIGN KEY(to_move_id) REFERENCES moves(id))''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS hit_history
                 (id INTEGER PRIMARY KEY,
              move_name TEXT,
              timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY(move_name) REFERENCES move_profiles(name))''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS check_ins
                 (id INTEGER PRIMARY KEY,
              date DATE UNIQUE,
              timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)''')
    
    # Migrate existing database - add missing columns
    try:
        c.execute("SELECT timestamp FROM journal LIMIT 1")
    except sqlite3.OperationalError:
        c.execute("ALTER TABLE journal ADD COLUMN timestamp DATETIME DEFAULT CURRENT_TIMESTAMP")
    
    try:
        c.execute("SELECT map_id FROM moves LIMIT 1")
    except sqlite3.OperationalError:
        c.execute("ALTER TABLE moves ADD COLUMN map_id INTEGER DEFAULT 1")
    
    # Create default map if none exists
    c.execute("SELECT COUNT(*) FROM move_maps")
    if c.fetchone()[0] == 0:
        c.execute("INSERT INTO move_maps (name) VALUES ('Main Map')")
    
    db.commit()
    db.close()


@app.route("/", methods=["GET", "POST"])
def journal():
    db = get_db()
    db.row_factory = sqlite3.Row
    c = db.cursor()

    if request.method == "POST":
        text = request.form["content"]
        c.execute("INSERT INTO journal (content, timestamp) VALUES (?, ?)", 
                  (text, datetime.now()))
        db.commit()

    c.execute("SELECT id, content, timestamp FROM journal ORDER BY id DESC")
    entries = [dict(row) for row in c.fetchall()]
    db.close()

    return render_template("journal.html", entries=entries)


@app.route("/moves", methods=["GET", "POST"])
@app.route("/moves/<int:map_id>", methods=["GET", "POST"])
def moves(map_id=1):
    db = get_db()
    db.row_factory = sqlite3.Row
    c = db.cursor()

    if request.method == "POST":
        name = request.form["name"]
        c.execute(
            "INSERT INTO moves (name, x, y, map_id) VALUES (?, ?, ?, ?)",
            (name, 100, 100, map_id),
        )
        db.commit()

    c.execute("SELECT id, name, x, y FROM moves WHERE map_id = ?", (map_id,))
    moves = c.fetchall()
    
    c.execute("SELECT from_move_id, to_move_id FROM transitions")
    transitions = c.fetchall()
    
    c.execute("SELECT id, name FROM move_maps ORDER BY id")
    maps = c.fetchall()
    
    # Get current map name
    current_map_name = next((m['name'] for m in maps if m['id'] == map_id), 'Main')
    
    c.execute("SELECT name FROM move_profiles ORDER BY name")
    move_profiles = [row[0] for row in c.fetchall()]
    
    db.close()

    return render_template("moves.html", moves=moves, transitions=transitions, 
                         maps=maps, current_map_id=map_id, move_profiles=move_profiles,
                         current_map_name=current_map_name)


@app.route("/save_position", methods=["POST"])
def save_position():
    data = request.get_json()

    db = get_db()
    db.execute(
        "UPDATE moves SET x = ?, y = ? WHERE id = ?",
        (data["x"], data["y"], data["id"])
    )
    db.commit()
    db.close()

    return "", 204


@app.route("/create_transition", methods=["POST"])
def create_transition():
    data = request.get_json()
    
    db = get_db()
    # Check if transition already exists
    existing = db.execute(
        "SELECT id FROM transitions WHERE from_move_id = ? AND to_move_id = ?",
        (data["from_move_id"], data["to_move_id"])
    ).fetchone()
    
    if not existing:
        db.execute(
            "INSERT INTO transitions (from_move_id, to_move_id) VALUES (?, ?)",
            (data["from_move_id"], data["to_move_id"])
        )
        db.commit()
    db.close()
    
    return "", 204


@app.route("/delete_transition", methods=["POST"])
def delete_transition():
    data = request.get_json()
    
    db = get_db()
    db.execute(
        "DELETE FROM transitions WHERE from_move_id = ? AND to_move_id = ?",
        (data["from_move_id"], data["to_move_id"])
    )
    db.commit()
    db.close()
    
    return "", 204


@app.route("/create_map", methods=["POST"])
def create_map():
    data = request.get_json()
    db = get_db()
    c = db.cursor()
    c.execute("INSERT INTO move_maps (name) VALUES (?)", (data["name"],))
    map_id = c.lastrowid
    db.commit()
    db.close()
    return jsonify({"id": map_id}), 201


@app.route("/move_profile/<move_name>", methods=["GET", "POST"])
def move_profile(move_name):
    db = get_db()
    db.row_factory = sqlite3.Row
    c = db.cursor()
    
    if request.method == "POST":
        notes = request.form.get("notes", "")
        hit_count = int(request.form.get("hit_count", 0))
        
        c.execute("""INSERT OR REPLACE INTO move_profiles (name, notes, hit_count)
                     VALUES (?, ?, ?)""", (move_name, notes, hit_count))
        db.commit()
    
    c.execute("SELECT * FROM move_profiles WHERE name = ?", (move_name,))
    profile = c.fetchone()
    
    if not profile:
        c.execute("INSERT INTO move_profiles (name, hit_count, notes) VALUES (?, 0, '')", 
                  (move_name,))
        db.commit()
        c.execute("SELECT * FROM move_profiles WHERE name = ?", (move_name,))
        profile = c.fetchone()
    
    # Get today's hit count
    today = datetime.now().strftime("%Y-%m-%d")
    c.execute("""SELECT COUNT(*) as count 
                 FROM hit_history 
                 WHERE move_name = ? AND date(timestamp) = ?""", (move_name, today))
    today_hits = c.fetchone()[0]
    
    # Get daily best (max hits in a single day)
    c.execute("""SELECT MAX(daily_count) as best FROM (
                     SELECT COUNT(*) as daily_count 
                     FROM hit_history 
                     WHERE move_name = ? 
                     GROUP BY date(timestamp)
                 )""", (move_name,))
    daily_best_result = c.fetchone()
    daily_best = daily_best_result[0] if daily_best_result[0] else 0
    
    # Get hit history grouped by date for graph (sessions)
    c.execute("""SELECT date(timestamp) as date, COUNT(*) as count 
                 FROM hit_history 
                 WHERE move_name = ? 
                 GROUP BY date(timestamp) 
                 ORDER BY date(timestamp)""", (move_name,))
    hit_history = [dict(row) for row in c.fetchall()]
    
    db.close()
    return render_template("move_profile.html", profile=profile, hit_history=hit_history,
                         today_hits=today_hits, daily_best=daily_best)


@app.route("/update_hit_count", methods=["POST"])
def update_hit_count():
    data = request.get_json()
    db = get_db()
    db.execute("""INSERT INTO move_profiles (name, hit_count, notes)
                  VALUES (?, 1, '')
                  ON CONFLICT(name) DO UPDATE SET hit_count = hit_count + 1""",
               (data["move_name"],))
    # Log to hit history
    db.execute("INSERT INTO hit_history (move_name, timestamp) VALUES (?, ?)",
               (data["move_name"], datetime.now()))
    db.commit()
    db.close()
    return "", 204


@app.route("/delete_move", methods=["POST"])
def delete_move():
    data = request.get_json()
    move_id = data["move_id"]
    
    db = get_db()
    # Delete associated transitions
    db.execute("DELETE FROM transitions WHERE from_move_id = ? OR to_move_id = ?", 
               (move_id, move_id))
    # Delete the move
    db.execute("DELETE FROM moves WHERE id = ?", (move_id,))
    db.commit()
    db.close()
    return "", 204


@app.route("/delete_map", methods=["POST"])
def delete_map():
    data = request.get_json()
    map_id = data["map_id"]
    
    db = get_db()
    # Delete associated moves and transitions
    db.execute("DELETE FROM moves WHERE map_id = ?", (map_id,))
    db.execute("DELETE FROM move_maps WHERE id = ?", (map_id,))
    db.commit()
    db.close()
    return "", 204


@app.route("/check_in", methods=["POST"])
def check_in():
    data = request.get_json()
    date_str = data.get("date", datetime.now().strftime("%Y-%m-%d"))
    
    db = get_db()
    try:
        db.execute("INSERT INTO check_ins (date, timestamp) VALUES (?, ?)",
                   (date_str, datetime.now()))
        db.commit()
    except sqlite3.IntegrityError:
        pass  # Already checked in for this date
    db.close()
    return "", 204


@app.route("/get_check_ins", methods=["GET"])
def get_check_ins():
    db = get_db()
    db.row_factory = sqlite3.Row
    c = db.cursor()
    
    c.execute("SELECT date FROM check_ins ORDER BY date")
    check_ins = [row["date"] for row in c.fetchall()]
    
    # Calculate stats
    if check_ins:
        from datetime import timedelta
        total = len(check_ins)
        first_date = datetime.strptime(check_ins[0], "%Y-%m-%d")
        last_date = datetime.strptime(check_ins[-1], "%Y-%m-%d")
        weeks = max(1, (last_date - first_date).days / 7)
        avg_per_week = round(total / weeks, 1)
    else:
        total = 0
        avg_per_week = 0
    
    db.close()
    return jsonify({
        "check_ins": check_ins,
        "total": total,
        "avg_per_week": avg_per_week
    })


if __name__ == "__main__":
    init_db()
    app.run(debug=True)