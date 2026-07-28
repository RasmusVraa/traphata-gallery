#!/usr/bin/env python3
from __future__ import annotations

import os
import sys
from pathlib import Path

import paramiko

sys.path.insert(0, str(Path(__file__).resolve().parent))
from load_env import load_deploy_env

load_deploy_env()

# Restore SSL-aware nginx config without touching starlitmoon
nginx_conf = r"""
upstream rasmusvraa_app {
    server 127.0.0.1:3010;
    keepalive 8;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name rasmusvraa.site www.rasmusvraa.site;

    ssl_certificate /etc/letsencrypt/live/rasmusvraa.site/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rasmusvraa.site/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    client_max_body_size 20m;

    location / {
        proxy_pass http://rasmusvraa_app;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
    }
}

server {
    listen 80;
    listen [::]:80;
    server_name rasmusvraa.site www.rasmusvraa.site;
    return 301 https://$host$request_uri;
}
"""

cmds_after = [
    "nginx -t && systemctl reload nginx",
    "systemctl is-active rasmusvraa",
    "curl -sS -o /dev/null -w 'https=%{http_code}\\n' https://rasmusvraa.site/",
    "curl -sS https://rasmusvraa.site/ | head -c 200",
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
    sftp = client.open_sftp()
    with sftp.file("/etc/nginx/sites-available/rasmusvraa", "w") as f:
        f.write(nginx_conf)
    sftp.close()
    print("Wrote SSL nginx config")
    for cmd in cmds_after:
        print("+", cmd)
        _i, o, e = client.exec_command(cmd)
        print((o.read() + e.read()).decode("utf-8", errors="replace"))
finally:
    client.close()
