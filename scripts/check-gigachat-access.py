"""Check OAuth and model access only. No text generation, secrets, or response bodies in logs."""
import json
import os
from pathlib import Path
import re
import sys
import ssl
import urllib.error
import urllib.parse
import urllib.request
import uuid

source = Path(__file__).resolve().parent.parent.parent / "GigaChat API.txt"
key = os.environ.get("GIGACHAT_CREDENTIALS") or (source.read_text().strip() if source.is_file() else "")
if not re.fullmatch(r"[A-Za-z0-9+/]+={0,2}", key):
    sys.exit("Ключ GigaChat отсутствует или имеет неожиданный формат.")
request = urllib.request.Request(
    "https://ngw.devices.sberbank.ru:9443/api/v2/oauth",
    data=urllib.parse.urlencode({"scope": os.environ.get("GIGACHAT_SCOPE", "GIGACHAT_API_PERS")}).encode(),
    headers={"Authorization": "Basic " + key, "RqUID": str(uuid.uuid4()), "Content-Type": "application/x-www-form-urlencoded"},
)
context = ssl.create_default_context()
ca = os.environ.get("NODE_EXTRA_CA_CERTS") or str(Path(__file__).resolve().parent.parent / ".local-certs/gigachat-ca.pem")
if Path(ca).is_file():
    context.load_verify_locations(cafile=ca)
try:
    with urllib.request.urlopen(request, timeout=20, context=context) as response:
        token = json.load(response)["access_token"]
    print("OAuth: OK")
    request = urllib.request.Request("https://api.giga.chat/v1/models", headers={"Authorization": "Bearer " + token})
    with urllib.request.urlopen(request, timeout=20, context=context) as response:
        models = json.load(response)
    print(json.dumps({"models": [model.get("id") for model in models.get("data", [])]}, ensure_ascii=False))
except urllib.error.HTTPError as error:
    sys.exit(f"GigaChat HTTP: {error.code}. Содержимое ответа скрыто.")
except Exception as error:
    reason = getattr(error, "reason", error)
    sys.exit(f"Соединение GigaChat: {type(reason).__name__}. Проверьте сеть и доверенные сертификаты.")
