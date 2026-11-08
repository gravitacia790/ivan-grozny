import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { instructions, answerFormat, checkedAnswer } from "@/lib/instructions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
type Message = { role: "user" | "assistant"; content: string };
const limits = new Map<string, { count: number; expires: number }>();
const reply = (error: string, status: number, extra = {}) => Response.json({ error, ...extra }, { status, headers: { "Cache-Control": "no-store" } });

function allowedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    if (parsed.origin !== origin) return false;
    if (parsed.host === request.headers.get("host")) return true;
    return (process.env.CHAT_ALLOWED_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean).includes(origin);
  } catch { return false; }
}

function withCors(request: Request | undefined, response: Response): Response {
  if (!request || !allowedOrigin(request)) return response;
  const origin = request.headers.get("origin");
  if (origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Vary", "Origin");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");
    response.headers.set("Access-Control-Max-Age", "600");
  }
  return response;
}

export async function GET(request?: Request) {
  if (request && !allowedOrigin(request)) return reply("Источник запроса не разрешён.", 403);
  return withCors(request, Response.json({ configured: Boolean(process.env.OPENAI_API_KEY), materialsApproved: process.env.TEACHER_MATERIALS_APPROVED === "true" }, { headers: { "Cache-Control": "no-store" } }));
}

export async function OPTIONS(request: Request) {
  if (!allowedOrigin(request)) return reply("Источник запроса не разрешён.", 403);
  return withCors(request, new Response(null, { status: 204 }));
}

export async function POST(request: Request) {
  return withCors(request, await handlePost(request));
}

async function handlePost(request: Request) {
  if (!allowedOrigin(request)) return reply("Запрос разрешён только со страницы сайта.", 403);
  if (!process.env.OPENAI_API_KEY) return reply("ИИ пока не подключён. Попроси учителя проверить подключение.", 503);
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > 24000) return reply("Беседа слишком длинная. Сохрани её и начни новую.", 413);
  let body;
  try {
    const reader = request.body?.getReader();
    if (!reader) return reply("Пустой запрос.", 400);
    const chunks: Uint8Array[] = []; let bytes = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 24000) { await reader.cancel(); return reply("Беседа слишком длинная. Сохрани её и начни новую.", 413); }
      chunks.push(value);
    }
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch { return reply("Не удалось прочитать вопрос.", 400); }
  if (!body || !Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 21) return reply("Сохрани беседу и начни новую: достигнут предел сообщений.", 400);
  const messages: Message[] = body.messages;
  if (messages.some((m, i) => !m || m.role !== (i % 2 === 0 ? "user" : "assistant") || typeof m.content !== "string" || !m.content.trim() || m.content.length > (m.role === "user" ? 1000 : 5000)) || messages.at(-1)?.role !== "user") return reply("Проверь вопрос: не больше 1000 символов.", 400);
  // A global ceiling cannot be bypassed by changing the anonymous session ID.
  // Per-process limit is appropriate for one local classroom server.
  const now = Date.now();
  for (const [key, value] of limits) if (value.expires <= now) limits.delete(key);
  const session = typeof body.session === "string" && /^[a-f0-9-]{36}$/i.test(body.session) ? body.session : "anonymous";
  const global = limits.get("global") || { count: 0, expires: now + 60000 };
  const user = limits.get(session) || { count: 0, expires: now + 60000 };
  if (global.count >= 30 || user.count >= 6) return reply("Слишком много вопросов подряд. Подожди минуту и попробуй снова.", 429);
  if (limits.size > 2000) return reply("Сервер занят. Попробуй чуть позже.", 429);
  global.count++; user.count++;
  limits.set("global", global); limits.set(session, user);
  try {
    const materials = await readFile(join(process.cwd(), "content/teacher-materials.md"), "utf8");
    const materialsApproved = process.env.TEACHER_MATERIALS_APPROVED === "true";
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini", store: false,
        instructions: instructions(materials, materialsApproved),
        input: messages.map(({ role, content }) => ({ role, content })),
        max_output_tokens: 700, text: { format: answerFormat }
      }),
      signal: AbortSignal.timeout(25000)
    });
    if (!response.ok) {
      if (response.status === 401) return reply("Сервис ИИ не принял ключ доступа. Попроси учителя проверить ключ OpenAI на сервере.", 503);
      if (response.status === 403 || response.status === 404) return reply("У сервера нет доступа к выбранной модели ИИ. Сообщи учителю.", 503);
      if (response.status === 429) {
        const failure = await response.json().catch(() => ({}));
        return reply(failure.error?.code === "insufficient_quota" ? "На сервере исчерпан баланс или лимит расходов OpenAI. Сообщи учителю." : "Сервис ИИ получил слишком много запросов. Подожди минуту и попробуй снова.", 503);
      }
      return reply("Не удалось получить ответ ИИ. Вопрос сохранён — попробуй ещё раз или обратись к учителю.", 502);
    }
    const data = await response.json();
    const text = (data.output || []).flatMap((item: { type: string; content?: { type: string; text?: string }[] }) => item.type === "message" ? (item.content || []).filter(c => c.type === "output_text").map(c => c.text || "") : []).join("\n").trim();
    if (!text || data.status !== "completed") return reply("ИИ не завершил ответ. Попробуй сформулировать вопрос короче.", 502);
    const answer = checkedAnswer(text);
    if (!answer) return reply("Ответ не прошёл проверку формата. Вопрос сохранён — попробуй ещё раз.", 502);
    return Response.json({ answer }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return reply("Время ожидания истекло или нет связи с ИИ. Вопрос сохранён — можно повторить отправку.", 504);
  }
}
