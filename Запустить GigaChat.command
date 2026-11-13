#!/bin/bash
set -e
cd "$(dirname "$0")"
export AI_PROVIDER=gigachat
exec bash "./Запустить сайт.command"
