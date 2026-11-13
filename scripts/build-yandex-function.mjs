import { readFile, writeFile, mkdir, cp } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = join(root, ".yandex-function");
await mkdir(output, { recursive: true });
// Same independent modules and import mapping used by check-api.mjs.
for (const [source, name] of [
  ["lib/gigachat.ts", "gigachat"], ["lib/lesson-summary.ts", "lesson-summary"],
  ["lib/historical-sources.ts", "historical-sources"],
  ["lib/source-policy.ts", "source-policy"],
  ["lib/research.ts", "research"],
  ["lib/instructions.ts", "instructions"],
  ["app/api/chat/route.ts", "route"],
]) {
  const text = (await readFile(join(root, source), "utf8"))
    .replace(/"(?:@\/lib\/|\.\/)(instructions|historical-sources|source-policy|research|lesson-summary|gigachat)"/g, '"./$1.js"');
  const result = ts.transpileModule(text, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  await writeFile(join(output, `${name}.js`), result.outputText);
}
await cp(join(root, "deployment/yandex-function/handler.js"), join(output, "handler.js"));
await writeFile(join(output, "package.json"), JSON.stringify({ private: true, type: "commonjs" }));
console.log("Yandex Function prepared in .yandex-function/: existing chat route, HTTPS adapter, no runtime dependencies or secrets.");
