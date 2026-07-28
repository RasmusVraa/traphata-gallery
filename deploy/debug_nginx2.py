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
    "curl -sS --resolve rasmusvraa.site:443:127.0.0.1 https://rasmusvraa.site/ | head -c 800",
    "echo",
    "echo '=== SSL cert ==='",
    "echo | openssl s_client -connect 127.0.0.1:443 -servername rasmusvraa.site 2>/dev/null | openssl x509 -noout -subject -ext subjectAltName 2>/dev/null | head -20",
    "echo '=== default server blocks ==='",
    "nginx -T 2>/dev/null | awk '/server_name|listen |default_server|return 301/' | head -80",
    "echo '=== dig ==='",
    "dig +short rasmusvraa.site A; dig +short www.rasmusvraa.site A; dig +short rasmusvraa.site AAAA",
    "echo '=== curl no sni / by ip ==='",
    "curl -sSI https://127.0.0.1/ -k | head -20",
    "curl -sSI -H 'Host: rasmusvraa.site' https://127.0.0.1/ -k | head -20",
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
        print((o.read() + e.read()).decode("utf-8", errors="replace"))
finally:
    client.close()
