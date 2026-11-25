#!/usr/bin/env python3
"""Reads the database settings from the API env file – the same way API/src/load-env.ts does:
DATABASE_URL if it is set, otherwise DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME.

    dbconfig.py <env-file> name   -> prints the database name
    dbconfig.py <env-file> sql    -> prints SQL that creates the database and the app user
                                     (localhost + '%' for remote access) with that password
"""
import sys
from urllib.parse import unquote, urlsplit


def parse_env(path):
    values = {}
    with open(path, encoding="utf-8-sig") as fh:
        for raw in fh:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key, value = key.strip(), value.strip()
            if key.startswith("export "):
                key = key[7:].strip()
            if value[:1] in ('"', "'") and value[0] in value[1:]:
                value = value[1 : value.index(value[0], 1)]
            else:
                value = value.split("#", 1)[0].strip()  # unquoted: inline comment
            values[key] = value
    return values


env_file, mode = sys.argv[1], sys.argv[2]
env = parse_env(env_file)

if env.get("DATABASE_URL"):
    u = urlsplit(env["DATABASE_URL"])
    user, password, name = unquote(u.username or ""), unquote(u.password or ""), unquote(u.path.lstrip("/"))
else:
    user, password, name = env.get("DB_USER", ""), env.get("DB_PASSWORD", ""), env.get("DB_NAME", "")

if not (user and password and name):
    sys.exit(f"{env_file}: set DB_HOST, DB_PORT, DB_USER, DB_PASSWORD and DB_NAME (or DATABASE_URL)")

if mode == "name":
    print(name)
elif mode == "sql":
    lit = lambda s: "'" + s.replace("\\", "\\\\").replace("'", "''") + "'"
    db = "`" + name.replace("`", "``") + "`"
    print(f"CREATE DATABASE IF NOT EXISTS {db} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;")
    for host in ("localhost", "%"):
        account = f"{lit(user)}@{lit(host)}"
        print(f"CREATE USER IF NOT EXISTS {account} IDENTIFIED BY {lit(password)};")
        print(f"ALTER USER {account} IDENTIFIED BY {lit(password)};")  # keeps the password in sync with the secret
        print(f"GRANT ALL PRIVILEGES ON {db}.* TO {account};")
    print("FLUSH PRIVILEGES;")
else:
    sys.exit(f"unknown mode: {mode}")
