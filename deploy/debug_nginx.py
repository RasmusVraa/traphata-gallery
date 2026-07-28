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
    "echo '=== sites-enabled ==='; ls -la /etc/nginx/sites-enabled/",
    "echo '=== sites-available ==='; ls -la /etc/nginx/sites-available/",
    "echo '=== rasmusvraa conf ==='; cat /etc/nginx/sites-enabled/rasmusvraa",
    "echo '=== starlitmoon server_name lines ==='; grep -n 'server_name\\|listen\\|return\\|proxy_pass' /etc/nginx/sites-enabled/starlitmoon | head -80",
    "echo '=== nginx -T server_name ==='; nginx -T 2>/dev/null | grep -E 'server_name|listen |default_server' | head -100",
    "echo '=== curl host rasmusvraa http ==='; curl -sSI -H 'Host: rasmusvraa.site' http://127.0.0.1/ | head -30",
    "echo '=== curl host rasmusvraa https ==='; curl -sSI --resolve rasmusvraa.site:443:127.0.0.1 https://rasmusvraa.site/ | head -40",
    "echo '=== curl follow redirects ==='; curl -sSIL --max-redirs 5 https://rasmusvraa.site/ 2>&1 | head -60",
    "echo '=== default html ==='; ls -la /var/www/html/; head -c 500 /var/www/html/index.nginx-debian.html 2>/dev/null || true",
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
        print(cmd.split("===", 1)[-1][:60] if "===" in cmd else cmd)
        _i, o, e = client.exec_command(cmd)
        out = (o.read() + e.read()).decode("utf-8", errors="replace")
        try:
            print(out)
        except UnicodeEncodeError:
            print(out.encode("ascii", "replace").decode())
finally:
    client.close()
