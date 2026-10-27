import "server-only";
import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import { z } from "zod";

export type AiResult<T> = { ok: true; data: T; model: string } | { ok: false; reason: string };
export interface WebSource {
  title: string;
  url: string;
}

export interface DeepSeekSearchResultItem {
  rerank_score?: number;
  title: string;
  url: string;
  snippet?: string;
  summary?: string;
  content?: string;
  site_name?: string | null;
  authority?: number;
}

export interface DeepSeekFetchResult {
  title: string;
  content: string;
}

const AI_TIMEOUT_MS = 60_000;
const MAX_TOOL_ROUNDS = 3;

export function getAiModel(): string {
  return process.env.DEEPSEEK_MODEL || "deepseek-chat";
}

function getBaseUrl(): string {
  return (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/+$/, "");
}

let client: OpenAI | null = null;

export function getAiClient(): OpenAI | null {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;
  client ??= new OpenAI({
    baseURL: getBaseUrl(),
    apiKey,
    timeout: AI_TIMEOUT_MS,
  });
  return client;
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY);
}


export async function deepseekWebSearch(
  query: string,
  options?: { count?: number; needContent?: boolean; oriQuestion?: string },
): Promise<DeepSeekSearchResultItem[]> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const trimmedQuery = query.trim().slice(0, 128);
  if (!apiKey || !trimmedQuery) return [];

  const body: Record<string, unknown> = {
    query: trimmedQuery,
    count: Math.min(Math.max(options?.count ?? 5, 1), 20),
    need_content: Boolean(options?.needContent),
  };
  if (options?.oriQuestion?.trim()) {
    body.ori_question = options.oriQuestion.trim().slice(0, 128);
  }

  try {
    const response = await fetch(`${getBaseUrl()}/v1/tools/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      console.warn(`DeepSeek Search API returned HTTP ${response.status}`);
      return [];
    }

    const data = (await response.json()) as { results?: unknown };
    if (!Array.isArray(data.results)) return [];

    return data.results.flatMap((item): DeepSeekSearchResultItem[] => {
      if (!item || typeof item !== "object") return [];
      const rec = item as Record<string, unknown>;
      if (typeof rec.title !== "string" || typeof rec.url !== "string") return [];
      return [
        {
          title: rec.title,
          url: rec.url,
          snippet: typeof rec.snippet === "string" ? rec.snippet : "",
          summary: typeof rec.summary === "string" ? rec.summary : "",
          content: typeof rec.content === "string" ? rec.content : "",
          site_name: typeof rec.site_name === "string" ? rec.site_name : null,
          rerank_score: typeof rec.rerank_score === "number" ? rec.rerank_score : undefined,
          authority: typeof rec.authority === "number" ? rec.authority : undefined,
        },
      ];
    });
  } catch (error) {
    console.warn("DeepSeek Search API call failed:", error instanceof Error ? error.message : String(error));
    return [];
  }
}

export async function deepseekWebFetch(url: string): Promise<DeepSeekFetchResult | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const trimmedUrl = url.trim().slice(0, 8192);
  if (!apiKey || !trimmedUrl) return null;

  try {
    const parsed = new URL(trimmedUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
  } catch {
    return null;
  }

  try {
    const response = await fetch(`${getBaseUrl()}/v1/tools/fetch`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: trimmedUrl }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      console.warn(`DeepSeek Fetch API returned HTTP ${response.status} for ${trimmedUrl}`);
      return null;
    }

    const data = (await response.json()) as { title?: unknown; content?: unknown };
    if (typeof data.content !== "string" || !data.content.trim()) return null;

    return {
      title: typeof data.title === "string" ? data.title : trimmedUrl,
      content: data.content.slice(0, 12_000),
    };
  } catch (error) {
    console.warn("DeepSeek Fetch API call failed:", error instanceof Error ? error.message : String(error));
    return null;
  }
}

const DEEPSEEK_WEB_TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the web using the official DeepSeek Search engine to verify Belarusian language rules, vocabulary, grammar, cultural/historical facts, or lists.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query (1 to 128 characters). Supports operators like site: or lang:.",
          },
          need_content: {
            type: "boolean",
            description: "Set true to include full page text in addition to summaries.",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_fetch",
      description:
        "Fetch the full Markdown content of a specific web page URL using the official DeepSeek Fetch API.",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "The HTTP/HTTPS URL to fetch.",
          },
        },
        required: ["url"],
      },
    },
  },
];

//тож костыль. но нормальный, ибо раз в век модель обернёт ответ в маркдаун или пишет лишний текст до скобки. пока agi не достигнем будет выполняться.
function parseJsonSafely(raw: string): unknown {
  const text = raw.trim();
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const clean = match ? match[1].trim() : text;
  try {
    return JSON.parse(clean);
  } catch {
    const firstBrace = clean.indexOf("{");
    const lastBrace = clean.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(clean.slice(firstBrace, lastBrace + 1));
    }
    throw new Error("Invalid JSON response");
  }
}

function extractSourcesFromText(text: string): WebSource[] {
  const sources: WebSource[] = [];
  const mdLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let match;
  while ((match = mdLinkRegex.exec(text)) !== null) {
    sources.push({ title: match[1].slice(0, 80), url: match[2] });
  }
  const plainUrlRegex = /(?<!\()(https?:\/\/[^\s<>"'\)]+)/g;
  while ((match = plainUrlRegex.exec(text)) !== null) {
    const url = match[1];
    if (!sources.some((s) => s.url === url)) {
      try {
        const hostname = new URL(url).hostname;
        sources.push({ title: hostname, url });
      } catch {
      }
    }
  }
  return sources.slice(0, 8);
}


//спаси и сохрани это чудо с раундами, если заведётся - В ПОКОЕ до лучших времен. РАБОТАЕТ, стабильно.
async function runToolRounds(
  ai: OpenAI,
  model: string,
  messages: ChatCompletionMessageParam[],
  collectedSources: WebSource[],
): Promise<string | null> {
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await ai.chat.completions.create({
      model,
      messages,
      tools: DEEPSEEK_WEB_TOOLS,
      tool_choice: "auto",
    });

    const msg = response.choices[0]?.message;
    if (!msg) return null;

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return msg.content ?? null;
    }

    messages.push(msg);

    for (const toolCall of msg.tool_calls) {
      if (toolCall.type !== "function") continue;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(toolCall.function.arguments || "{}") as Record<string, unknown>;
      } catch {
        args = {};
      }

      if (toolCall.function.name === "web_search") {
        const query = typeof args.query === "string" ? args.query : "";
        const needContent = Boolean(args.need_content);
        const results = await deepseekWebSearch(query, { count: 5, needContent });
        for (const r of results) {
          if (r.url && !collectedSources.some((s) => s.url === r.url)) {
            collectedSources.push({ title: (r.title || r.url).slice(0, 100), url: r.url });
          }
        }
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(
            results.map((r) => ({
              title: r.title,
              url: r.url,
              summary: r.summary || r.snippet,
              ...(needContent && r.content ? { content: r.content.slice(0, 3000) } : {}),
            })),
          ),
        });
      } else if (toolCall.function.name === "web_fetch") {
        const url = typeof args.url === "string" ? args.url : "";
        const fetched = await deepseekWebFetch(url);
        if (fetched && !collectedSources.some((s) => s.url === url)) {
          collectedSources.push({ title: (fetched.title || url).slice(0, 100), url });
        }
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(
            fetched
              ? { title: fetched.title, content: fetched.content.slice(0, 6000) }
              : { error: "Could not fetch page content" },
          ),
        });
      } else {
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify({ error: "Unknown tool" }),
        });
      }
    }
  }

  return null;
}

export async function askAiJson<T>(
  prompt: string,
  jsonSchema: Record<string, unknown>,
  validator: z.ZodType<T>,
  options?: { enableWebTools?: boolean },
): Promise<AiResult<T>> {
  const ai = getAiClient();
  if (!ai) return { ok: false, reason: "not-configured" };

  const model = getAiModel();
  const useTools = options?.enableWebTools ?? true;

  const systemPrompt = `You are an expert AI assistant for the Belarusian language learning platform KROK.
You have access to official DeepSeek web_search and web_fetch tools. When a request involves specific Belarusian facts, station names, cultural/historical facts, or orthography/grammar rules you want to verify, call web_search or web_fetch first to ensure 100% factual accuracy.
Your final response must be valid JSON strictly conforming to the requested schema. Do not include markdown explanation or commentary outside the JSON object.`;

  const userPrompt = `${prompt}

IMPORTANT: Your final response must be ONLY valid JSON matching this schema:
${JSON.stringify(jsonSchema, null, 2)}`;

  try {
    let text: string | null = null;

    if (useTools) {
      try {
        const toolMessages: ChatCompletionMessageParam[] = [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ];
        const sources: WebSource[] = [];
        text = await runToolRounds(ai, model, toolMessages, sources);

        if (!text || !text.trim().startsWith("{")) {
          const finalCompletion = await ai.chat.completions.create({
            model,
            messages: [
              ...toolMessages,
              ...(text ? [{ role: "assistant" as const, content: text }] : []),
              {
                role: "user",
                content: "Now return ONLY the final valid JSON object matching the required schema.",
              },
            ],
            response_format: { type: "json_object" },
          });
          text = finalCompletion.choices[0]?.message?.content ?? null;
        }
      } catch (toolErr) {
        console.warn("DeepSeek tool-enabled JSON call fell back to direct JSON completion:", toolErr);
        text = null;
      }
    }

    if (!text) {
      let completion;
      try {
        completion = await ai.chat.completions.create({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
        });
      } catch (fmtError) {
        console.warn("DeepSeek response_format json_object rejected, retrying without response_format:", fmtError);
        completion = await ai.chat.completions.create({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        });
      }
      text = completion.choices[0]?.message?.content ?? null;
    }

    if (!text) return { ok: false, reason: "empty" };

    const parsedRaw = parseJsonSafely(text);
    const parsed = validator.safeParse(parsedRaw);
    if (!parsed.success) {
      console.error(`DeepSeek AI JSON validation failed for model=${model}:`, JSON.stringify(parsed.error.issues));
      return { ok: false, reason: "invalid-shape" };
    }

    return { ok: true, data: parsed.data, model };
  } catch (error) {
    const status =
      error && typeof error === "object" && "status" in error
        ? (error as { status?: unknown }).status
        : undefined;
    console.error(
      `DeepSeek API JSON call failed: model=${model}, status=${typeof status === "number" ? status : "unknown"}, message=${error instanceof Error ? error.message : String(error)}`,
    );
    return { ok: false, reason: status === 429 ? "quota" : "api-error" };
  }
}


export async function askAiWithSearch(
  prompt: string,
): Promise<AiResult<{ text: string; sources: WebSource[] }>> {
  const ai = getAiClient();
  if (!ai) return { ok: false, reason: "not-configured" };

  const model = getAiModel();
  const collectedSources: WebSource[] = [];

  try {
    const initialSearch = await deepseekWebSearch(prompt.slice(0, 120), {
      count: 6,
      needContent: false,
      oriQuestion: prompt.slice(0, 120),
    });

    for (const item of initialSearch) {
      if (item.url && !collectedSources.some((s) => s.url === item.url)) {
        collectedSources.push({ title: (item.title || item.url).slice(0, 100), url: item.url });
      }
    }

    const searchContext =
      initialSearch.length > 0
        ? `\n\nOfficial DeepSeek Web Search results:\n${initialSearch
            .map((r, idx) => `${idx + 1}. [${r.title}](${r.url}): ${r.summary || r.snippet || ""}`)
            .join("\n")}`
        : "";

    const messages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content:
          "You are an expert researcher on Belarusian language, culture, geography, and history. Use the provided DeepSeek Web Search results and call web_search or web_fetch if you need more details from a specific page. Provide accurate, factual, and verified information with source URLs.",
      },
      { role: "user", content: `${prompt}${searchContext}` },
    ];

    let text = await runToolRounds(ai, model, messages, collectedSources);
    if (!text) {
      const completion = await ai.chat.completions.create({
        model,
        messages,
      });
      text = completion.choices[0]?.message?.content || "";
    }

    const textSources = extractSourcesFromText(text);
    for (const s of textSources) {
      if (!collectedSources.some((existing) => existing.url === s.url)) {
        collectedSources.push(s);
      }
    }

    return {
      ok: true,
      data: { text, sources: collectedSources.slice(0, 8) },
      model,
    };
  } catch (error) {
    const status =
      error && typeof error === "object" && "status" in error
        ? (error as { status?: unknown }).status
        : undefined;
    console.error(
      `DeepSeek research call failed: model=${model}, status=${typeof status === "number" ? status : "unknown"}, message=${error instanceof Error ? error.message : String(error)}`,
    );
    return { ok: false, reason: status === 429 ? "quota" : "api-error" };
  }
}


