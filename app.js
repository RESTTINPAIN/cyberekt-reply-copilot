const FORM_STORAGE_KEY = "x-reply-copilot-form-v5";
const API_KEY_STORAGE_KEY = "x-reply-copilot-openai-key";
const CLAUDE_API_KEY_STORAGE_KEY = "x-reply-copilot-claude-key";
const MODE_LOCAL = "local";
const MODE_FOCUSED = "focused";
const MODE_CLAUDE = "claude";
const MODE_OLLAMA = "ollama";

const $ = {
  modeLocalBtn: document.getElementById("modeLocalBtn"),
  modeFocusedBtn: document.getElementById("modeFocusedBtn"),
  modeClaudeBtn: document.getElementById("modeClaudeBtn"),
  modeOllamaBtn: document.getElementById("modeOllamaBtn"),
  modeTrack: document.getElementById("modeTrack"),
  modeHint: document.getElementById("modeHint"),
  apiKeyField: document.getElementById("apiKeyField"),
  apiKey: document.getElementById("apiKey"),
  claudeApiKeyField: document.getElementById("claudeApiKeyField"),
  claudeApiKey: document.getElementById("claudeApiKey"),
  ollamaModelField: document.getElementById("ollamaModelField"),
  ollamaModel: document.getElementById("ollamaModel"),
  postLink: document.getElementById("postLink"),
  postText: document.getElementById("postText"),
  analyzeBtn: document.getElementById("analyzeBtn"),
  clearBtn: document.getElementById("clearBtn"),
  importStatus: document.getElementById("importStatus"),
  suggestedTitle: document.getElementById("suggestedTitle"),
  suggestedComment: document.getElementById("suggestedComment"),
  suggestionHint: document.getElementById("suggestionHint"),
  suggestedCard: document.getElementById("suggestedCard"),
  copyBtn: document.getElementById("copyBtn"),
  verdictBadge: document.getElementById("verdictBadge"),
  verdictSummary: document.getElementById("verdictSummary"),
  verdictReasons: document.getElementById("verdictReasons")
};

const state = {
  busy: false,
  serverHasKey: false,
  serverHasClaudeKey: false,
  lastReply: "",
  mode: MODE_LOCAL,
  ollamaAvailable: false,
  defaultOllamaModel: "",
  lastImportedLink: "",
  lastSeenLink: ""
};

/* ─── Keyword dictionaries for local reasoning ─── */

const CATEGORIES = {
  casual: ["good morning", "good night", "gm", "gn", "kitkats", "lol", "haha", "bruh", "vibes", "mood", "tbh", "ngl", "imo", "smh", "love this", "so true", "same", "fr fr", "no cap", "lowkey", "highkey", "slay", "goat", "blessed", "grateful"],
  bait: ["drop your", "reply below", "comment below", "what do you think", "lets compare", "let's compare", "status below", "or still waiting", "unpopular opinion", "hot take:", "ratio", "agree or disagree", "retweet if", "like if", "who else", "am i the only", "thread:", "1/", "prove me wrong"],
  trust: ["whatsapp", "meta", "privacy", "private messages", "encrypted", "encryption", "metadata", "consent", "trust", "x chat", "dm stack", "end-to-end", "e2ee", "surveillance", "data collection", "tracking", "telemetry", "opt-in", "opt-out", "data breach", "leaked", "spying", "backdoor"],
  legal: ["investigation", "lawsuit", "class action", "attorney general", "openai", "chatgpt", "accountable", "congress", "bill", "act", "legislation", "law", "regulation", "sec", "senate", "house", "subpoena", "testimony", "indicted", "compliance", "ruling", "verdict", "antitrust", "monopoly", "ftc", "doj"],
  product: ["switch to", "now live", "launch", "launched", "feature", "features", "integrated", "integration", "partnered", "api", "payments", "invoice", "usdc", "custody", "settlement", "tokenization", "stablecoin", "open network", "rails", "beta", "alpha", "v2", "update", "upgrade", "rollout", "shipping"],
  market: ["bitcoin", "btc", "market", "markets", "demand", "flow", "flows", "liquidity", "capital", "positioning", "price", "etf", "etfs", "tokenization", "stablecoin", "custody", "settlement", "payments", "bull", "bear", "rally", "correction", "volume", "ath", "all-time high"],
  operational: ["we need to focus", "prioritizing", "ensuring it is stable", "team is currently", "will build", "working on", "second migration", "roadmap", "sprint", "milestone", "shipping soon", "in progress"],
  ai: ["ai", "artificial intelligence", "machine learning", "llm", "gpt", "claude", "gemini", "model", "neural", "deep learning", "transformer", "training", "fine-tune", "agi", "alignment", "hallucination", "inference", "prompt", "chatbot", "copilot", "agent"],
  social: ["society", "culture", "generation", "gen z", "millennial", "inequality", "justice", "freedom", "democracy", "censorship", "misinformation", "disinformation", "propaganda", "polarization", "cancel", "woke", "narrative"],
  tech: ["startup", "founder", "vc", "funding", "valuation", "ipo", "acquisition", "saas", "cloud", "open source", "developer", "engineering", "scale", "infrastructure", "platform", "ecosystem", "web3", "decentralized"],
  crypto: ["ethereum", "eth", "solana", "sol", "defi", "nft", "dao", "protocol", "blockchain", "chain", "wallet", "swap", "yield", "stake", "staking", "airdrop", "mainnet", "testnet", "layer 2", "l2", "bridge", "mint"]
};

/* ─── Mode metadata (reduces ternary chains) ─── */

const MODE_META = {
  [MODE_LOCAL]: {
    label: "Quick Local",
    hint: "Quick Local works without any model and is best for fast filtering.",
    idleHint: "Quick Local gives a fast grounded read without needing any model.",
    verdictDesc: "A fast yes-or-no call based on whether there is a clear angle.",
    loadingComment: "Importing the post and running a fast local pass for relevance, tone, and angle.",
    loadingHint: "Using quick local logic so the app still works without any model.",
    loadingVerdict: "Testing whether there is a grounded local reason to reply.",
    loadingReason: "Falling back to skip if the angle is weak or too reusable.",
    statusPrefix: "Quick Local",
    passedHint: "Quick Local found one grounded angle without needing a model."
  },
  [MODE_FOCUSED]: {
    label: "Focused AI",
    hint: "Focused AI uses the OpenAI reasoning backend for the strongest pass.",
    idleHint: "Focused AI will do a deeper reasoning pass before showing one reply.",
    verdictDesc: "A deeper yes-or-no call based on whether the reply adds value.",
    loadingComment: "Reading the post, checking what it is really saying, and pressure-testing one reply.",
    loadingHint: "Using live model reasoning plus a final quality check.",
    loadingVerdict: "Testing whether the best reply is genuinely worth posting.",
    loadingReason: "Rejecting replies that sound generic, stiff, or off-topic.",
    statusPrefix: "Focused AI",
    passedHint: "Focused AI passed this reply through a second quality check before showing it."
  },
  [MODE_CLAUDE]: {
    label: "Claude",
    hint: "Claude uses Anthropic's API through the local backend.",
    idleHint: "Claude will do a hosted reasoning pass before showing one reply.",
    verdictDesc: "A Claude-based yes-or-no call based on whether the reply adds value.",
    loadingComment: "Reading the post with Claude and pressure-testing whether one reply is genuinely worth posting.",
    loadingHint: "Using Anthropic's hosted reasoning path plus a final quality check.",
    loadingVerdict: "Testing whether Claude can support a reply genuinely worth posting.",
    loadingReason: "Rejecting replies that sound generic, stiff, or off-topic.",
    statusPrefix: "Claude",
    passedHint: "Claude passed this reply through a second quality check before showing it."
  },
  [MODE_OLLAMA]: {
    label: "Ollama",
    hint: "Ollama runs a local model on this PC through the local backend.",
    hintUnavailable: "Ollama mode needs a running local Ollama server and at least one downloaded model.",
    idleHint: "Ollama uses a local model on this PC through the same 3-panel flow.",
    verdictDesc: "A local-model yes-or-no call based on whether the reply adds value.",
    loadingComment: "Sending the post to your local Ollama model and running the same reply judgment flow on-device.",
    loadingHint: "Using your local model through Ollama instead of the hosted API.",
    loadingVerdict: "Testing whether the local model can support a reply worth posting.",
    loadingReason: "Using the selected local Ollama model for the reasoning pass.",
    statusPrefix: "Ollama",
    passedHint: "Ollama used your local model for the reasoning pass and final reply."
  }
};

function meta() {
  return MODE_META[state.mode] || MODE_META[MODE_LOCAL];
}

/* ─── Utilities ─── */

function setImportStatus(type, message) {
  const statusText = $.importStatus.querySelector(".status-text");
  if (statusText) {
    statusText.textContent = message;
  } else {
    $.importStatus.textContent = message;
  }
  $.importStatus.className = "status-bar";
  if (type) $.importStatus.classList.add(`status-${type}`);
}

function renderReasons(reasons) {
  $.verdictReasons.innerHTML = "";
  (reasons || []).forEach((reason) => {
    const item = document.createElement("li");
    item.textContent = reason;
    $.verdictReasons.appendChild(item);
  });
}

function modeLabel() {
  return meta().label;
}

function updateOllamaPlaceholder() {
  $.ollamaModel.placeholder = state.defaultOllamaModel
    ? `Leave blank to use ${state.defaultOllamaModel}`
    : state.ollamaAvailable
      ? "Leave blank to auto-detect"
      : "Start Ollama first, then choose a local model";
}

function updateModeUi() {
  const m = state.mode;
  const modeOrder = [MODE_LOCAL, MODE_FOCUSED, MODE_CLAUDE, MODE_OLLAMA];
  const modeIndex = modeOrder.indexOf(m);

  [
    [$.modeLocalBtn, MODE_LOCAL],
    [$.modeFocusedBtn, MODE_FOCUSED],
    [$.modeClaudeBtn, MODE_CLAUDE],
    [$.modeOllamaBtn, MODE_OLLAMA]
  ].forEach(([btn, mode]) => {
    btn.classList.toggle("active", m === mode);
    btn.setAttribute("aria-pressed", String(m === mode));
  });

  /* Slide the track pill to the active position */
  if ($.modeTrack && modeIndex >= 0) {
    $.modeTrack.style.transform = `translateX(${modeIndex * 100}%)`;
  }

  $.apiKeyField.classList.toggle("field-hidden", m !== MODE_FOCUSED);
  $.claudeApiKeyField.classList.toggle("field-hidden", m !== MODE_CLAUDE);
  $.ollamaModelField.classList.toggle("field-hidden", m !== MODE_OLLAMA);
  updateOllamaPlaceholder();

  if (m === MODE_OLLAMA && !state.ollamaAvailable) {
    $.modeHint.textContent = MODE_META[MODE_OLLAMA].hintUnavailable;
  } else {
    $.modeHint.textContent = meta().hint;
  }
}

/* ─── Render states ─── */

function renderIdle() {
  const m = meta();
  $.suggestedCard.classList.add("placeholder");
  $.suggestedTitle.textContent = "Suggested Reply";
  $.suggestedComment.textContent = "Paste a post first. The app will suggest one sharper reply only if it has a real angle.";
  $.copyBtn.classList.add("hidden");
  state.lastReply = "";
  $.suggestionHint.textContent = m.idleHint;
  $.verdictBadge.textContent = "Waiting";
  $.verdictBadge.className = "verdict-badge verdict-waiting";
  $.verdictSummary.textContent = m.verdictDesc;
  renderReasons(["Looking for a post with a clear missing angle."]);
}

function renderLoading() {
  const m = meta();
  $.suggestedCard.classList.remove("placeholder");
  $.suggestedTitle.textContent = "Thinking";
  $.suggestedTitle.classList.add("thinking-dots");
  $.copyBtn.classList.add("hidden");
  $.suggestedComment.textContent = m.loadingComment;
  $.suggestionHint.textContent = m.loadingHint;
  $.verdictBadge.textContent = "Thinking";
  $.verdictBadge.className = "verdict-badge verdict-thinking";
  $.verdictSummary.textContent = m.loadingVerdict;
  $.analyzeBtn.classList.add("is-busy");
  renderReasons([
    "Resolving the post text first.",
    m.loadingReason
  ]);
}

function clearLoading() {
  $.suggestedTitle.classList.remove("thinking-dots");
  $.analyzeBtn.classList.remove("is-busy");
}

function renderError(message) {
  clearLoading();
  $.suggestedCard.classList.add("placeholder");
  $.suggestedTitle.textContent = "Could Not Analyze";
  $.suggestedComment.textContent = message;
  $.suggestionHint.textContent = "Fix the issue above and try again.";
  $.copyBtn.classList.add("hidden");
  $.verdictBadge.textContent = "Error";
  $.verdictBadge.className = "verdict-badge verdict-skip";
  $.verdictSummary.textContent = "The reasoning pass did not complete.";
  renderReasons([
    "No decision was made because the post could not be analyzed.",
    "Check the link, your mode setup, or your connection and try again."
  ]);
  state.lastReply = "";
}

function renderMissingKey(imported) {
  clearLoading();
  if (imported?.importedText) {
    $.postText.value = imported.importedText;
    setImportStatus("error", `Post imported from ${imported.authorHandle || "the source link"}, but Focused AI still needs an OpenAI API key.`);
  } else {
    setImportStatus("error", "Focused AI needs an OpenAI API key. Switch to Quick Local or Ollama, or add your key above.");
  }
  $.suggestedCard.classList.add("placeholder");
  $.suggestedTitle.textContent = "API Key Required";
  $.suggestedComment.textContent = "The post can be imported without a key, but Focused AI needs one to reason through the reply.";
  $.suggestionHint.textContent = "Add your key above or switch to Quick Local or Ollama.";
  $.copyBtn.classList.add("hidden");
  $.verdictBadge.textContent = "Setup";
  $.verdictBadge.className = "verdict-badge verdict-waiting";
  $.verdictSummary.textContent = "Focused AI is waiting for your API key.";
  renderReasons([
    "Import works without a key, but the deeper hosted reasoning pass does not.",
    "Paste your OpenAI API key above or switch to another mode."
  ]);
  state.lastReply = "";
}

function getStoredClaudeKey() {
  return (localStorage.getItem(CLAUDE_API_KEY_STORAGE_KEY) || "").trim();
}

function saveClaudeKey(value) {
  if (!value) {
    localStorage.removeItem(CLAUDE_API_KEY_STORAGE_KEY);
    return;
  }
  localStorage.setItem(CLAUDE_API_KEY_STORAGE_KEY, value.trim());
}

function renderMissingClaudeKey(imported) {
  clearLoading();
  if (imported?.importedText) {
    $.postText.value = imported.importedText;
    setImportStatus("error", `Post imported from ${imported.authorHandle || "the source link"}, but Claude mode still needs a Claude API key.`);
  } else {
    setImportStatus("error", "Claude mode needs a Claude API key. Switch to Quick Local or Ollama, or add your key above.");
  }
  $.suggestedCard.classList.add("placeholder");
  $.suggestedTitle.textContent = "Claude Key Required";
  $.suggestedComment.textContent = "The post can be imported without a key, but Claude mode needs one to reason through the reply.";
  $.suggestionHint.textContent = "Add your Claude key above or switch to Quick Local or Ollama.";
  $.copyBtn.classList.add("hidden");
  $.verdictBadge.textContent = "Setup";
  $.verdictBadge.className = "verdict-badge verdict-waiting";
  $.verdictSummary.textContent = "Claude mode is waiting for your API key.";
  renderReasons([
    "Import works without a key, but the Claude reasoning pass does not.",
    "Paste your Claude API key above or switch to another mode."
  ]);
  state.lastReply = "";
}

function renderMissingOllama() {
  clearLoading();
  setImportStatus("error", "Ollama mode needs a running local Ollama server and at least one downloaded model.");
  $.suggestedCard.classList.add("placeholder");
  $.suggestedTitle.textContent = "Ollama Not Ready";
  $.suggestedComment.textContent = "The app could not find a usable local Ollama model on this PC.";
  $.suggestionHint.textContent = "Start Ollama, make sure it is listening locally, and download a model first.";
  $.copyBtn.classList.add("hidden");
  $.verdictBadge.textContent = "Setup";
  $.verdictBadge.className = "verdict-badge verdict-waiting";
  $.verdictSummary.textContent = "Ollama mode is waiting for a local model.";
  renderReasons([
    "The local backend could not detect a ready Ollama model.",
    "Start Ollama and try again, or switch to Quick Local or Focused AI."
  ]);
  state.lastReply = "";
}

function renderResult(payload) {
  clearLoading();
  const { imported, resolvedText, resolvedAuthorHandle, result } = payload;
  const noReply = !result.reply_text || result.reply_mode === "none";
  const currentLink = normalizeLink($.postLink.value);
  const m = meta();

  if (imported?.importedText) {
    $.postText.value = resolvedText || imported.importedText;
    state.lastImportedLink = currentLink;
    state.lastSeenLink = currentLink;
    setImportStatus("success", `Imported public post text from ${resolvedAuthorHandle || imported.authorHandle || "the source link"} using ${modeLabel()}.`);
  } else if (resolvedAuthorHandle) {
    if (currentLink) {
      state.lastImportedLink = currentLink;
      state.lastSeenLink = currentLink;
    }
    setImportStatus("success", `${modeLabel()} analyzed text from ${resolvedAuthorHandle}.`);
  } else {
    if (!currentLink) {
      state.lastImportedLink = "";
      state.lastSeenLink = "";
    }
    setImportStatus("success", `${modeLabel()} analyzed the text currently in the post box.`);
  }

  $.suggestedCard.classList.toggle("placeholder", noReply);
  $.suggestedTitle.textContent = result.reply_title || (noReply ? "No Reply Suggested" : "Suggested Reply");
  $.suggestedComment.textContent = noReply
    ? "No worthwhile reply angle here. Better to skip and move on."
    : result.reply_text;

  if (noReply) {
    $.copyBtn.classList.add("hidden");
    state.lastReply = "";
  } else {
    $.copyBtn.classList.remove("hidden");
    state.lastReply = result.reply_text;
  }

  if (result.reply_mode === "optional") {
    $.suggestionHint.textContent = "There is an angle here, but it is weaker or more situational than a clean green light.";
  } else if (result.reply_mode === "none") {
    $.suggestionHint.textContent = "The best available reply was not strong enough to keep.";
  } else {
    $.suggestionHint.textContent = m.passedHint;
  }

  $.verdictBadge.textContent = result.verdict === "comment" ? "Comment" : "Skip";
  $.verdictBadge.className = `verdict-badge ${result.verdict === "comment" ? "verdict-comment" : "verdict-skip"}`;
  $.verdictSummary.textContent = result.summary;
  renderReasons(result.reasons || []);
}

/* ─── Busy state ─── */

function setBusy(nextBusy) {
  state.busy = nextBusy;
  const targets = ["analyzeBtn", "clearBtn", "apiKey", "claudeApiKey", "ollamaModel", "postLink", "postText", "modeLocalBtn", "modeFocusedBtn", "modeClaudeBtn", "modeOllamaBtn"];
  targets.forEach((key) => { $[key].disabled = nextBusy; });
  const btnLabel = $.analyzeBtn.querySelector(".btn-label");
  if (btnLabel) {
    btnLabel.textContent = nextBusy ? "Analyzing..." : "Analyze";
  } else {
    $.analyzeBtn.textContent = nextBusy ? "Analyzing..." : "Analyze";
  }
}

/* ─── String helpers ─── */

function normalizeWhitespace(value) {
  return (value || "").replace(/\r/g, "").trim();
}

function normalizeText(value) {
  return normalizeWhitespace(value).toLowerCase();
}

function normalizeLink(value) {
  return normalizeWhitespace(value);
}

function looksLikeStatusLink(value) {
  return /https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/[^/\s]+\/status\/\d+/i.test(
    normalizeLink(value)
  );
}

function containsAny(text, list) {
  return list.some((item) => text.includes(item));
}

function countMatches(text, list) {
  return list.reduce((n, item) => n + (text.includes(item) ? 1 : 0), 0);
}

/* ─── Persistence ─── */

function saveForm() {
  localStorage.setItem(
    FORM_STORAGE_KEY,
    JSON.stringify({
      mode: state.mode,
      apiKey: $.apiKey.value.trim(),
      claudeApiKey: $.claudeApiKey.value.trim(),
      ollamaModel: $.ollamaModel.value.trim(),
      postLink: $.postLink.value.trim(),
      postText: $.postText.value
    })
  );
}

function getStoredApiKey() {
  return (localStorage.getItem(API_KEY_STORAGE_KEY) || "").trim();
}

function saveApiKey(value) {
  if (!value) {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
    return;
  }
  localStorage.setItem(API_KEY_STORAGE_KEY, value.trim());
}

function restoreForm() {
  let savedMode = "";
  try {
    const raw = localStorage.getItem(FORM_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      savedMode = parsed.mode || "";
      $.apiKey.value = parsed.apiKey || getStoredApiKey();
      $.claudeApiKey.value = parsed.claudeApiKey || getStoredClaudeKey();
      $.ollamaModel.value = parsed.ollamaModel || "";
      $.postLink.value = parsed.postLink || "";
      $.postText.value = parsed.postText || "";
      state.lastSeenLink = normalizeLink(parsed.postLink || "");
    }
  } catch {
    $.apiKey.value = getStoredApiKey();
    $.claudeApiKey.value = getStoredClaudeKey();
  }

  if ([MODE_FOCUSED, MODE_CLAUDE, MODE_OLLAMA, MODE_LOCAL].includes(savedMode)) {
    state.mode = savedMode;
  } else if (getStoredApiKey()) {
    state.mode = MODE_FOCUSED;
  } else if (getStoredClaudeKey()) {
    state.mode = MODE_CLAUDE;
  } else {
    state.mode = MODE_LOCAL;
  }

  state.lastSeenLink = state.lastSeenLink || normalizeLink($.postLink.value);
  updateModeUi();
}

/* ─── Health check ─── */

async function checkHealth() {
  try {
    const response = await fetch("/api/health", { cache: "no-store" });
    if (!response.ok) {
      setImportStatus("error", "This page is not connected to the local reasoning server. Close it and reopen launch.bat from the app folder.");
      return;
    }
    const payload = await response.json();
    state.serverHasKey = Boolean(payload.hasServerKey);
    state.serverHasClaudeKey = Boolean(payload.hasClaudeKey);
    state.ollamaAvailable = Boolean(payload.ollama && payload.ollama.available);
    state.defaultOllamaModel = (payload.ollama && payload.ollama.defaultModel) || "";
    updateModeUi();

    if (state.mode === MODE_FOCUSED) {
      if (state.serverHasKey) {
        $.apiKey.value = "";
        setImportStatus("success", "Focused AI is ready with a server-side key. Paste a post and analyze.");
      } else if (getStoredApiKey()) {
        $.apiKey.value = getStoredApiKey();
        setImportStatus("success", "Focused AI is ready with a locally stored API key.");
      } else {
        setImportStatus("", "Focused AI needs an OpenAI API key. Switch to Quick Local or Ollama if you want to work without one.");
      }
    } else if (state.mode === MODE_CLAUDE) {
      if (state.serverHasClaudeKey) {
        $.claudeApiKey.value = "";
        setImportStatus("success", "Claude is ready with a server-side key. Paste a post and analyze.");
      } else if (getStoredClaudeKey()) {
        $.claudeApiKey.value = getStoredClaudeKey();
        setImportStatus("success", "Claude is ready with a locally stored API key.");
      } else {
        setImportStatus("", "Claude mode needs a Claude API key. Switch to Quick Local or Ollama if you want to work without one.");
      }
    } else if (state.mode === MODE_OLLAMA) {
      setImportStatus(
        state.ollamaAvailable ? "success" : "error",
        state.ollamaAvailable
          ? `Ollama is ready on this PC.${state.defaultOllamaModel ? ` Default model: ${state.defaultOllamaModel}.` : ""}`
          : "Ollama mode needs a running local Ollama server and at least one local model."
      );
    } else {
      setImportStatus("success", "Quick Local is ready. Paste a post and analyze without any model.");
    }
  } catch {
    setImportStatus("error", "Could not reach the local reasoning server. Close this tab, reopen launch.bat, and let it open a fresh localhost page.");
  }
}

/* ─── Network helpers ─── */

function looksLikeHtmlErrorPage(value) {
  const text = (value || "").trim().toLowerCase();
  return text.startsWith("<!doctype html") || text.startsWith("<html") || text.includes("<title>error response</title>") || text.includes("unsupported method ('post')");
}

async function postJson(url, payload) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 90000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const rawText = await response.text();
    let data = {};
    try { data = rawText ? JSON.parse(rawText) : {}; } catch {}
    if (!response.ok) {
      const wrongServer =
        response.status === 501 ||
        (response.headers.get("content-type") || "").includes("text/html") ||
        looksLikeHtmlErrorPage(rawText);
      const error = new Error(
        wrongServer
          ? "This page is running on an old static server. Close it and reopen launch.bat from the cyberekt-reply-copilot folder."
          : data.message || rawText || `Request failed (${response.status}).`
      );
      error.code = wrongServer ? "wrong_server" : data.code || "request_failed";
      throw error;
    }
    return data;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function resolveImportedInput(postLink, postText) {
  let imported = null;
  let resolvedText = normalizeWhitespace(postText);
  let authorHandle = "";
  const normalizedPostLink = normalizeLink(postLink);
  const shouldForceImport =
    normalizedPostLink &&
    looksLikeStatusLink(normalizedPostLink) &&
    normalizedPostLink !== state.lastImportedLink;

  if (postLink && (!resolvedText || shouldForceImport)) {
    imported = await postJson("/api/import", { postLink });
    resolvedText = imported.importedText || "";
    authorHandle = imported.authorHandle || "";
  } else if (postLink) {
    try {
      imported = await postJson("/api/import", { postLink });
      authorHandle = imported.authorHandle || "";
    } catch {}
  }
  return { imported, resolvedText, authorHandle };
}

/* ═══════════════════════════════════════════════════════════════════════
   LOCAL REASONER ENGINE — v2
   Full rewrite: deep text analysis, reply variant pools, randomization,
   tone/structure detection, entity extraction, sentence-level scoring.
   Every Analyze click produces a different reply for the same post.
   ═══════════════════════════════════════════════════════════════════════ */

function noReply(summary, reasons) {
  return { verdict: "skip", reply_mode: "none", summary, reasons, reply_title: "No Reply Suggested", reply_text: "" };
}

function reply(verdict, replyMode, summary, reasons, replyText, replyTitle) {
  return {
    verdict,
    reply_mode: replyMode,
    summary,
    reasons,
    reply_title: replyTitle || (replyMode === "optional" ? "Optional Reply" : "Suggested Reply"),
    reply_text: replyText
  };
}

/* ─── Randomness helpers ─── */

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, shuffled.length));
}

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

/* ─── Text analysis toolkit ─── */

function analyzePost(raw) {
  const lower = raw.toLowerCase();
  const words = lower.match(/[a-z0-9$@#]+/g) || [];
  const sentences = raw.split(/[.!?\n]+/).map(s => s.trim()).filter(Boolean);
  const wordCount = words.length;

  /* Structure detection */
  const hasQuestion = /\?/.test(raw);
  const isQuestion = hasQuestion && sentences.filter(s => s.includes("?")).length >= sentences.length * 0.5;
  const hasUrl = /https?:\/\/\S+/.test(raw);
  const hasMention = /@\w+/.test(raw);
  const hasTicker = /\$[A-Z]{2,5}/.test(raw);
  const hasHashtag = /#\w+/.test(raw);
  const hasEmoji = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(raw);
  const isThread = /^(?:1\/|\d+\)|thread:|🧵)/i.test(raw.trim());
  const isQuoteRT = /^(?:RT\s|"|"|«)/i.test(raw.trim()) || lower.includes("quote tweet");
  const allCaps = raw.length >= 10 && raw.replace(/[^A-Z]/g, "").length > raw.replace(/[^A-Za-z]/g, "").length * 0.65;
  const shortPost = wordCount <= 7;
  const veryShort = wordCount <= 3;
  const mediumPost = wordCount > 7 && wordCount <= 30;
  const longPost = wordCount > 30;

  /* Tone detection */
  const aggressiveWords = countMatches(lower, ["scam", "fraud", "lie", "liar", "garbage", "trash", "terrible", "awful", "worst", "pathetic", "joke", "clown", "stupid", "idiot", "disgusting", "corrupt", "criminal", "steal", "stolen", "destroying", "disaster"]);
  const positiveWords = countMatches(lower, ["great", "amazing", "incredible", "brilliant", "excellent", "love", "beautiful", "fantastic", "impressive", "solid", "perfect", "genius", "excited", "bullish", "optimistic", "thrilled"]);
  const negativeWords = countMatches(lower, ["bad", "wrong", "fail", "failed", "broken", "dead", "dying", "collapse", "crash", "dump", "bearish", "worried", "concerned", "scary", "dangerous", "risky", "overvalued", "bubble"]);
  const sarcasticPatterns = /(?:oh sure|yeah right|totally|definitely not|sure thing|lmao|as if|imagine thinking|copium|cope)/i.test(raw);
  const urgentPatterns = /(?:breaking|just in|urgent|alert|confirmed|happening now|right now|developing)/i.test(raw);

  let tone = "neutral";
  if (aggressiveWords >= 2 || (aggressiveWords >= 1 && shortPost)) tone = "aggressive";
  else if (sarcasticPatterns) tone = "sarcastic";
  else if (urgentPatterns) tone = "urgent";
  else if (positiveWords >= 2) tone = "positive";
  else if (negativeWords >= 2) tone = "negative";
  else if (allCaps) tone = "shouting";

  /* Blunt negative detection */
  const bluntNegative = /can't|cannot|dont|don't|won't|wont|never|nobody|nothing|no one|not real|not worth/i.test(raw);

  /* Extract key entities/nouns from the post */
  const entities = extractEntities(raw);

  /* Score categories */
  const scores = {};
  for (const [cat, keywords] of Object.entries(CATEGORIES)) {
    scores[cat] = countMatches(lower, keywords);
  }

  /* Rank categories by score */
  const ranked = Object.entries(scores)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  const topCategory = ranked.length > 0 ? ranked[0][0] : null;
  const secondCategory = ranked.length > 1 ? ranked[1][0] : null;
  const totalSignals = Object.values(scores).reduce((a, b) => a + b, 0);

  /* Detect post intent */
  const isAnnouncement = /(?:announcing|we're|we are|introducing|proud to|excited to|just launched|now available|rolling out)/i.test(raw);
  const isOpinion = /(?:i think|i believe|imo|in my opinion|my take|personally|honestly|frankly|hot take|unpopular opinion)/i.test(raw);
  const isNews = /(?:breaking|report|according to|sources say|confirmed|announced|reuters|bloomberg|cnbc|wsj|nyt)/i.test(raw);
  const isComparison = /(?:vs\.?|versus|compared to|better than|worse than|over|instead of)/i.test(raw);
  const isAdvice = /(?:you should|stop doing|start doing|pro tip|reminder|don't forget|always|never\s)/i.test(raw);
  const isPrediction = /(?:will be|going to|prediction|predict|expect|calling it|mark my words|bet|watch this)/i.test(raw);

  return {
    raw, lower, words, sentences, wordCount,
    shortPost, veryShort, mediumPost, longPost,
    hasQuestion, isQuestion, hasUrl, hasMention, hasTicker, hasHashtag, hasEmoji,
    isThread, isQuoteRT, allCaps,
    tone, bluntNegative,
    aggressiveWords, positiveWords, negativeWords, sarcasticPatterns,
    entities,
    scores, ranked, topCategory, secondCategory, totalSignals,
    isAnnouncement, isOpinion, isNews, isComparison, isAdvice, isPrediction
  };
}

function extractEntities(raw) {
  const entities = {
    mentions: [],
    tickers: [],
    hashtags: [],
    companies: [],
    topics: [],
    keyPhrases: []
  };

  /* @mentions */
  const mentions = raw.match(/@(\w+)/g);
  if (mentions) entities.mentions = [...new Set(mentions)];

  /* $tickers */
  const tickers = raw.match(/\$[A-Z]{2,5}/g);
  if (tickers) entities.tickers = [...new Set(tickers)];

  /* #hashtags */
  const hashtags = raw.match(/#(\w+)/g);
  if (hashtags) entities.hashtags = [...new Set(hashtags)];

  /* Known company/product names */
  const companyMap = {
    apple: "Apple", google: "Google", microsoft: "Microsoft", amazon: "Amazon",
    meta: "Meta", facebook: "Facebook", twitter: "Twitter", openai: "OpenAI",
    anthropic: "Anthropic", nvidia: "Nvidia", tesla: "Tesla", coinbase: "Coinbase",
    binance: "Binance", stripe: "Stripe", paypal: "PayPal", visa: "Visa",
    mastercard: "Mastercard", blackrock: "BlackRock", fidelity: "Fidelity",
    jpmorgan: "JPMorgan", "goldman sachs": "Goldman Sachs", spacex: "SpaceX"
  };
  const lower = raw.toLowerCase();
  for (const [key, name] of Object.entries(companyMap)) {
    if (lower.includes(key)) entities.companies.push(name);
  }

  /* Extract capitalized multi-word phrases as potential topics */
  const phraseMatches = raw.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/g);
  if (phraseMatches) {
    entities.keyPhrases = [...new Set(phraseMatches)].slice(0, 4);
  }

  /* Extract quoted text */
  const quoted = raw.match(/[""\u201C]([^""\u201D]+)[""\u201D]/g);
  if (quoted) {
    entities.keyPhrases.push(...quoted.map(q => q.replace(/["""\u201C\u201D]/g, "")).slice(0, 2));
  }

  return entities;
}

/* ─── Reply variant pools ─── */

const REPLY_POOLS = {
  gm_greeting: [
    "GM! Let's get it today.",
    "GM back. Locked in and ready.",
    "GM! Hope the charts are green for everyone today.",
    "GM to everyone building, not just watching.",
    "Good morning! Another day, another opportunity.",
    "GM! Coffee first, alpha second.",
    "GM fam. Stay focused, stay sharp.",
    "Good morning! Who's building something today?",
    "GM! Woke up bullish, not gonna lie.",
    "GM! The grind never stops.",
    "GM! Let's make today count.",
    "Good morning everyone! Positive vibes only today.",
    "GM! Early bird catches the alpha.",
    "GM! Already locked in. Let's go.",
    "GM! New day, new opportunities. Stay sharp.",
    "Good morning! Time to execute.",
    "GM king. Locked in as always.",
    "GM! Best part of the day is getting started.",
    "Good morning! Energy is high today, let's build.",
    "GM! Day ones stay consistent.",
    "GM! Rise and grind. No days off.",
    "Good morning! Sending good energy to the timeline.",
    "GM! The hustle is real and so is this coffee.",
    "GM! Ready to make moves today.",
    "Good morning! Big things coming, stay tuned.",
    "GM fam! Time to lock in and level up.",
    "GM! Hope everyone's portfolio is smiling today.",
    "GM! Consistency beats everything. Another day at it.",
    "Good morning! Let's keep the momentum going.",
    "GM! Today feels like a good day to win.",
  ],
  community_vibe: [
    "Locked in. Let's get this bread.",
    "Always locked in. No days off.",
    "Present and accounted for. Let's build.",
    "Right here. Ready to go.",
    "Locked in since day one.",
    "Here and not leaving. Let's go.",
    "You already know. Locked in.",
    "Always. This is the way.",
    "Right here with you. Let's get it.",
    "Checked in and locked in. Full send.",
    "Been locked in. Not stopping now.",
    "Present. Let's make it a good one.",
    "We're here. Let's build something.",
    "Locked in and not looking back.",
    "Day ones don't miss roll call.",
    "All in. Every single day.",
    "Locked in, caffeinated, and ready.",
    "Here for the long run. Always.",
    "We stay. That's the difference.",
    "Count me in. Always.",
  ],
  trust_blunt: [
    'If privacy still depends on "trust us," that is not privacy. That is branding.',
    "Trust without verification is just marketing with extra steps.",
    "The moment you have to ask whether they can see your messages, you already have your answer.",
    'When the privacy policy says "we care about your privacy," read the next 40 pages to find out how much.',
    "Privacy is not a feature toggle. Either the architecture enforces it or it does not.",
    "The question is never whether they promise privacy. It is whether the system still works if they break that promise.",
    "If deleting your data requires trusting the same people you are deleting it from, nothing changed.",
    'Every "we take your privacy seriously" email is written by someone who does not.',
    "End-to-end encryption matters, but only when the endpoints are not also controlled by the same company.",
    "Real privacy means they cannot see your data even if they wanted to. Anything else is just policy.",
  ],
  trust_encryption: [
    "Encryption is the headline. Getting people to move their real conversations is the harder part.",
    "Encrypted by default matters less when the metadata still tells the full story.",
    "The feature is encryption. The product question is whether anyone actually switches their daily habits.",
    "Everyone ships encryption now. The real question is what still leaks around the edges.",
    "Encryption without open-source verification is just a nicer lock on the same box.",
    "Being encrypted does not mean being private. Those are two different promises.",
    "The hard part is not building encryption. It is convincing people their current app is not good enough.",
    "Announcing encryption is easy. Proving you cannot access messages even under subpoena is harder.",
  ],
  trust_general: [
    "The real trust test is what the system still sees, stores, or shares around the edges.",
    "Trust in tech is not about what they say. It is about what the architecture makes impossible.",
    "If your privacy depends on a policy that can change with a board vote, it is not really yours.",
    "The default settings tell you everything about what the company actually wants.",
    "Trust breaks slowly and then all at once. Usually right after an acquisition.",
    "Privacy is a system property, not a product feature. You cannot bolt it on after the fact.",
    "The question is not whether you trust them today. It is whether the system still protects you when incentives change.",
    "What they can see is more important than what they say they will not look at.",
  ],
  legal_ai: [
    "Serious claim. The bar has to be evidence, process, and a standard that survives more than one news cycle.",
    "The investigation matters less than what standard it sets for everyone else.",
    "If accountability only kicks in after public outrage, it is not really accountability.",
    "The useful question is not whether they did something wrong. It is whether anyone could have stopped them beforehand.",
    "Legal pressure works when it creates precedent. Without that, it is just expensive theater.",
    "The real test is whether this investigation changes what the next company builds, or just what they say publicly.",
    "Investigations are easy to announce. Standards that survive lobbying are what actually matter.",
    "The gap between what AI companies promise and what they can prove is where regulators should be looking.",
  ],
  legal_general: [
    "Support is easy. Evidence, enforceability, and timeline are what make a claim like this real.",
    "The real question is whether this is regulating conduct, outputs, or compelled speech. Those are very different fights.",
    "Laws with no enforcement mechanism are just press releases with more steps.",
    "The gap between passing a law and enforcing it is where most of these efforts die quietly.",
    "Every regulation creates the incentive structure for the next workaround. The question is whether this one accounts for that.",
    "Legislation is the starting line, not the finish. The hard part is what happens when someone well-funded pushes back.",
    "If the penalty is cheaper than the profit, it is not a regulation. It is a licensing fee.",
    "The test is not whether the rule sounds good. It is whether it survives the first serious legal challenge.",
  ],
  product_infra: [
    "Better rails matter only if they show up in repeat usage and real flow. Infrastructure alone is not the same as demand.",
    "Shipping infrastructure is the easy part. Getting the first 10,000 real transactions through it is where it gets real.",
    "The feature announcement is the start of the story, not the proof. Usage data in six months is what matters.",
    "Infrastructure without distribution is a solution looking for a problem. The question is who actually switches.",
    "Every rails upgrade promises lower friction. The real test is whether anyone who was not already using it starts.",
    "Building the pipes is step one. The harder question is whether anyone turns on the faucet.",
    "New infrastructure gets funded on potential. It gets validated on retention.",
    "The announcement sounds like progress. The real question is whether it changes anyone's daily flow.",
  ],
  product_general: [
    "Shipping the feature is step one. The harder part is getting people to change default behavior.",
    "Features ship. Habits do not. The gap between those two is where most launches die quietly.",
    "The launch is always clean. The interesting part is month-three retention.",
    "Nice feature. The real question is whether it changes the thing people actually complain about.",
    "Every launch promises to change behavior. Most of them end up as settings nobody opens.",
    "The feature looks good on the changelog. Whether it changes daily usage is a different question.",
    "Launches get attention. Integrations that actually stick are rarer and more interesting.",
    "The question is not whether it works. It is whether it works well enough to make people switch.",
  ],
  market_general: [
    "The better question is whether this changes real demand or just makes the rails cleaner.",
    "Price tells you what happened. Flow tells you what is happening. Neither tells you what is next.",
    "Markets price in narratives faster than fundamentals. The question is which one is driving this.",
    "Liquidity explains the move better than conviction. That matters for what comes after.",
    "The chart is the easy part to talk about. The positioning underneath is more interesting.",
    "Everyone sees the same price action. The edge is in understanding what it took to get there.",
    "Momentum without new demand is just recycling the same money. Worth asking which one this is.",
    "The interesting question is not the level. It is what changes about the flow of money if it holds.",
  ],
  ai_general: [
    "The model is impressive. The harder question is what it does to the workflow of someone who uses it daily.",
    "AI demos are always convincing. Production reliability three months later is the real benchmark.",
    "The capability is clear. What is less clear is whether it solves a problem people were actually willing to pay to fix.",
    "Benchmarks measure what the lab cares about. User retention measures what everyone else cares about.",
    "Every new model is 'the best yet.' The useful question is what it makes possible that was not before.",
    "The technology is not the bottleneck anymore. Distribution, trust, and integration are.",
    "Intelligence is cheap now. Reliability, safety, and knowing when to say 'I do not know' are expensive.",
    "Impressive capability. The question is whether it is 10x better at the thing people actually need, or 2x better at everything.",
  ],
  crypto_general: [
    "The protocol looks clean on paper. The question is whether it survives real adversarial conditions.",
    "Decentralization is a spectrum, not a checkbox. Worth asking where this actually sits.",
    "The tokenomics tell you who benefits first. The usage tells you who benefits at all.",
    "On-chain activity is the signal. Everything else is marketing.",
    "The tech is interesting. The regulatory surface area is the part nobody wants to talk about.",
    "Building in crypto means building for the next cycle, not this one. The question is whether this survives the gap.",
    "Every protocol promises decentralization. The validator set and governance votes tell the real story.",
    "Yield has to come from somewhere. If you cannot explain where, you are the yield.",
  ],
  social_general: [
    "The framing matters more than the facts here. Worth asking who benefits from this particular narrative.",
    "Easy to have a take. Harder to have one that survives encountering the strongest counterargument.",
    "Most debates like this generate heat, not light. The interesting angle is what would actually change someone's mind.",
    "The loudest voices on this are usually the least affected by the outcome.",
    "There is a real tension here, but the conversation will only move forward if someone separates the signal from the outrage.",
    "Strong opinions, loosely held sounds smart until you realize most people skip the second part.",
    "The useful take is not which side is right. It is what incentive structure created this situation.",
    "Culture war framing makes every conversation binary. Reality rarely cooperates.",
  ],
  tech_startup: [
    "Funding validates the pitch, not the product. Revenue at scale is what validates the product.",
    "The founding story is always inspiring. The question is whether the unit economics work at scale.",
    "Building is the fun part. Selling is the hard part. Retaining is the part nobody talks about.",
    "Startups that solve a real problem grow. Startups that solve an investor's thesis get funded. Those are not always the same.",
    "The ecosystem is interesting. The question is whether it compounds or just adds features.",
    "Every startup looks inevitable in the success story. The messy middle is where the real decisions happen.",
    "Open source gets adoption. The business model around it is the harder puzzle.",
    "The valuation prices in a future that has to actually happen. Worth asking what specifically needs to go right.",
  ],
  opinion_counter: [
    "Interesting take, but the strongest version of the counterargument is worth sitting with before committing.",
    "The framing here is doing a lot of heavy lifting. Strip it away and the core claim is thinner than it looks.",
    "This sounds right until you think about who has the most incentive to make you believe it.",
    "Strong framing, but the thing that matters is what the post is not saying.",
    "The certainty here is interesting. Usually the people closest to the problem are less sure.",
    "Worth stress-testing this against the base rate. Most confident predictions in this space age badly.",
    "The logic checks out on the surface. The assumptions underneath are doing the real work.",
    "Easy to agree with. Harder to explain what changes about your behavior if it is true.",
  ],
  question_response: [
    "Better question than most. The answer probably depends on a variable nobody in the replies is naming.",
    "The question is sharper than most answers it will get. Worth watching what the non-obvious responses surface.",
    "Good question. But the framing might be hiding a more important question underneath.",
    "This is the right question asked slightly too broadly. The useful version is more specific.",
    "The question assumes something that might not be true. Worth checking the premise first.",
    "Interesting question. The fact that nobody has a clean answer tells you something about the state of the field.",
  ],
  news_reaction: [
    "The headline is doing a lot of work. The details underneath usually tell a different story.",
    "First reports are almost always incomplete. Worth waiting for the second version before forming a strong take.",
    "The news is interesting. The second-order effects are more interesting.",
    "This is being framed as surprising, but the setup has been visible for months.",
    "The announcement matters less than what it signals about what is coming next.",
    "Worth separating the news from the narrative being built around it. They are not the same thing.",
    "Everyone will react to the headline. The edge is in reading the footnotes.",
    "The timing of this announcement is more interesting than the content.",
  ],
  prediction_check: [
    "Predictions with no timeline are just vibes. What is the falsification window here?",
    "Easy prediction to make when you do not have to say when. Timeframes separate conviction from performance.",
    "The prediction might be right. But the path from here to there is where most of the risk lives.",
    "Calling it now is fun. Specifying what would prove you wrong is more useful.",
    "Most predictions in this space are unfalsifiable by design. This one is no exception unless you add a deadline.",
    "The direction might be right. The magnitude and timing are where the money is actually made or lost.",
  ],
  advice_pushback: [
    "This advice works for a specific context that the post is not naming. Outside that context, it breaks.",
    "Good advice for some people. Dangerous advice for others. The post does not distinguish.",
    "The advice sounds clean. Reality is messier, and the exceptions matter more than the rule.",
    "Survivor bias is doing a lot of work here. The people this did not work for are not posting about it.",
    "General advice from a specific position. Worth checking whether your position is actually similar.",
    "The rule works until it does not. More useful to know when to break it.",
  ]
};

/* ─── Reason variant pools ─── */

const REASON_POOLS = {
  skip_casual: [
    ["There is no real missing angle to add here.", "A reply would likely feel forced or performative."],
    ["Personal posts do not need your commentary.", "If the best reply is 'nice,' there is no reply."],
    ["This is not a conversation to enter. It is a moment to let pass.", "Adding a reply here would feel out of place."],
    ["No substantive angle exists. Save the reply for something meatier.", "Casual posts deserve to stay casual."],
  ],
  skip_bait: [
    ["Replying would likely reward the bait instead of adding value.", "A useful comment needs a stronger idea than 'compare notes below.'"],
    ["Engagement bait is designed to generate replies, not conversation.", "Your reply is the product, not the contribution."],
    ["The post exists to farm responses, not to start a real exchange.", "Anything you write here serves the algorithm, not you."],
    ["This is a prompt, not a point. Nothing meaningful to build on.", "If the post does not say anything, neither should you."],
  ],
  skip_hot_take: [
    ["There is not enough substance here to build a sharp reply on top of it.", "If your best move is paraphrasing the claim in calmer language, skip."],
    ["Hot takes survive on reactions, not rebuttals.", "The post is designed to be shared, not answered."],
    ["Price predictions with no analysis do not need commentary.", "Adding nuance to a headline that does not want nuance is a waste."],
    ["This is closer to a bumper sticker than a thesis.", "No angle here that would survive a five-second read."],
  ],
  comment_trust: [
    ["A short blunt post deserves a short blunt reply.", "The missing angle is that trust fails when the system still depends on 'just believe us.'"],
    ["The post touches a real nerve. There is space for a sharper point.", "The useful reply is about architecture, not feelings."],
    ["Trust is the explicit topic. A good reply can raise the bar on what trust means.", "Keep it about systems, not corporations."],
    ["There is a clean angle here about defaults and verification.", "The post opens the door for a reply that actually educates."],
  ],
  comment_legal: [
    ["A useful reply can shift this from outrage language to standards and proof.", "That adds something real without defending or repeating the post."],
    ["Legal posts need evidence logic, not emotional agreement.", "The sharper take is about process, precedent, or enforceability."],
    ["There is a gap between the accusation and the standard of proof. Your reply can fill it.", "Focus on what would actually make this stick."],
    ["The post is making a claim. The useful reply asks what evidence would be needed.", "That is more valuable than agreement or disagreement."],
  ],
  comment_product: [
    ["Infrastructure posts become more useful when you separate shipping from adoption.", "That gives you a sharper reply than simply praising the feature."],
    ["The announcement is the easy story. The adoption question is the real story.", "Your reply can bridge the gap between feature and usage."],
    ["Product launches are always optimistic. The useful angle is about real behavior change.", "Can you say something the launch post deliberately does not?"],
    ["The feature list is what they said. Usage patterns are what matters.", "A reply grounded in adoption is more valuable than feature excitement."],
  ],
  comment_general: [
    ["There is a clear missing angle that adds to the conversation.", "The reply is grounded in the post's actual content, not adjacent topics."],
    ["A sharp reply exists here without stretching or forcing.", "The angle is specific enough to feel like it belongs under this exact post."],
    ["The post leaves room for a point that genuinely improves the thread.", "Your reply would add something the post's audience has not considered."],
  ],
  comment_gm: [
    ["GM posts are community engagement. Replying builds visibility and presence.", "A quick, genuine response strengthens your account's social layer."],
    ["The post is a community roll call. Showing up is the reply.", "Consistency in replying to GM posts compounds over time."],
    ["This is a social ritual, not a debate. Match the energy and move on.", "Being present in the community is its own form of value."],
    ["GM posts are free engagement. Reply, stay visible, keep building.", "The reply does not need to be deep. It needs to be human."],
  ],
  comment_community: [
    ["Community check-in posts reward participation, not analysis.", "A short, energetic reply is the right move here."],
    ["The post is looking for engagement, and this time it deserves it.", "Showing up for your community is a valid reply strategy."],
    ["This is a presence check. Be present.", "The reply should match the energy: short, positive, direct."],
  ],
};

/* ─── The main reasoning engine ─── */

function runLocalReasoner(postText) {
  const p = analyzePost(postText);

  /* ── GM / Greeting posts — always reply ── */
  const isGmPost = /\b(?:gm|good\s*morning|gmorning|morning\s*everyone|morning\s*fam)\b/i.test(p.raw);
  const isGnPost = /\b(?:gn|good\s*night|goodnight|nighty?\s*night)\b/i.test(p.raw);
  const isGreeting = isGmPost || isGnPost;
  const isCommunityCheckin = /\b(?:who(?:'s|\s+is)\s+(?:locked\s*in|here|up|ready|building|grinding)|roll\s*call|check\s*in|sound\s*off|who(?:'s|\s+is)\s+with\s+me|locked\s*in\??|lfg|let'?s?\s*go|wagmi|we'?re?\s*(?:all\s+)?gonna\s+make\s+it)\b/i.test(p.raw);

  if (isGreeting) {
    return reply("comment", "suggested",
      pick([
        "Comment. GM posts are community engagement. Show up, reply, stay visible.",
        "Comment. This is a social ritual. Match the energy with a quick GM back.",
        "Comment. GM roll call. Replying keeps you present in the community.",
        "Comment. Greeting posts build social capital. A simple reply goes a long way.",
      ]),
      pick(REASON_POOLS.comment_gm),
      pick(REPLY_POOLS.gm_greeting),
      "GM Reply"
    );
  }

  /* ── Community check-in posts ("who's locked in", "lfg", etc.) ── */
  if (isCommunityCheckin) {
    return reply("comment", "suggested",
      pick([
        "Comment. Community check-in. Show up and be counted.",
        "Comment. The post is a roll call. Your reply is your presence.",
        "Comment. This is community engagement — reply with energy, not analysis.",
        "Comment. Participation posts reward showing up. Reply and move on.",
      ]),
      pick(REASON_POOLS.comment_community),
      pick(REPLY_POOLS.community_vibe),
      "Community Reply"
    );
  }

  /* ── Very short posts with no signal ── */
  if (p.veryShort && p.totalSignals === 0) {
    return noReply(
      pick([
        "Skip. Too short to determine a meaningful reply angle.",
        "Skip. Not enough substance for a grounded reply.",
        "Skip. Three words is not a conversation. It is a status update.",
      ]),
      pick([
        ["There is not enough substance to build a sharp reply.", "If the best reply feels forced, it is better to skip."],
        ["Short posts without a clear topic do not invite useful replies.", "Your time is better spent on something with more to work with."],
        ["Nothing to anchor a reply to.", "Skip and wait for a post that actually says something."],
      ])
    );
  }

  /* ── Casual content (but NOT greetings — those are handled above) ── */
  if (p.scores.casual > 0 && p.scores.trust === 0 && p.scores.legal === 0 && p.scores.ai === 0) {
    return noReply(
      pick([
        "Skip. This reads more like a personal post than a conversation worth entering.",
        "Skip. Casual post. No angle to sharpen here.",
        "Skip. Personal energy. Not a debate, not a thread, not a question.",
        "Skip. This is a vibe, not a topic. Let it be.",
      ]),
      pick(REASON_POOLS.skip_casual)
    );
  }

  /* ── Engagement bait (but NOT community check-ins — those are handled above) ── */
  if (p.scores.bait > 0 && p.scores.product === 0 && p.scores.trust === 0 && p.scores.legal === 0 && p.scores.ai === 0) {
    return noReply(
      pick([
        "Skip. This is mostly engagement bait or community checking.",
        "Skip. The post is farming replies, not starting a conversation.",
        "Skip. Engagement bait does not need your help going viral.",
        "Skip. This is a prompt for quantity, not quality.",
      ]),
      pick(REASON_POOLS.skip_bait)
    );
  }

  /* ── Price hot-takes / all-caps shouting ── */
  const priceHeadline = /\$\d[\d,]*/.test(p.raw) && containsAny(p.lower, ["bitcoin", "btc", "going to", "incoming", "moon", "pump", "dump"]);
  if (priceHeadline || (p.allCaps && p.shortPost && p.scores.market > 0)) {
    return noReply(
      pick([
        "Skip. This is closer to a hot take or headline than a real conversation.",
        "Skip. Price call with no analysis. Nothing to add.",
        "Skip. ALL CAPS conviction, no substance. Classic skip.",
        "Skip. The post is yelling a number, not making an argument.",
      ]),
      pick(REASON_POOLS.skip_hot_take)
    );
  }

  /* ── Trust / privacy posts ── */
  if (p.scores.trust > 0) {
    return handleTrustPost(p);
  }

  /* ── Legal / political posts ── */
  if (p.scores.legal > 0) {
    return handleLegalPost(p);
  }

  /* ── AI posts ── */
  if (p.scores.ai > 0) {
    return handleAIPost(p);
  }

  /* ── Crypto-specific posts ── */
  if (p.scores.crypto > 0) {
    return handleCryptoPost(p);
  }

  /* ── Product + market overlap (infrastructure shipping) ── */
  if (p.scores.product > 0 && (p.scores.market > 0 || containsAny(p.lower, ["payments", "stablecoin"]))) {
    return reply("comment", "suggested",
      pick([
        "Comment. The post is about shipping infrastructure, and the missing angle is whether it changes real usage.",
        "Comment. Infrastructure announcement. The sharper angle is about adoption, not the feature.",
        "Comment. The post ships rails. The reply should ask about traffic.",
      ]),
      pick(REASON_POOLS.comment_product),
      pick(REPLY_POOLS.product_infra)
    );
  }

  /* ── Pure product posts ── */
  if (p.scores.product > 0) {
    const strong = p.scores.product >= 3 || p.isAnnouncement;
    return reply(strong ? "comment" : "skip", strong ? "suggested" : "optional",
      pick([
        "There is a workable angle here focused on behavior change, not feature praise.",
        "Product post. The useful reply is about adoption, not excitement.",
        "The feature is the news. Whether it changes anything is the reply.",
      ]),
      pick(REASON_POOLS.comment_product),
      pick(REPLY_POOLS.product_general)
    );
  }

  /* ── Operational updates ── */
  if (p.scores.operational > 0) {
    return noReply(
      pick([
        "Skip. This reads more like an operational update than a high-value reply opportunity.",
        "Skip. Internal roadmap energy. No outside angle to add.",
        "Skip. Team update. Not a public conversation.",
      ]),
      pick([
        ["There is no obvious missing angle that improves the conversation.", "A reply here would likely feel generic or adjacent rather than genuinely useful."],
        ["Operational posts are for the team, not for reply guys.", "Nothing you add here improves the thread."],
        ["This is a status report, not a discussion prompt.", "Skip unless you have inside knowledge."],
      ])
    );
  }

  /* ── Tech / startup posts ── */
  if (p.scores.tech > 0) {
    return handleTechPost(p);
  }

  /* ── Social commentary ── */
  if (p.scores.social > 0) {
    return handleSocialPost(p);
  }

  /* ── Market posts ── */
  if (p.scores.market > 0) {
    return reply("skip", "optional",
      pick([
        "Skip by default. There is a market angle here, but only if you can be specific.",
        "Optional. Market post with a possible angle, but it is easy to sound generic.",
        "Skip unless you can add something the chart does not already say.",
      ]),
      pick([
        ["The useful move is separating infrastructure from actual demand.", "If that distinction feels too broad for the post, skip it."],
        ["Market commentary is crowded. Only enter if you have a non-obvious read.", "If your take would fit under any chart, it is not specific enough."],
        ["The post states a position. The useful reply challenges the mechanism, not the direction.", "That takes more effort than most replies are worth."],
      ]),
      pick(REPLY_POOLS.market_general)
    );
  }

  /* ── News posts ── */
  if (p.isNews || p.urgentPatterns) {
    return handleNewsPost(p);
  }

  /* ── Predictions ── */
  if (p.isPrediction) {
    return reply("comment", "optional",
      pick([
        "Optional. Predictions are easy to reply to if you can add a timeline or falsification check.",
        "Optional. The prediction is the post. The useful reply asks what proves it wrong.",
        "Comment if you can add specificity. Predictions without timelines are just vibes.",
      ]),
      pick(REASON_POOLS.comment_general),
      pick(REPLY_POOLS.prediction_check)
    );
  }

  /* ── Advice posts ── */
  if (p.isAdvice) {
    return reply("comment", "optional",
      pick([
        "Optional. Advice posts invite pushback, but only if your pushback is specific.",
        "Optional. There is a reply here, but only if you can name the exception or edge case.",
        "Comment if you can say when this advice breaks. Otherwise, skip.",
      ]),
      pick(REASON_POOLS.comment_general),
      pick(REPLY_POOLS.advice_pushback)
    );
  }

  /* ── Opinion posts ── */
  if (p.isOpinion && p.wordCount >= 10) {
    return reply("comment", "optional",
      pick([
        "Optional. The post states an opinion. The useful reply is the strongest counterpoint.",
        "Optional. Opinions invite replies, but only if yours adds a dimension the post is missing.",
        "Comment if your take survives steel-manning the post. Otherwise, skip.",
      ]),
      pick(REASON_POOLS.comment_general),
      pick(REPLY_POOLS.opinion_counter)
    );
  }

  /* ── Question posts ── */
  if (p.isQuestion && p.wordCount >= 8) {
    return reply(p.wordCount >= 15 ? "comment" : "skip", p.wordCount >= 15 ? "optional" : "optional",
      pick([
        "The post asks a question. There may be a sharp enough angle to answer.",
        "Optional. Questions invite replies, but only if yours is genuinely different.",
        "The question is worth engaging if you have a non-obvious answer.",
      ]),
      pick([
        ["Questions can invite replies, but only if you have a genuinely different take.", "If your answer would be generic, skip."],
        ["A good answer to a good question is rare on this platform.", "If you can provide one, it is worth posting."],
        ["The question is the prompt. Only reply if your answer would surprise.", "If your take sounds like everyone else's, hold it."],
      ]),
      pick(REPLY_POOLS.question_response)
    );
  }

  /* ── Posts with some substance but no clear category ── */
  if (p.wordCount >= 20 && p.totalSignals === 0) {
    return handleUncategorizedPost(p);
  }

  /* ── Default fallback ── */
  return noReply(
    pick([
      "Skip. There is no strong local angle here.",
      "Skip. Nothing in this post invites a reply that would actually add value.",
      "Skip. Quick Local could not find a non-generic angle.",
      "Skip. The post is either too thin, too vague, or too off-topic for a sharp reply.",
    ]),
    pick([
      ["The post is either too thin, too broad, or too off-topic for a sharp reply.", "Quick Local would rather skip than force a smart-sounding line."],
      ["No category match, no clear topic, no angle.", "Silence is a valid response."],
      ["If the best reply you can imagine is 'interesting,' there is no reply.", "Skip and look for a post with more to work with."],
      ["Nothing here rewards engagement.", "Better posts exist. Find those instead."],
    ])
  );
}

/* ─── Category-specific handlers ─── */

function handleTrustPost(p) {
  const isBluntDistrust = containsAny(p.lower, ["can't trust", "cannot trust", "don't trust", "do not trust", "never trust"]);

  if (isBluntDistrust || (p.shortPost && p.bluntNegative)) {
    return reply("comment", "suggested",
      pick([
        "Comment. The post is blunt, and there is a clean way to sharpen the trust point.",
        "Comment. Short and direct. The reply should match that energy.",
        "Comment. The distrust is the point. Sharpen it, do not lecture about it.",
      ]),
      pick(REASON_POOLS.comment_trust),
      pick(REPLY_POOLS.trust_blunt)
    );
  }

  if (containsAny(p.lower, ["x chat", "fully encrypted", "e2ee", "end-to-end"])) {
    return reply("comment", "suggested",
      pick([
        "Comment. There is a real angle here around adoption versus the feature headline.",
        "Comment. The encryption pitch is the post. The adoption question is the reply.",
        "Comment. Encryption announcements always miss the harder question.",
      ]),
      pick(REASON_POOLS.comment_trust),
      pick(REPLY_POOLS.trust_encryption)
    );
  }

  if (p.scores.trust >= 3 || (p.scores.trust >= 2 && p.mediumPost)) {
    return reply("comment", "optional",
      pick([
        "Comment if you can keep it specific. Multiple trust signals here, but easy to over-explain.",
        "Optional. The trust angle is real, but the risk of sounding preachy is high.",
        "Comment only if your reply stays grounded in how trust architecturally breaks.",
      ]),
      pick(REASON_POOLS.comment_trust),
      pick(REPLY_POOLS.trust_general)
    );
  }

  return reply("skip", "optional",
    pick([
      "Skip by default. There is a real trust angle, but it is easy to over-explain.",
      "Optional. Trust topic detected, but the post may not have enough substance for a sharp reply.",
      "Skip unless you can say something about architecture, defaults, or verification.",
    ]),
    pick(REASON_POOLS.comment_trust),
    pick(REPLY_POOLS.trust_general)
  );
}

function handleLegalPost(p) {
  const isAILegal = containsAny(p.lower, ["openai", "chatgpt", "anthropic", "ai", "artificial intelligence", "google", "deepmind"]);

  if (isAILegal) {
    return reply("comment", "suggested",
      pick([
        "Comment. The post makes a serious claim, and the missing angle is evidence and process.",
        "Comment. AI accountability posts need standards logic, not emotion.",
        "Comment. There is a sharp reply here about precedent and proof.",
      ]),
      pick(REASON_POOLS.comment_legal),
      pick(REPLY_POOLS.legal_ai)
    );
  }

  if (p.scores.legal >= 3 || (p.scores.legal >= 2 && p.longPost)) {
    return reply("comment", "optional",
      pick([
        "Comment if you can frame the actual legal question cleanly.",
        "Optional. Multiple legal signals. Only reply if you can separate the legal from the political.",
        "Comment if you can name the specific mechanism or precedent. Otherwise, skip.",
      ]),
      pick(REASON_POOLS.comment_legal),
      pick(REPLY_POOLS.legal_general)
    );
  }

  return reply("skip", "optional",
    pick([
      "Skip by default. There is a reply angle, but it only works if you keep it on evidence and enforceability.",
      "Optional. Legal posts need process logic, not generic agreement.",
      "Skip unless you can add something about precedent, standard, or timeline.",
    ]),
    pick(REASON_POOLS.comment_legal),
    pick(REPLY_POOLS.legal_general)
  );
}

function handleAIPost(p) {
  const isStrong = p.scores.ai >= 3 || (p.scores.ai >= 2 && (p.isOpinion || p.isAnnouncement || p.isNews));

  if (p.scores.legal > 0) {
    return reply("comment", "suggested",
      pick([
        "Comment. The post sits at the AI and regulation intersection. Real angle here.",
        "Comment. AI governance posts need specificity. There is room for a sharp reply.",
        "Comment. The intersection of AI and accountability is worth engaging.",
      ]),
      pick(REASON_POOLS.comment_legal),
      pick(REPLY_POOLS.legal_ai)
    );
  }

  if (isStrong) {
    return reply("comment", "suggested",
      pick([
        "Comment. Substantial AI post. There is a clear angle about capability versus reliability.",
        "Comment. The AI take is specific enough to reply to without being generic.",
        "Comment. The post says something concrete about AI. The reply can push on what it means in practice.",
      ]),
      pick(REASON_POOLS.comment_general),
      pick(REPLY_POOLS.ai_general)
    );
  }

  return reply("skip", "optional",
    pick([
      "Optional. AI topic detected, but the post may not have enough substance for a sharp reply.",
      "Skip by default. AI posts are easy to reply to generically. Only engage if you can be specific.",
      "Optional. There is an AI angle, but the bar for non-generic AI commentary is high.",
    ]),
    pick(REASON_POOLS.comment_general),
    pick(REPLY_POOLS.ai_general)
  );
}

function handleCryptoPost(p) {
  if (p.scores.market > 0 || p.scores.product > 0) {
    return reply("comment", "suggested",
      pick([
        "Comment. The post mixes crypto and infrastructure. The reply can separate hype from usage.",
        "Comment. Crypto infrastructure post. There is a clean angle about real demand.",
        "Comment. Worth engaging where crypto meets actual adoption.",
      ]),
      pick(REASON_POOLS.comment_product),
      pick(REPLY_POOLS.crypto_general)
    );
  }

  if (p.scores.crypto >= 3 || (p.scores.crypto >= 2 && p.mediumPost)) {
    return reply("comment", "optional",
      pick([
        "Optional. Multiple crypto signals. Only reply if you can be protocol-specific.",
        "Comment if you can say something about the actual mechanism, not just the token.",
        "Optional. Crypto posts need on-chain logic, not community cheerleading.",
      ]),
      pick(REASON_POOLS.comment_general),
      pick(REPLY_POOLS.crypto_general)
    );
  }

  return reply("skip", "optional",
    pick([
      "Skip by default. Generic crypto mention. Only engage with specificity.",
      "Optional. Crypto topic detected, but the substance may be too thin.",
      "Skip unless you have an angle on the protocol, governance, or mechanism.",
    ]),
    pick(REASON_POOLS.comment_general),
    pick(REPLY_POOLS.crypto_general)
  );
}

function handleTechPost(p) {
  if (p.isAnnouncement || p.scores.product > 0) {
    return reply("comment", "suggested",
      pick([
        "Comment. Tech announcement with a clear angle about what it actually changes.",
        "Comment. The startup story is the pitch. The reply can ask about the economics.",
        "Comment. Worth replying if you can separate the vision from the current reality.",
      ]),
      pick(REASON_POOLS.comment_product),
      pick(REPLY_POOLS.tech_startup)
    );
  }

  return reply("skip", "optional",
    pick([
      "Optional. Tech post. Only engage if you can add a perspective the ecosystem is not already circulating.",
      "Skip by default. Tech commentary is crowded. Your angle needs to be specific.",
      "Optional. There is a workable reply, but it needs to go beyond 'great point.'",
    ]),
    pick(REASON_POOLS.comment_general),
    pick(REPLY_POOLS.tech_startup)
  );
}

function handleSocialPost(p) {
  if (p.tone === "aggressive" || p.aggressiveWords >= 2) {
    return noReply(
      pick([
        "Skip. Aggressive social commentary. Engaging here rarely produces useful conversation.",
        "Skip. The tone is too hot. Anything you write will either escalate or get ignored.",
        "Skip. Outrage posts are not debates. They are performances.",
      ]),
      pick([
        ["Aggressive social posts reward engagement, not quality.", "Your reply becomes part of the outrage machine."],
        ["The temperature is too high for a productive exchange.", "Anything measured will get drowned out."],
        ["Hot-button social topics need cool replies. If the post is angry, the thread will be worse.", "Better to find a calmer version of this conversation elsewhere."],
      ])
    );
  }

  return reply("comment", "optional",
    pick([
      "Optional. Social commentary post. There is a reply if you can add structural analysis, not just a take.",
      "Comment if you can name the incentive structure. Otherwise, you are just adding another opinion.",
      "Optional. Worth engaging if your reply explains why, not just what.",
    ]),
    pick(REASON_POOLS.comment_general),
    pick(REPLY_POOLS.social_general)
  );
}

function handleNewsPost(p) {
  if (p.shortPost || (p.urgentPatterns && p.wordCount < 15)) {
    return reply("skip", "optional",
      pick([
        "Optional. Breaking news with little context yet. Wait for details or skip.",
        "Skip by default. First reports are unreliable. Better to wait.",
        "Optional. The news is fresh. The good replies will come after the second paragraph.",
      ]),
      pick([
        ["Breaking news posts get more useful once there is actual substance to react to.", "Replying to the headline alone rarely ages well."],
        ["First-mover commentary on news usually ages badly.", "Wait for details or skip entirely."],
      ]),
      pick(REPLY_POOLS.news_reaction)
    );
  }

  return reply("comment", "optional",
    pick([
      "Optional. News post. There is a reply if you can add second-order analysis.",
      "Comment if you can say what this means for what happens next.",
      "Optional. The news is the post. The useful reply is the implication.",
    ]),
    pick(REASON_POOLS.comment_general),
    pick(REPLY_POOLS.news_reaction)
  );
}

function handleUncategorizedPost(p) {
  /* Post has substance but no strong category match. Use tone and structure. */
  if (p.isOpinion) {
    return reply("skip", "optional",
      pick([
        "Optional. The post states an opinion. Only reply if you can steel-man and then counter.",
        "Skip by default. Opinions are easy to engage with badly. Hard to engage with well.",
        "Optional. There is a reply here if your angle survives the strongest counterargument.",
      ]),
      pick(REASON_POOLS.comment_general),
      pick(REPLY_POOLS.opinion_counter)
    );
  }

  if (p.isQuestion) {
    return reply("skip", "optional",
      pick([
        "Optional. The post asks something. Only answer if your take would surprise.",
        "Skip by default. Questions attract replies, but quality answers are rare. Be one or skip.",
      ]),
      pick(REASON_POOLS.comment_general),
      pick(REPLY_POOLS.question_response)
    );
  }

  if (p.isComparison) {
    return reply("comment", "optional",
      pick([
        "Optional. Comparison post. There is a reply if you can add a dimension the post is missing.",
        "Comment if you can name the variable the comparison is ignoring.",
      ]),
      pick(REASON_POOLS.comment_general),
      pick(REPLY_POOLS.opinion_counter)
    );
  }

  if (p.tone === "aggressive") {
    return noReply(
      pick([
        "Skip. The post is heated. Replying will not lower the temperature.",
        "Skip. Aggressive tone. Engagement here feeds the fire.",
      ]),
      pick([
        ["Angry posts do not become calm conversations after a reply.", "Your measured take will be treated as a target."],
        ["The temperature is too high. Nothing you write here improves the thread.", "Wait for a cooler version of this topic."],
      ])
    );
  }

  /* Truly generic fallback for uncategorized posts with substance */
  return reply("skip", "optional",
    pick([
      "Optional. The post has substance but no obvious sharp angle. Proceed only with specificity.",
      "Skip by default. There might be a reply here, but it would take more effort than most generic posts deserve.",
      "Optional. Quick Local sees content but no clear category. Only engage if something specific jumps out.",
    ]),
    pick(REASON_POOLS.comment_general),
    pick(REPLY_POOLS.opinion_counter)
  );
}

/* ─── Mode switching ─── */

function setMode(mode, options = {}) {
  state.mode = [MODE_FOCUSED, MODE_CLAUDE, MODE_OLLAMA].includes(mode) ? mode : MODE_LOCAL;
  updateModeUi();
  if (options.persist !== false) saveForm();
  if (options.reset !== false && !state.busy) {
    renderIdle();
    checkHealth();
  }
}

/* ─── Main analysis flow ─── */

async function analyzeCurrentPost() {
  const postLink = $.postLink.value.trim();
  const normalizedPostLink = normalizeLink(postLink);
  const staleTextFromOldLink =
    normalizedPostLink &&
    looksLikeStatusLink(normalizedPostLink) &&
    normalizedPostLink !== state.lastImportedLink;
  const postText = staleTextFromOldLink ? "" : normalizeWhitespace($.postText.value);

  if (!postLink && !postText) {
    setImportStatus("error", "Paste a public X link or some post text first.");
    renderError("There is nothing to analyze yet.");
    return;
  }

  setBusy(true);
  renderLoading();
  setImportStatus("loading", `Running the ${modeLabel()} pass on this post.`);

  try {
    if (state.mode === MODE_LOCAL) {
      const resolved = await resolveImportedInput(postLink, postText);
      if (!resolved.resolvedText) throw new Error("Could not import that post. Paste the text manually and try again.");
      renderResult({
        imported: resolved.imported,
        resolvedText: resolved.resolvedText,
        resolvedAuthorHandle: resolved.authorHandle,
        result: runLocalReasoner(resolved.resolvedText)
      });
      saveForm();
      return;
    }

    if (state.mode === MODE_OLLAMA) {
      if (!state.ollamaAvailable) {
        renderMissingOllama();
        saveForm();
        return;
      }
      const payload = await postJson("/api/analyze", {
        mode: "ollama", postLink, postText,
        ollamaModel: $.ollamaModel.value.trim()
      });
      renderResult(payload);
      saveForm();
      return;
    }

    if (state.mode === MODE_CLAUDE) {
      let claudeApiKey = getStoredClaudeKey();
      if ($.claudeApiKey.value.trim()) {
        claudeApiKey = $.claudeApiKey.value.trim();
        saveClaudeKey(claudeApiKey);
      }
      if (!state.serverHasClaudeKey && !claudeApiKey) {
        let imported = null;
        if (postLink && !postText) {
          try { imported = await postJson("/api/import", { postLink }); } catch {}
        }
        renderMissingClaudeKey(imported);
        saveForm();
        return;
      }
      const payload = await postJson("/api/analyze", { mode: "claude", postLink, postText, claudeApiKey });
      renderResult(payload);
      saveForm();
      return;
    }

    /* Focused AI (default) */
    let apiKey = getStoredApiKey();
    if ($.apiKey.value.trim()) {
      apiKey = $.apiKey.value.trim();
      saveApiKey(apiKey);
    }
    if (!state.serverHasKey && !apiKey) {
      let imported = null;
      if (postLink && !postText) {
        try { imported = await postJson("/api/import", { postLink }); } catch {}
      }
      renderMissingKey(imported);
      saveForm();
      return;
    }
    const payload = await postJson("/api/analyze", { mode: "focused", postLink, postText, apiKey });
    renderResult(payload);
    saveForm();
  } catch (error) {
    const msg = error.name === "AbortError"
      ? "The reasoning request took too long. Try again in a moment."
      : error.message || "Something went wrong during analysis.";
    setImportStatus("error", msg);
    renderError(msg);
  } finally {
    setBusy(false);
  }
}

/* ─── Clipboard ─── */

async function copyReply() {
  if (!state.lastReply) return;
  const label = $.copyBtn.querySelector(".copy-label") || $.copyBtn;
  try {
    await navigator.clipboard.writeText(state.lastReply);
    label.textContent = "Copied!";
  } catch {
    label.textContent = "Failed";
  }
  window.setTimeout(() => { label.textContent = "Copy"; }, 1400);
}

/* ─── Clear ─── */

function clearForm() {
  if (state.mode === MODE_FOCUSED) $.apiKey.value = getStoredApiKey();
  if (state.mode === MODE_CLAUDE) $.claudeApiKey.value = getStoredClaudeKey();
  $.postLink.value = "";
  $.postText.value = "";
  state.lastImportedLink = "";
  state.lastSeenLink = "";
  saveForm();
  renderIdle();
  checkHealth();
}

/* ─── Event binding ─── */

function bindEvents() {
  $.modeLocalBtn.addEventListener("click", () => setMode(MODE_LOCAL));
  $.modeFocusedBtn.addEventListener("click", () => setMode(MODE_FOCUSED));
  $.modeClaudeBtn.addEventListener("click", () => setMode(MODE_CLAUDE));
  $.modeOllamaBtn.addEventListener("click", () => setMode(MODE_OLLAMA));
  $.analyzeBtn.addEventListener("click", analyzeCurrentPost);
  $.clearBtn.addEventListener("click", clearForm);
  $.copyBtn.addEventListener("click", copyReply);

  $.apiKey.addEventListener("input", () => {
    saveApiKey($.apiKey.value.trim());
    saveForm();
  });
  $.claudeApiKey.addEventListener("input", () => {
    saveClaudeKey($.claudeApiKey.value.trim());
    saveForm();
  });
  $.ollamaModel.addEventListener("input", saveForm);

  $.postLink.addEventListener("input", () => {
    const nextLink = normalizeLink($.postLink.value);
    const previousLink = state.lastSeenLink;
    const isNewResolvedStatusLink =
      looksLikeStatusLink(nextLink) &&
      nextLink !== previousLink &&
      nextLink !== state.lastImportedLink;

    state.lastSeenLink = nextLink;

    if (isNewResolvedStatusLink) {
      $.postText.value = "";
      renderIdle();
      setImportStatus("", "New X link detected. Old post text cleared. Click Analyze to import the new post.");
    }

    saveForm();
  });

  $.postText.addEventListener("input", saveForm);

  /* Keyboard shortcut: Ctrl+Enter or Cmd+Enter to analyze */
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !state.busy) {
      e.preventDefault();
      analyzeCurrentPost();
    }
  });
}

/* ─── Init ─── */

restoreForm();
bindEvents();
renderIdle();
checkHealth();
