import psycopg2

pwd = "BoardingEduRailway2026"
print(f"Password length: {len(pwd)}")
print(f"repr: {repr(pwd)}")

conn = psycopg2.connect(
    host="shortline.proxy.rlwy.net",
    port=59951,
    dbname="railway",
    user="postgres",
    password=pwd,
    sslmode="require"
)
cur = conn.cursor()
cur.execute("SELECT current_database(), current_user;")
print("✅ Connected:", cur.fetchone())
cur.execute("""
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' ORDER BY table_name;
""")
print("Tables:", [r[0] for r in cur.fetchall()])
conn.close()