"""Run npm with external credentials in memory; never copy secrets into the project."""
import json
import os
import re
import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
source = root.parent / "API.rtf"
env = os.environ.copy()
if env.get("AI_PROVIDER") != "gigachat" and source.is_file():
    raw = subprocess.check_output(["textutil", "-convert", "txt", "-stdout", str(source)], text=True) if sys.platform == "darwin" else source.read_text()
    for name, pattern in [("OPENAI_API_KEY", r"sk-[A-Za-z0-9_-]{20,}"), ("YANDEX_API_KEY", r"AQVN[A-Za-z0-9_-]+")]:
        matches = list(set(re.findall(pattern, raw)))
        if not env.get(name) and len(matches) == 1:
            env[name] = matches[0]
giga_source = root.parent / "GigaChat API.txt"
if env.get("AI_PROVIDER") == "gigachat" and not env.get("GIGACHAT_CREDENTIALS") and giga_source.is_file():
    credential = giga_source.read_text().strip()
    if re.fullmatch(r"[A-Za-z0-9+/]+={0,2}", credential):
        env["GIGACHAT_CREDENTIALS"] = credential
giga_ca = root / ".local-certs" / "gigachat-ca.pem"
if env.get("AI_PROVIDER") == "gigachat" and giga_ca.is_file():
    env.setdefault("NODE_EXTRA_CA_CERTS", str(giga_ca))
if not env.get("AI_PROVIDER"):
    env["AI_PROVIDER"] = "yandex" if env.get("YANDEX_API_KEY") else "openai"
if env["AI_PROVIDER"] == "yandex" and env.get("YANDEX_API_KEY") and not env.get("YANDEX_FOLDER_ID"):
    result = subprocess.run(["curl", "-sS", "--max-time", "25", "--config", "-", "https://ai.api.cloud.yandex.net/v1/models"], input='header = "Authorization: Api-Key ' + env["YANDEX_API_KEY"] + '"\n', capture_output=True, text=True)
    try:
        models = json.loads(result.stdout).get("data", [])
        folders = {m["id"].split("/")[2] for m in models if m.get("id", "").startswith("gpt://")}
        if len(folders) == 1:
            env["YANDEX_FOLDER_ID"] = folders.pop()
    except (ValueError, KeyError, IndexError):
        pass
if env["AI_PROVIDER"] == "gigachat" and not env.get("GIGACHAT_CREDENTIALS"):
    sys.exit("Ключ GigaChat не найден. Проверьте внешний GigaChat API.txt или GIGACHAT_CREDENTIALS.")
if env["AI_PROVIDER"] == "yandex":
    if not env.get("YANDEX_API_KEY") or not env.get("YANDEX_FOLDER_ID"):
        sys.exit("Не удалось настроить Яндекс. Проверьте YANDEX_API_KEY и YANDEX_FOLDER_ID.")
elif env["AI_PROVIDER"] != "gigachat" and not env.get("OPENAI_API_KEY"):
    sys.exit("Ключ не найден. Задайте OPENAI_API_KEY на сервере.")
os.chdir(root)
os.execvpe("npm", ["npm", "run", *(sys.argv[1:] or ["dev"])], env)
