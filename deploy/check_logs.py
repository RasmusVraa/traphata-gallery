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
    "tail -n 40 /var/log/nginx/access.log 2>/dev/null || true",
    "ls -la /var/log/nginx/",
    "tail -n 30 /var/log/nginx/starlitmoon.access.log 2>/dev/null || true",
    "grep -h rasmusvraa /var/log/nginx/*.log 2>/dev/null | tail -n 30 || true",
    "curl -sSI https://127.0.0.1/ -H 'Host: rasmusvraa.site' --resolve rasmusvraa.site:443:127.0.0.1 2>/dev/null | head -20 || curl -sSI --resolve rasmusvraa.site:443:127.0.0.1 https://rasmusvraa.site/ | head -20",
    "cat /etc/nginx/sites-available/rasmusvraa",
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
        print("+", cmd[:90])
        _i, o, e = client.exec_command(cmd)
        text = (o.read() + e.read()).decode("utf-8", errors="replace")
        print(text.encode("ascii", "replace").decode())
finally:
    client.close()
