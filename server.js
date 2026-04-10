const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const ROOT = __dirname;
const PORT = Number(process.argv[2] || process.env.PORT || 8765);
const DEFAULT_MODEL = process.env.X_REPLY_MODEL || "gpt-5";
const DEFAULT_REASONING_EFFORT =
  process.env.X_REPLY_REASONING_EFFORT || "high";
const DEFAULT_CLAUDE_MODEL =
  process.env.CLAUDE_MODEL || "claude-sonnet-4-5";
const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const DEFAULT_OLLAMA_MODEL = process.env.OLLAMA_MODEL || "";
const ANTHROPIC_VERSION = "2023-06-01";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml"
};

const REASONER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "post_type",
    "tone",
    "core_meaning",
    "replyability",
    "best_angle",
    "candidate_reply",
    "reply_mode",
    "decision_summary",
    "reasons"
  ],
  properties: {
    post_type: {
      type: "string",
      enum: [
        "market_thesis",
        "product_launch",
        "policy_or_regulation",
        "privacy_or_trust",
        "legal_or_political_attack",
        "headline_or_hot_take",
        "casual_or_personal",
        "promotion_or_engagement_bait",
        "general_company_update",
        "other"
      ]
    },
    tone: {
      type: "string",
      enum: [
        "blunt",
        "analytical",
        "snarky",
        "casual",
        "promotional",
        "angry",
        "serious",
        "unclear"
      ]
    },
    core_meaning: {
      type: "string",
      minLength: 12,
      maxLength: 240
    },
    replyability: {
      type: "string",
      enum: ["strong", "possible", "weak", "none"]
    },
    best_angle: {
      type: "string",
      minLength: 0,
      maxLength: 200
    },
    candidate_reply: {
      type: "string",
      minLength: 0,
      maxLength: 280
    },
    reply_mode: {
      type: "string",
      enum: ["suggested", "optional", "none"]
    },
    decision_summary: {
      type: "string",
      minLength: 12,
      maxLength: 180
    },
    reasons: {
      type: "array",
      minItems: 2,
      maxItems: 3,
      items: {
        type: "string",
        minLength: 10,
        maxLength: 180
      }
    }
  }
};

const FINAL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "post_type",
    "verdict",
    "reply_mode",
    "summary",
    "reasons",
    "reply_title",
    "reply_text"
  ],
  properties: {
    post_type: {
      type: "string",
      enum: [
        "market_thesis",
        "product_launch",
        "policy_or_regulation",
        "privacy_or_trust",
        "legal_or_political_attack",
        "headline_or_hot_take",
        "casual_or_personal",
        "promotion_or_engagement_bait",
        "general_company_update",
        "other"
      ]
    },
    verdict: {
      type: "string",
      enum: ["comment", "skip"]
    },
    reply_mode: {
      type: "string",
      enum: ["suggested", "optional", "none"]
    },
    summary: {
      type: "string",
      minLength: 12,
      maxLength: 180
    },
    reasons: {
      type: "array",
      minItems: 2,
      maxItems: 3,
      items: {
        type: "string",
        minLength: 10,
        maxLength: 180
      }
    },
    reply_title: {
      type: "string",
      minLength: 3,
      maxLength: 40
    },
    reply_text: {
      type: "string",
      minLength: 0,
      maxLength: 280
    }
  }
};

const REASONER_SYSTEM_PROMPT = `
You are an elite X reply strategist.

Your job is to decide whether replying to a post is actually worth it and, if yes, write one reply that sounds like a sharp human on X.

Ground rules:
- Never sound like a consultant, policy memo, PR rep, or MBA.
- Do not write generic filler such as "interesting", "what matters now", "worth watching", "from here", "signal", or "narrative" unless the post truly demands it.
- Short blunt posts deserve short blunt replies.
- Casual posts, obvious bait, slogans, and empty headlines are usually skips.
- A good reply must be anchored to what the post is really saying, not to a nearby topic.
- Slight dry humor is allowed when natural. Forced humor is bad.
- If you are not adding a real angle, skip.
- Never invent facts not present in the provided context.

Style target:
- honest
- intelligent
- human
- concise
- occasionally wry
- never stiff

Good examples:
Post: "Can't trust WhatsApp"
Good reply: "If privacy still depends on 'trust us,' that's already the problem."

Post: "Switch to X Chat — Fully Encrypted..."
Good reply: "Encryption is the headline. The harder part is getting people to actually switch their default behavior."

Post: "good morning my sweet little kitkats"
Best outcome: skip, no reply.

Post: "Today, we launched an investigation into OpenAI..."
Good reply style: talk about evidence, standards, process, accountability, or incentives. Do not talk about product adoption or feature launches.
`.trim();

const VERIFIER_SYSTEM_PROMPT = `
You are the final editor and bad cop.

You receive:
- the original X post
- extracted context
- a draft judgment
- a candidate reply

Your job:
- kill replies that are generic, off-topic, stiff, or reusable across many posts
- kill replies that do not match the tone or actual content of the post
- if the post is weak but there is still one genuinely worthwhile reply, label it optional
- if no worthwhile reply exists, return reply_mode "none" and an empty reply_text

Rules:
- The final reply must feel like it is obviously about this exact post.
- If the post is blunt, the reply should usually be blunt too.
- If the post is casual/personal/bait, skip unless there is a very unusual angle.
- Legal or political posts need evidence/process/accountability logic, not product/adoption logic.
- Privacy/trust posts should talk about trust, verification, defaults, incentives, or black-box behavior, not unrelated market language.
- Reply text must be under 280 characters.
- Avoid preachy, robotic, or pseudo-intellectual phrasing.

If you cannot honestly defend the reply, skip it.
`.trim();

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function sendError(res, statusCode, code, message) {
  sendJson(res, statusCode, { ok: false, code, message });
}

function decodeHtmlEntities(value) {
  return (value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&mdash;/g, "—")
    .replace(/&#8212;/g, "—")
    .replace(/&nbsp;/g, " ");
}

function htmlToText(html) {
  const stripped = decodeHtmlEntities(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/https?:\/\/t\.co\/\S+/gi, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  const lines = stripped
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) {
    return stripped;
  }

  const footerLine = lines[lines.length - 1];
  if (/^(?:—|-).+?(?:\d{4}|April|May|June|July|August|September|October|November|December|January|February|March)/i.test(footerLine)) {
    lines.pop();
  }

  return lines.join("\n");
}

function normalizeWhitespace(value) {
  return (value || "").replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").trim();
}

function isLikelyXStatusUrl(value) {
  try {
    const url = new URL(value);
    return (
      ["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(
        url.hostname.toLowerCase()
      ) && /\/status\/\d+/i.test(url.pathname)
    );
  } catch {
    return false;
  }
}

function deriveHandleFromOembed(data) {
  try {
    if (data.author_url) {
      const authorUrl = new URL(data.author_url);
      const handle = authorUrl.pathname.replace(/^\/+/, "").trim();
      if (handle) {
        return `@${handle}`;
      }
    }
  } catch {
    // ignore
  }

  const cleaned = (data.author_name || "").trim();
  return cleaned ? `@${cleaned.replace(/^@+/, "")}` : "";
}

async function fetchPublicPost(postLink) {
  if (!isLikelyXStatusUrl(postLink)) {
    throw new Error("That does not look like a public X status link.");
  }

  const endpoint = new URL("https://publish.twitter.com/oembed");
  endpoint.searchParams.set("omit_script", "1");
  endpoint.searchParams.set("url", postLink);

  const response = await fetch(endpoint, {
    headers: {
      "User-Agent": "X Reply Copilot/1.0"
    }
  });

  if (!response.ok) {
    throw new Error("Could not import that X post. It may be private or unavailable.");
  }

  const payload = await response.json();
  const importedText = normalizeWhitespace(htmlToText(payload.html));
  const authorHandle = deriveHandleFromOembed(payload);

  if (!importedText) {
    throw new Error("The post imported, but no readable text was found.");
  }

  return {
    importedText,
    authorHandle,
    importedAt: new Date().toISOString(),
    source: "oembed"
  };
}

async function readRequestBody(req) {
  const MAX_BODY = 1024 * 1024; /* 1 MB */
  const chunks = [];
  let totalSize = 0;

  for await (const chunk of req) {
    totalSize += chunk.length;
    if (totalSize > MAX_BODY) {
      throw new Error("Request body too large.");
    }
    chunks.push(chunk);
  }

  if (!chunks.length) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("Invalid JSON body.");
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(text || `Request failed (${response.status}).`);
  }

  return data;
}

function estimateModelStrength(name) {
  const lower = (name || "").toLowerCase();
  const match = lower.match(/(\d+(?:\.\d+)?)b/);
  const size = match ? Number(match[1]) : 0;
  const coderPenalty = lower.includes("coder") ? -0.2 : 0;
  return size + coderPenalty;
}

function pickBestOllamaModel(names) {
  const models = (names || []).filter(Boolean);

  if (!models.length) {
    return "";
  }

  return [...models].sort(
    (left, right) => estimateModelStrength(right) - estimateModelStrength(left)
  )[0];
}

async function getOllamaTags() {
  try {
    const data = await fetchJson(`${OLLAMA_BASE_URL}/api/tags`);
    const models = Array.isArray(data.models) ? data.models : [];
    const modelNames = models.map((item) => item.name).filter(Boolean);
    return {
      available: true,
      models: modelNames,
      defaultModel: DEFAULT_OLLAMA_MODEL || pickBestOllamaModel(modelNames)
    };
  } catch {
    return {
      available: false,
      models: [],
      defaultModel: DEFAULT_OLLAMA_MODEL || ""
    };
  }
}

function schemaFormat(name, schema) {
  return {
    type: "json_schema",
    name,
    strict: true,
    schema
  };
}

function buildReasonerUserPrompt(context) {
  return `
Author: ${context.authorHandle || "Unknown"}
Source URL: ${context.postLink || "Not provided"}

Imported or supplied post text:
"""
${context.postText}
"""

If there is quote-tweet or article context inside the imported text, use it. If there is not enough substance, say so. Return structured JSON only.
`.trim();
}

function buildVerifierUserPrompt(context, draft) {
  return `
Original post:
"""
${context.postText}
"""

Author: ${context.authorHandle || "Unknown"}
Source URL: ${context.postLink || "Not provided"}

Draft analysis:
${JSON.stringify(draft, null, 2)}

Return the final verdict and final reply only as JSON.
`.trim();
}

function extractResponseText(payload) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const parts = [];

  for (const item of payload.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) {
        parts.push(content.text);
      }
    }
  }

  return parts.join("\n").trim();
}

async function runModel({
  apiKey,
  systemPrompt,
  userPrompt,
  schemaName,
  schema,
  model = DEFAULT_MODEL,
  reasoningEffort = DEFAULT_REASONING_EFFORT
}) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      reasoning: {
        effort: reasoningEffort
      },
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: systemPrompt }]
        },
        {
          role: "user",
          content: [{ type: "input_text", text: userPrompt }]
        }
      ],
      text: {
        format: schemaFormat(schemaName, schema)
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OpenAI request failed (${response.status}). ${errorText.slice(0, 280)}`
    );
  }

  const payload = await response.json();
  const outputText = extractResponseText(payload);

  if (!outputText) {
    throw new Error("OpenAI returned no readable output.");
  }

  return JSON.parse(outputText);
}

async function runOllamaModel({
  model,
  systemPrompt,
  userPrompt,
  schema
}) {
  const payload = await fetchJson(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      stream: false,
      format: schema,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
        }
      ]
    })
  });

  const content =
    payload &&
    payload.message &&
    typeof payload.message.content === "string"
      ? payload.message.content.trim()
      : "";

  if (!content) {
    throw new Error("Ollama returned no readable output.");
  }

  return JSON.parse(content);
}

function extractClaudeText(payload) {
  const parts = [];

  for (const item of payload.content || []) {
    if (item.type === "text" && typeof item.text === "string") {
      parts.push(item.text);
    }
  }

  return parts.join("\n").trim();
}

async function runClaudeModel({
  apiKey,
  systemPrompt,
  userPrompt,
  schema,
  model = DEFAULT_CLAUDE_MODEL
}) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      max_tokens: 1200,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userPrompt
        }
      ],
      output_config: {
        format: {
          type: "json_schema",
          schema
        }
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Claude request failed (${response.status}). ${errorText.slice(0, 280)}`
    );
  }

  const payload = await response.json();
  const outputText = extractClaudeText(payload);

  if (!outputText) {
    throw new Error("Claude returned no readable output.");
  }

  return JSON.parse(outputText);
}

function sanitizeReplyText(value) {
  return normalizeWhitespace(value)
    .replace(/^"+|"+$/g, "")
    .slice(0, 280);
}

function buildEmptyVerdict(message) {
  return {
    post_type: "other",
    verdict: "skip",
    reply_mode: "none",
    summary: message,
    reasons: [
      "There is no strong, specific reply angle here.",
      "If the best reply feels generic, it is better to skip."
    ],
    reply_title: "No Reply Suggested",
    reply_text: ""
  };
}

async function analyzePost({ apiKey, postLink, postText, authorHandle }) {
  const context = {
    postLink: postLink || "",
    postText: normalizeWhitespace(postText),
    authorHandle: authorHandle || ""
  };

  const draft = await runModel({
    apiKey,
    schemaName: "x_reply_reasoner",
    schema: REASONER_SCHEMA,
    systemPrompt: REASONER_SYSTEM_PROMPT,
    userPrompt: buildReasonerUserPrompt(context)
  });

  const final = await runModel({
    apiKey,
    schemaName: "x_reply_verifier",
    schema: FINAL_SCHEMA,
    systemPrompt: VERIFIER_SYSTEM_PROMPT,
    userPrompt: buildVerifierUserPrompt(context, draft)
  });

  return {
    ...final,
    reply_text: sanitizeReplyText(final.reply_text)
  };
}

async function analyzePostWithClaude({
  apiKey,
  postLink,
  postText,
  authorHandle
}) {
  const context = {
    postLink: postLink || "",
    postText: normalizeWhitespace(postText),
    authorHandle: authorHandle || ""
  };

  const draft = await runClaudeModel({
    apiKey,
    schema: REASONER_SCHEMA,
    systemPrompt: REASONER_SYSTEM_PROMPT,
    userPrompt: buildReasonerUserPrompt(context)
  });

  const final = await runClaudeModel({
    apiKey,
    schema: FINAL_SCHEMA,
    systemPrompt: VERIFIER_SYSTEM_PROMPT,
    userPrompt: buildVerifierUserPrompt(context, draft)
  });

  return {
    ...final,
    reply_text: sanitizeReplyText(final.reply_text)
  };
}

async function analyzePostWithOllama({
  postLink,
  postText,
  authorHandle,
  ollamaModel
}) {
  const ollamaStatus = await getOllamaTags();

  if (!ollamaStatus.available) {
    throw new Error(
      "Ollama is not reachable on this PC. Start Ollama and try again."
    );
  }

  const model =
    (ollamaModel || "").trim() ||
    ollamaStatus.defaultModel ||
    (ollamaStatus.models[0] || "");

  if (!model) {
    throw new Error(
      "No Ollama model was found. Download a local model first and try again."
    );
  }

  const context = {
    postLink: postLink || "",
    postText: normalizeWhitespace(postText),
    authorHandle: authorHandle || ""
  };

  const draft = await runOllamaModel({
    model,
    schema: REASONER_SCHEMA,
    systemPrompt: REASONER_SYSTEM_PROMPT,
    userPrompt: buildReasonerUserPrompt(context)
  });

  const final = await runOllamaModel({
    model,
    schema: FINAL_SCHEMA,
    systemPrompt: VERIFIER_SYSTEM_PROMPT,
    userPrompt: buildVerifierUserPrompt(context, draft)
  });

  return {
    ...final,
    reply_text: sanitizeReplyText(final.reply_text)
  };
}

function resolveApiKey(body) {
  return (
    (body.apiKey || "").trim() ||
    (process.env.OPENAI_API_KEY || "").trim()
  );
}

function resolveClaudeApiKey(body) {
  return (
    (body.claudeApiKey || "").trim() ||
    (process.env.ANTHROPIC_API_KEY || "").trim()
  );
}

async function handleImport(req, res) {
  const body = await readRequestBody(req);
  const postLink = (body.postLink || "").trim();

  if (!postLink) {
    return sendError(res, 400, "missing_post_link", "Paste an X post link first.");
  }

  try {
    const imported = await fetchPublicPost(postLink);
    return sendJson(res, 200, { ok: true, ...imported });
  } catch (error) {
    return sendError(res, 400, "import_failed", error.message);
  }
}

async function handleAnalyze(req, res) {
  const body = await readRequestBody(req);
  const mode = (body.mode || "focused").trim().toLowerCase();
  const apiKey = resolveApiKey(body);
  const claudeApiKey = resolveClaudeApiKey(body);

  let postLink = (body.postLink || "").trim();
  let postText = normalizeWhitespace(body.postText);
  let authorHandle = (body.authorHandle || "").trim();
  let imported = null;

  try {
    if (postLink && !postText) {
      imported = await fetchPublicPost(postLink);
      postText = imported.importedText;
      authorHandle = authorHandle || imported.authorHandle;
    } else if (postLink) {
      try {
        imported = await fetchPublicPost(postLink);
        authorHandle = authorHandle || imported.authorHandle;
      } catch {
        imported = null;
      }
    }

    if (!postText) {
      return sendError(
        res,
        400,
        "missing_post_text",
        "Paste post text or provide a public X link."
      );
    }

    let result;

    if (mode === "ollama") {
      result = await analyzePostWithOllama({
        postLink,
        postText,
        authorHandle,
        ollamaModel: (body.ollamaModel || "").trim()
      });
    } else if (mode === "claude") {
      if (!claudeApiKey) {
        return sendError(
          res,
          400,
          "missing_claude_api_key",
          "Add a Claude API key to use Claude mode."
        );
      }

      result = await analyzePostWithClaude({
        apiKey: claudeApiKey,
        postLink,
        postText,
        authorHandle
      });
    } else {
      if (!apiKey) {
        return sendError(
          res,
          400,
          "missing_api_key",
          "Add an OpenAI API key to use the reasoning engine."
        );
      }

      result = await analyzePost({
        apiKey,
        postLink,
        postText,
        authorHandle
      });
    }

    if (!result.reply_text && result.reply_mode !== "none") {
      result.reply_mode = "none";
      result.reply_title = "No Reply Suggested";
      result.verdict = "skip";
    }

    const hasUsableResult = result.reply_text || result.reply_mode === "none";

    return sendJson(res, 200, {
      ok: true,
      imported,
      resolvedText: postText,
      resolvedAuthorHandle: authorHandle,
      result: hasUsableResult
        ? result
        : buildEmptyVerdict("No worthwhile reply angle here.")
    });
  } catch (error) {
    return sendError(res, 500, "analysis_failed", error.message);
  }
}

async function serveStaticFile(res, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.join(ROOT, safePath);
  const normalizedRoot = path.normalize(ROOT + path.sep);
  const normalizedPath = path.normalize(filePath);

  if (!normalizedPath.startsWith(normalizedRoot)) {
    return sendError(res, 403, "forbidden", "Forbidden.");
  }

  if (!fs.existsSync(normalizedPath) || fs.statSync(normalizedPath).isDirectory()) {
    return sendError(res, 404, "not_found", "File not found.");
  }

  const ext = path.extname(normalizedPath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const noStore = [".html", ".js", ".css"].includes(ext);

  res.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": noStore ? "no-store" : "public, max-age=300"
  });

  fs.createReadStream(normalizedPath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "POST" && requestUrl.pathname === "/api/import") {
      return await handleImport(req, res);
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/analyze") {
      return await handleAnalyze(req, res);
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/health") {
      const ollama = await getOllamaTags();
      return sendJson(res, 200, {
        ok: true,
        model: DEFAULT_MODEL,
        reasoningEffort: DEFAULT_REASONING_EFFORT,
        hasServerKey: Boolean((process.env.OPENAI_API_KEY || "").trim()),
        hasClaudeKey: Boolean((process.env.ANTHROPIC_API_KEY || "").trim()),
        ollama
      });
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      return sendError(res, 405, "method_not_allowed", "Method not allowed.");
    }

    return await serveStaticFile(res, requestUrl.pathname);
  } catch (error) {
    return sendError(res, 500, "server_error", "Internal server error.");
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`X Reply Copilot listening on http://127.0.0.1:${PORT}`);
});
