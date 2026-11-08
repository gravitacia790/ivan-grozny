import { spawnSync } from "node:child_process";
import { writeFile, access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const env = { ...process.env, NEXT_PUBLIC_STATIC_PREVIEW: "true", NEXT_PUBLIC_BASE_PATH: "/ivan-grozny", NEXT_TELEMETRY_DISABLED: "1" };
const result = spawnSync(process.execPath, [join(root, "node_modules/next/dist/bin/next"), "build"], { cwd: root, env, stdio: "inherit" });
if (result.status !== 0) process.exit(result.status || 1);
const output = join(root, ".next-pages");
await access(join(output, "index.html"));
await access(join(output, "media/intro-voice-v1.mp3"));
const html = await readFile(join(output, "index.html"), "utf8");
if (!html.includes("/ivan-grozny/_next/") || !html.includes("Тестовая версия для коллег")) throw new Error("Static preview metadata is missing.");
await writeFile(join(output, ".nojekyll"), "");
console.log("GitHub Pages preview prepared in .next-pages/: pages, assets and audio; no server or key included.");
