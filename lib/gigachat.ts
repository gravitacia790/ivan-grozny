import { createHash, randomUUID } from "node:crypto";
import { request as httpsRequest } from "node:https";

type GigaRequest = { method?: string; headers: Record<string, string>; body?: string; signal: AbortSignal };
export function gigachatFetch(url: string, options: GigaRequest): Promise<Response> {
  if (process.env.GIGACHAT_TRANSPORT !== "https") return fetch(url, options);
  return new Promise((resolve, reject) => {
    const request = httpsRequest(url, { ...options, family: 4 }, response => {
      const chunks: Buffer[] = [];
      let size = 0;
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > 1048576) { response.destroy(new Error("GigaChat response too large")); return; }
        chunks.push(chunk);
      });
      response.on("error", reject);
      response.on("end", () => resolve(new Response(Buffer.concat(chunks), { status: response.statusCode || 502 })));
    });
    request.on("error", reject);
    request.end(options.body);
  });
}

// Credentials and OAuth tokens stay in server memory. Never disable TLS verification.
let cached: { identity: string; token: string; expires: number } | undefined;
type Payload = {
  instructions: string;
  input: { role: "user" | "assistant"; content: string }[];
  max_output_tokens: number;
  text: { format: { schema: object; strict?: boolean } };
};

export async function gigachatRequest(payload: Payload, signal: AbortSignal): Promise<Response> {
  const credentials = process.env.GIGACHAT_CREDENTIALS || "";
  const scope = process.env.GIGACHAT_SCOPE || "GIGACHAT_API_PERS";
  const identity = createHash("sha256").update(`${scope}:${credentials}`).digest("hex");
  if (!cached || cached.identity !== identity || cached.expires <= Date.now() + 60000) {
    const response = await gigachatFetch("https://ngw.devices.sberbank.ru:9443/api/v2/oauth", {
      method: "POST", signal,
      headers: { Authorization: `Basic ${credentials}`, RqUID: randomUUID(), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ scope }).toString()
    });
    if (!response.ok) return new Response(null, { status: response.status });
    const data = await response.json();
    if (typeof data.access_token !== "string" || !data.access_token || !Number.isFinite(data.expires_at) || data.expires_at <= Date.now()) {
      return new Response(null, { status: 502 });
    }
    cached = { identity, token: data.access_token, expires: data.expires_at };
  }
  const response = await gigachatFetch("https://api.giga.chat/v1/chat/completions", {
    method: "POST", signal,
    headers: { Authorization: `Bearer ${cached.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.GIGACHAT_MODEL || "GigaChat-3-Ultra",
      messages: [{ role: "system", content: payload.instructions }, ...payload.input],
      max_tokens: payload.max_output_tokens,
      stream: false,
      temperature: 0.5,
      response_format: { type: "json_schema", schema: payload.text.format.schema, strict: true }
    })
  });
  if (response.status === 401) cached = undefined;
  if (!response.ok) return new Response(null, { status: response.status });
  const data = await response.json();
  const choice = data.choices?.[0];
  // Normalize only the transport; existing reply/summary validators remain mandatory.
  return Response.json({
    status: choice?.finish_reason === "stop" ? "completed" : "incomplete",
    output: [{ type: "message", content: [{ type: "output_text", text: typeof choice?.message?.content === "string" ? choice.message.content : "" }] }]
  });
}
