#!/usr/bin/env python3
from __future__ import annotations

import os
import sys
from pathlib import Path

import paramiko

sys.path.insert(0, str(Path(__file__).resolve().parent))
from load_env import load_deploy_env

load_deploy_env()

cmds = [
    "systemctl is-active rasmusvraa; journalctl -u rasmusvraa -n 40 --no-pager",
    "ls -la /var/www/rasmusvraa/uploads | head -50",
    "wc -c /var/www/rasmusvraa/uploads/meta.json; cat /var/www/rasmusvraa/uploads/meta.json | head -c 2000",
    "curl -sS http://127.0.0.1:3010/api/items | head -c 2000",
    "curl -sS -o /dev/null -w 'home=%{http_code} appjs=%{http_code}\\n' http://127.0.0.1:3010/ http://127.0.0.1:3010/app.js",
    "curl -sS https://rasmusvraa.site/api/items | head -c 1500",
    "ls -la /var/www/rasmusvraa/public/",
]

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(
    os.environ["DEPLOY_HOST"],
    username=os.environ["DEPLOY_USER"],
    password=os.environ["DEPLOY_PASSWORD"],
    timeout=30,
)
try:
    for cmd in cmds:
        print("+", cmd[:100])
        _i, o, e = client.exec_command(cmd)
        text = (o.read() + e.read()).decode("utf-8", errors="replace")
        print(text.encode("ascii", "replace").decode())
finally:
    client.close()
