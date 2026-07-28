#!/usr/bin/env python3
from __future__ import annotations

import os
import sys
from pathlib import Path

import paramiko

sys.path.insert(0, str(Path(__file__).resolve().parent))
from load_env import load_deploy_env

load_deploy_env()

remote = r"""
python3 - <<'PY'
import base64, urllib.request
png = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)
boundary = "----bound"
body = (
    b"--" + boundary.encode() + b"\r\n"
    b'Content-Disposition: form-data; name="image"; filename="test.png"\r\n'
    b"Content-Type: image/png\r\n\r\n"
    + png
    + b"\r\n--"
    + boundary.encode()
    + b"--\r\n"
)
req = urllib.request.Request(
    "http://127.0.0.1:3010/api/upload",
    data=body,
    headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    method="POST",
)
print(urllib.request.urlopen(req).read().decode())
print(urllib.request.urlopen("http://127.0.0.1:3010/api/images").read().decode())
PY
"""

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(
    os.environ["DEPLOY_HOST"],
    username=os.environ["DEPLOY_USER"],
    password=os.environ["DEPLOY_PASSWORD"],
    timeout=30,
)
try:
    _i, o, e = client.exec_command(remote)
    print((o.read() + e.read()).decode("utf-8", errors="replace"))
finally:
    client.close()
