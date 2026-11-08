#!/usr/bin/env python3
"""Assemble real, already lip-synced clips. Does not generate speech or lip motion."""
import argparse
import json
import math
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


def run(command):
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode:
        # Input paths here are media paths supplied by the operator, never credentials.
        raise ValueError(f"{Path(command[0]).name}: {result.stderr[-1800:]}")
    return result.stdout


def probe(binary, path):
    data = json.loads(run([binary, "-v", "error", "-show_format", "-show_streams", "-of", "json", str(path)]))
    duration = float(data.get("format", {}).get("duration", 0))
    if not math.isfinite(duration) or duration <= 0:
        raise ValueError(f"Не удалось определить длительность: {path.name}")
    return duration, data.get("streams", [])


def validate_vtt(path, duration):
    text = path.read_text(encoding="utf-8-sig")
    if not text.startswith("WEBVTT"):
        raise ValueError("Субтитры должны начинаться с WEBVTT.")
    timing = re.compile(r"(?m)^(?:(\d+):)?(\d{2}):(\d{2})\.(\d{3})\s+-->\s+(?:(\d+):)?(\d{2}):(\d{2})\.(\d{3})(?:\s+[^\n]*)?$")
    cues = list(timing.finditer(text))
    if not cues:
        raise ValueError("В WebVTT нет временных меток.")
    if len(cues) != len([line for line in text.splitlines() if "-->" in line]):
        raise ValueError("В WebVTT есть некорректная строка временных меток.")
    previous = -1
    for cue in cues:
        values = cue.groups()
        def seconds(offset):
            hours, minutes, secs, millis = values[offset:offset + 4]
            if int(minutes) > 59 or int(secs) > 59:
                raise ValueError("Некорректная временная метка WebVTT.")
            return int(hours or 0) * 3600 + int(minutes) * 60 + int(secs) + int(millis) / 1000
        start, end = seconds(0), seconds(4)
        if start < previous or end <= start or end > duration + 0.15:
            raise ValueError("Проверь порядок и длительность субтитров относительно ролика.")
        previous = start
    return len(cues)


def main():
    parser = argparse.ArgumentParser(description="Сборка MP4 из настоящих видеофрагментов с готовой синхронизацией губ. FFmpeg и FFprobe обязательны.")
    parser.add_argument("--clip", action="append", required=True, type=Path, help="Видео в монтажном порядке; повторить для каждого фрагмента.")
    parser.add_argument("--audio", type=Path, help="Готовая общая озвучка, УЖЕ совпадающая с движением губ. Иначе сохраняется звук клипов.")
    parser.add_argument("--vtt", required=True, type=Path, help="Синхронизированные русские субтитры WebVTT.")
    parser.add_argument("--output", default=Path("public/media/intro.mp4"), type=Path)
    parser.add_argument("--pilot", action="store_true", help="Разрешить короткий пробный ролик вместо полного вступления 30–45 секунд.")
    parser.add_argument("--check-only", action="store_true", help="Проверить файлы без кодирования.")
    parser.add_argument("--ffmpeg", default=shutil.which("ffmpeg"))
    parser.add_argument("--ffprobe", default=shutil.which("ffprobe"))
    args = parser.parse_args()
    if not args.ffmpeg or not args.ffprobe:
        raise ValueError("FFmpeg/FFprobe не найдены. Установите FFmpeg либо передайте пути --ffmpeg и --ffprobe.")
    for path in [*args.clip, args.vtt, *([args.audio] if args.audio else [])]:
        if not path.is_file():
            raise ValueError(f"Файл не найден: {path}")
    clips = [probe(args.ffprobe, path) for path in args.clip]
    duration = sum(item[0] for item in clips)
    if not args.pilot and not 30 <= duration <= 45:
        raise ValueError(f"Длина вступления {duration:.2f} с; нужно 30–45 с. Для короткой пробы используйте --pilot.")
    for path, (_, streams) in zip(args.clip, clips):
        if not any(s["codec_type"] == "video" for s in streams):
            raise ValueError(f"Нет видеопотока: {path.name}")
        if not args.audio and not any(s["codec_type"] == "audio" for s in streams):
            raise ValueError(f"Нет звука в {path.name}. Добавьте готовую общую дорожку через --audio.")
    if args.audio:
        audio_duration, streams = probe(args.ffprobe, args.audio)
        if not any(s["codec_type"] == "audio" for s in streams):
            raise ValueError("В файле озвучки нет аудиопотока.")
        if abs(audio_duration - duration) > 0.25:
            raise ValueError(f"Длины видео ({duration:.2f} с) и озвучки ({audio_duration:.2f} с) не совпадают. Скрипт не растягивает голос и не зацикливает персонажа.")
    cues = validate_vtt(args.vtt, duration)
    print(f"Проверено: {len(clips)} клипов, {duration:.2f} с, {cues} субтитров. Синхронизацию губ необходимо проверить визуально.")
    if args.check_only:
        return
    if args.output.exists():
        raise ValueError(f"Файл уже существует: {args.output}. Выберите новое имя; перезапись отключена.")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="ivan-intro-") as temporary:
        work = Path(temporary)
        normalized = []
        for i, path in enumerate(args.clip):
            target = work / f"part-{i:03}.mp4"
            command = [args.ffmpeg, "-v", "error", "-nostdin", "-i", str(path.resolve()), "-map", "0:v:0", "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p"]
            command += ["-an"] if args.audio else ["-map", "0:a:0", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2"]
            run([*command, str(target)])
            normalized.append(target)
        playlist = work / "clips.txt"
        # Generated names contain no user-controlled shell or concat syntax.
        playlist.write_text("".join(f"file '{p.name}'\n" for p in normalized))
        command = [args.ffmpeg, "-v", "error", "-nostdin", "-f", "concat", "-safe", "1", "-i", str(playlist)]
        if args.audio:
            command += ["-i", str(args.audio.resolve())]
        subtitle_index = 2 if args.audio else 1
        command += ["-i", str(args.vtt.resolve()), "-map", "0:v:0", "-map", "1:a:0" if args.audio else "0:a:0", "-map", f"{subtitle_index}:s:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-c:s", "mov_text", "-metadata:s:s:0", "language=rus", "-movflags", "+faststart"]
        staged = work / "assembled.mp4"
        run([*command, str(staged)])
        final_duration, streams = probe(args.ffprobe, staged)
        video = next(s for s in streams if s["codec_type"] == "video")
        if abs(final_duration - duration) > 0.5 or (video.get("width"), video.get("height")) != (1920, 1080):
            raise ValueError("Параметры итогового файла не соответствуют ожидаемым; файл не опубликован.")
        shutil.copyfile(staged, args.output)
    print(f"Создано: {args.output} ({final_duration:.2f} с, H.264/AAC, 1920×1080).")
    print("Для сайта сохраните исходный WebVTT как public/media/intro.ru.vtt. После сборки проверьте весь звук и движение губ.")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, subprocess.SubprocessError, json.JSONDecodeError) as error:
        sys.exit(str(error))
