#!/usr/bin/env python3
"""Deploy rasmusvraa gallery to VPS without touching /var/www/starlitmoon."""
from __future__ import annotations

import os
import sys
import tarfile
import tempfile
from pathlib import Path

import paramiko

from load_env import load_deploy_env

load_deploy_env()

HOST = os.environ.get("DEPLOY_HOST", "31.76.77.134")
USER = os.environ.get("DEPLOY_USER", "root")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "")
# Always use our own dir — never DEPLOY_APP_DIR from sibling project
APP_DIR = "/var/www/rasmusvraa"
ROOT = Path(__file__).resolve().parents[1]

EXCLUDE_DIRS = {"node_modules", ".git", "__pycache__", "uploads"}
EXCLUDE_FILES = {".env", "deploy.local.env"}


def should_skip(rel: Path) -> bool:
    if any(p in EXCLUDE_DIRS for p in rel.parts):
        return True
    if rel.name in EXCLUDE_FILES:
        return True
    return False


def make_archive() -> Path:
    tmp = Path(tempfile.gettempdir()) / "rasmusvraa-deploy.tgz"
    with tarfile.open(tmp, "w:gz") as tar:
        for item in ROOT.rglob("*"):
            if not item.is_file():
                continue
            rel = item.relative_to(ROOT)
            if should_skip(rel):
                continue
            tar.add(item, arcname=str(rel).replace("\\", "/"))
    return tmp


def run(client: paramiko.SSHClient, cmd: str, check: bool = True) -> str:
    print(f"+ {cmd}")
    _stdin, stdout, stderr = client.exec_command(cmd, get_pty=True)
    code = stdout.channel.recv_exit_status()
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    if out.strip():
        try:
            print(out.rstrip())
        except UnicodeEncodeError:
            print(out.rstrip().encode("ascii", errors="replace").decode("ascii"))
    if err.strip():
        try:
            print(err.rstrip(), file=sys.stderr)
        except UnicodeEncodeError:
            print(err.rstrip().encode("ascii", errors="replace").decode("ascii"), file=sys.stderr)
    if check and code != 0:
        raise RuntimeError(f"Command failed ({code}): {cmd}")
    return out


def main() -> None:
    if not PASSWORD:
        print("Set DEPLOY_PASSWORD", file=sys.stderr)
        sys.exit(1)

    archive = make_archive()
    print(f"Archive: {archive} ({archive.stat().st_size // 1024} KB)")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)

    try:
        # Safety: never touch starlitmoon
        run(client, "test -d /var/www/starlitmoon && echo starlitmoon_ok")
        run(client, f"mkdir -p {APP_DIR}/uploads")
        run(client, "mkdir -p /tmp/rasmusvraa-incoming")

        sftp = client.open_sftp()
        remote_tgz = "/tmp/rasmusvraa-deploy.tgz"
        print(f"Uploading to {remote_tgz}…")
        sftp.put(str(archive), remote_tgz)
        sftp.close()

        run(
            client,
            f"rm -rf /tmp/rasmusvraa-incoming/* && "
            f"tar -xzf {remote_tgz} -C /tmp/rasmusvraa-incoming && "
            f"rsync -a --delete --exclude uploads /tmp/rasmusvraa-incoming/ {APP_DIR}/ && "
            f"mkdir -p {APP_DIR}/uploads && "
            f"chown -R www-data:www-data {APP_DIR} && "
            f"rm -f {remote_tgz}",
        )

        run(client, f"cd {APP_DIR} && npm install --omit=dev")

        run(
            client,
            f"cp {APP_DIR}/deploy/systemd/rasmusvraa.service /etc/systemd/system/rasmusvraa.service && "
            f"systemctl daemon-reload && "
            f"systemctl enable rasmusvraa && "
            f"systemctl restart rasmusvraa",
        )

        run(
            client,
            f"cp {APP_DIR}/deploy/nginx/rasmusvraa.conf /etc/nginx/sites-available/rasmusvraa && "
            f"ln -sfn /etc/nginx/sites-available/rasmusvraa /etc/nginx/sites-enabled/rasmusvraa && "
            f"nginx -t && systemctl reload nginx",
        )

        # SSL if certbot available and cert missing
        run(
            client,
            "if [ ! -d /etc/letsencrypt/live/rasmusvraa.site ]; then "
            "certbot --nginx -d rasmusvraa.site -d www.rasmusvraa.site "
            "--non-interactive --agree-tos --register-unsafely-without-email --redirect || true; "
            "else echo ssl_already_present; fi",
            check=False,
        )

        run(client, "systemctl is-active rasmusvraa")
        run(client, "curl -sS -o /dev/null -w '%{http_code}' -H 'Host: rasmusvraa.site' http://127.0.0.1/")
        run(client, "ls /etc/nginx/sites-enabled/")
        print("Deploy OK — starlitmoon left untouched.")
    finally:
        client.close()


if __name__ == "__main__":
    main()
