#!/usr/bin/env python3
"""Load deploy/deploy.local.env (host/user/password). Ignores DEPLOY_APP_DIR."""
from __future__ import annotations

import os
from pathlib import Path

ENV_CANDIDATES = [
    Path(__file__).resolve().parent / "deploy.local.env",
]


def load_deploy_env() -> None:
    for path in ENV_CANDIDATES:
        if not path.is_file():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key == "DEPLOY_APP_DIR":
                continue
            if key and key not in os.environ:
                os.environ[key] = value
        return
    raise SystemExit(
        "Missing deploy/deploy.local.env — copy from deploy.local.env.example"
    )


if __name__ == "__main__":
    load_deploy_env()
    print("HOST=", os.environ.get("DEPLOY_HOST"))
    print("USER=", os.environ.get("DEPLOY_USER"))
    print("PASSWORD_SET=", bool(os.environ.get("DEPLOY_PASSWORD")))
