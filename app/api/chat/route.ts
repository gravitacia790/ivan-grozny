import { checkedSummary, summaryFormat, summaryInstructions } from "@/lib/lesson-summary";
import { instructions, answerFormatFor, checkedReply, fixedAnswers } from "@/lib/instructions";

import { researchDomainGroups } from "@/lib/source-policy";
import { researchInstructions, extractResearch, independentSources, asksForSources, requestsBibliography, sourceReceipt, receiptSources } from "@/lib/research";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
type Message = { role: "user" | "assistant"; content: string };
function providerConfig() {
  const yandex = process.env.AI_PROVIDER === "yandex";
  const model = yandex ? `gpt://${process.env.YANDEX_FOLDER_ID}/${process.env.YANDEX_MODEL || "aliceai-llm/latest"}` : process.env.OPENAI_MODEL || "gpt-5-mini";
  return { yandex, model,
    key: yandex ? process.env.YANDEX_API_KEY : process.env.OPENAI_API_KEY,
    configured: yandex ? Boolean(process.env.YANDEX_API_KEY && process.env.YANDEX_FOLDER_ID) : Boolean(process.env.OPENAI_API_KEY),
    url: yandex ? "https://ai.api.cloud.yandex.net/v1/responses" : "https://api.openai.com/v1/responses",
    researchModel: yandex ? `gpt://${process.env.YANDEX_FOLDER_ID}/${process.env.YANDEX_RESEARCH_MODEL || process.env.YANDEX_MODEL || "aliceai-llm/latest"}` : process.env.OPENAI_RESEARCH_MODEL || "gpt-5-mini"
  };
}
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
  return withCors(request, Response.json({ configured: providerConfig().configured, provider: providerConfig().yandex ? "yandex" : "openai", materialsApproved: process.env.TEACHER_MATERIALS_APPROVED === "true", sourceMode: "trusted_web_search", sourcesOnRequest: true }, { headers: { "Cache-Control": "no-store" } }));
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
  const provider = providerConfig();
  if (!provider.configured) return reply("ИИ пока не подключён. Попроси учителя проверить подключение.", 503);
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
  if (body.mode !== undefined && body.mode !== "summary") return reply("Неизвестный режим запроса.", 400);
  const isSummary = body.mode === "summary";
  if (isSummary && (body.messages.length < 2 || body.messages.length > 20 || body.messages.length % 2 !== 0)) return reply("Для итога нужна завершённая беседа.", 400);
  const messages: Message[] = body.messages;
  if (messages.some((m, i) => !m || m.role !== (i % 2 === 0 ? "user" : "assistant") || typeof m.content !== "string" || !m.content.trim() || m.content.length > (m.role === "user" ? 1000 : 5000)) || messages.at(-1)?.role !== (isSummary ? "assistant" : "user")) return reply("Проверь вопрос: не больше 1000 символов.", 400);
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
    const json = (value: unknown) => Response.json(value, { headers: { "Cache-Control": "no-store" } });
    const question = messages.at(-1)!.content;
    const wantsSources = requestsBibliography(question);
    const previous = messages.at(-2);
    if (!isSummary && asksForSources(question) && previous?.role === "assistant") {
      const sources = receiptSources(body.sourceReceipt, previous.content);
      if (sources.length) {
        const answer = "Вот публикации, на коих основан мой предыдущий ответ.";
        return json({ answer, sources, sourceReceipt: sourceReceipt(answer, sources) });
      }
      return json({ answer: "Для прежнего ответа проверяемый список не сохранён. Задай исторический вопрос заново, дабы я сверил свидетельства и назвал источники." });
    }
    if (!isSummary && asksForSources(question) && !previous) return json({ answer: "Уточни, о каком событии моего правления нужна литература." });
    const input = messages.map(({ role, content }) => ({ role, content }));
    const upstream = (payload: object, timeout: number) => fetch(provider.url, {
      method: "POST",
      headers: { Authorization: `${provider.yandex ? "Api-Key" : "Bearer"} ${provider.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: provider.model, store: false, ...payload }),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(timeout)])
    });
    if (isSummary) {
      const response = await upstream({ instructions: summaryInstructions, input,
        max_output_tokens: 2000, text: { format: summaryFormat },
        ...(provider.model.startsWith("gpt-5") ? { reasoning: { effort: "low" } } : {})
      }, 25000);
      if (!response.ok) return reply("Не удалось составить итог урока. Попробуй позже; беседа сохранена.", 503);
      const data = await response.json();
      const text = (data.output || []).filter((item: { type: string }) => item.type === "message")
        .flatMap((item: { content?: { type: string; text?: string }[] }) => item.content || [])
        .filter((item: { type: string }) => item.type === "output_text").map((item: { text?: string }) => item.text || "").join("");
      let value;
      try { value = JSON.parse(text); } catch { return reply("Итог не прошёл проверку формата. Попробуй ещё раз.", 502); }
      const summary = checkedSummary(value);
      if (data.status !== "completed" || !summary) return reply("Итог не прошёл проверку формата. Попробуй ещё раз.", 502);
      return json({ summary });
    }
    const domainGroups = provider.yandex ? researchDomainGroups.flatMap(group => Array.from({ length: Math.ceil(group.length / 5) }, (_, i) => group.slice(i * 5, i * 5 + 5))) : researchDomainGroups;
    const searchResponses = await Promise.all(domainGroups.map(domains => upstream({
      model: provider.researchModel,
      ...(!provider.yandex ? { reasoning: { effort: "low" } } : {}),
      instructions: researchInstructions,
      input,
      tools: [{ type: "web_search", filters: { allowed_domains: domains }, search_context_size: "medium" }],
      tool_choice: "required", ...(!provider.yandex ? { include: ["web_search_call.action.sources"] } : {}), max_output_tokens: 3000
    }, 38000)));
    let response = searchResponses.find(result => !result.ok) || searchResponses[0];
    let research;
    if (response.ok) {
      const data = await Promise.all(searchResponses.map(result => result.json()));
      if (data.some(result => result.status !== "completed")) {
        console.warn("research incomplete", data.map(result => ({ status: result.status, reason: result.incomplete_details?.reason })));
        return reply("Поиск не завершён. Вопрос сохранён — попробуй ещё раз.", 502);
      }
      const parts = data.map(result => extractResearch(result, provider.yandex));
      if (parts.every(part => part.text.trim() === "OUT_OF_CONTEXT")) return json({ answer: fixedAnswers.out_of_context });
      if (parts.every(part => part.text.trim() === "CLARIFICATION")) return json({ answer: fixedAnswers.clarification });
      const usable = parts.filter(part => part.searched && part.sources.length);
      const unique = [...new Map(usable.flatMap(part => part.sources).map(source => [source.url, source])).values()];
      research = { text: usable.map(part => part.text).join("\n\n"), sources: unique.map((source, i) => ({ ...source, id: `web-${i + 1}` })) };
      if (!independentSources(research.sources)) return json({ answer: fixedAnswers.insufficient_context });
      response = await upstream({
        instructions: instructions(research.text, research.sources),
        input, max_output_tokens: 1800,
        ...(provider.model.startsWith("gpt-5") ? { reasoning: { effort: "low" } } : {}),
        text: { format: answerFormatFor(research.sources.map(source => source.id)) }
      }, 17000);
    }
    if (!response.ok) {
      if (response.status === 401) return reply("Сервис ИИ не принял ключ доступа. Попроси учителя проверить ключ выбранного ИИ на сервере.", 503);
      if (response.status === 403 || response.status === 404) return reply("У сервера нет доступа к выбранной модели ИИ. Сообщи учителю.", 503);
      if (response.status === 429) {
        const failure = await response.json().catch(() => ({}));
        return reply(failure.error?.code === "insufficient_quota" ? "На сервере исчерпан баланс или лимит расходов выбранного ИИ. Сообщи учителю." : "Сервис ИИ получил слишком много запросов. Подожди минуту и попробуй снова.", 503);
      }
      return reply("Не удалось получить ответ ИИ. Вопрос сохранён — попробуй ещё раз или обратись к учителю.", 502);
    }
    const data = await response.json();
    const text = (data.output || []).flatMap((item: { type: string; content?: { type: string; text?: string }[] }) => item.type === "message" ? (item.content || []).filter(c => c.type === "output_text").map(c => c.text || "") : []).join("\n").trim();
    if (!text || data.status !== "completed") return reply("ИИ не завершил ответ. Попробуй сформулировать вопрос короче.", 502);
    const checked = checkedReply(text, research?.sources.map(source => source.id) || []);
    if (!checked) return reply("Ответ не прошёл проверку формата. Вопрос сохранён — попробуй ещё раз.", 502);
    const sources = (research?.sources || []).filter(source => checked.sourceIds.includes(source.id));
    if (!checked.sourceIds.length) return json({ answer: checked.answer });
    if (!independentSources(sources)) return json({ answer: fixedAnswers.insufficient_context });
    return json({ answer: checked.answer, sourceReceipt: sourceReceipt(checked.answer, sources), ...(wantsSources ? { sources } : {}) });
  } catch (error) {
    console.error("chat upstream failure", error instanceof Error ? error.name : "unknown");
    return reply(isSummary ? "Не удалось дождаться итога урока. Беседа сохранена — попробуй ещё раз." : "Время ожидания истекло или нет связи с ИИ. Вопрос сохранён — можно повторить отправку.", 504);
  }
}
