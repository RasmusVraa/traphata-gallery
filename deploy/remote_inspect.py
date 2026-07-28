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
    "ls -la /var/www/",
    "ls -la /etc/nginx/sites-enabled/",
    "ss -tlnp | grep -E '3000|3010|nginx|node' || true",
    "which node; node -v; which certbot || true",
    "test -d /var/www/starlitmoon && echo STARLIT_OK",
    "getent hosts rasmusvraa.site || true",
    "systemctl is-active starlitmoon || true",
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
        print("====", cmd)
        _i, o, e = client.exec_command(cmd)
        print((o.read() + e.read()).decode("utf-8", errors="replace"))
finally:
    client.close()
