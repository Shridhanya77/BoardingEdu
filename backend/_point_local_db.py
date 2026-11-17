"""Point DATABASE_URL at the local Postgres already described by DB_*."""
import os
from pathlib import Path
from urllib.parse import quote

from dotenv import load_dotenv

env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(env_path)
local_url = "postgresql://{user}:{password}@{host}:{port}/{name}".format(
    user=quote(os.environ["DB_USER"], safe=""),
    password=quote(os.environ["DB_PASSWORD"], safe=""),
    host=os.environ["DB_HOST"],
    port=os.environ["DB_PORT"],
    name=os.environ["DB_NAME"],
)
original = env_path.read_text(encoding="utf-8")
updated = []
replaced = False
for line in original.splitlines():
    if line.startswith("DATABASE_URL=") and not replaced:
        updated.append(
            "# Railway public proxy closed the TCP connection before Postgres responded."
        )
        updated.append("# " + line)
        updated.append("DATABASE_URL=" + local_url)
        replaced = True
    else:
        updated.append(line)
if not replaced:
    raise SystemExit("DATABASE_URL line was not found")
env_path.write_text("\n".join(updated) + ("\n" if original.endswith("\n") else ""), encoding="utf-8")
print("updated_database_url_host", os.environ["DB_HOST"])
