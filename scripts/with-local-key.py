"""Run npm with the existing external key in memory, without copying it."""
import os
import re
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
source = root.parent / "API.rtf"
env = os.environ.copy()
if not env.get("OPENAI_API_KEY") and source.is_file():
    matches = re.findall(r"sk-[A-Za-z0-9_-]{20,}", source.read_text())
    if len(matches) == 1:
        env["OPENAI_API_KEY"] = matches[0]
if not env.get("OPENAI_API_KEY"):
    sys.exit("Ключ не найден. Задайте OPENAI_API_KEY на сервере.")
os.chdir(root)
os.execvpe("npm", ["npm", "run", *(sys.argv[1:] or ["dev"])], env)
