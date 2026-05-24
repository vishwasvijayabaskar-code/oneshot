#!/usr/bin/env node

const https = require("https");
const http = require("http");
const { readFileSync, existsSync } = require("fs");
const { homedir } = require("os");
const { join } = require("path");

// ─── Config ────────────────────────────────────────────────────────────────
const CONFIG_PATH = join(homedir(), ".oneshotrc.json");

const PROVIDERS = {
  openai: {
    name: "OpenAI",
    envKey: "OPENAI_API_KEY",
    defaultModel: "gpt-4o",
    endpoint: "https://api.openai.com/v1/chat/completions",
    buildBody: (model, prompt, system) => ({
      model,
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        { role: "user", content: prompt },
      ],
      stream: true,
    }),
    parseChunk: (line) => {
      if (line === "data: [DONE]") return null;
      if (!line.startsWith("data: ")) return "";
      try {
        const json = JSON.parse(line.slice(6));
        return json.choices?.[0]?.delta?.content || "";
      } catch {
        return "";
      }
    },
    headers: (key) => ({
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    }),
  },
  anthropic: {
    name: "Anthropic",
    envKey: "ANTHROPIC_API_KEY",
    defaultModel: "claude-sonnet-4-20250514",
    endpoint: "https://api.anthropic.com/v1/messages",
    buildBody: (model, prompt, system) => ({
      model,
      max_tokens: 4096,
      ...(system && { system }),
      messages: [{ role: "user", content: prompt }],
      stream: true,
    }),
    parseChunk: (line) => {
      if (!line.startsWith("data: ")) return "";
      try {
        const json = JSON.parse(line.slice(6));
        if (json.type === "content_block_delta") {
          return json.delta?.text || "";
        }
        return "";
      } catch {
        return "";
      }
    },
    headers: (key) => ({
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    }),
  },
  gemini: {
    name: "Google Gemini",
    envKey: "GEMINI_API_KEY",
    defaultModel: "gemini-2.5-flash",
    endpoint: (model, key) =>
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${key}`,
    buildBody: (model, prompt, system) => ({
      contents: [{ parts: [{ text: prompt }] }],
      ...(system && {
        systemInstruction: { parts: [{ text: system }] },
      }),
    }),
    parseChunk: (line) => {
      if (!line.startsWith("data: ")) return "";
      try {
        const json = JSON.parse(line.slice(6));
        return json.candidates?.[0]?.content?.parts?.[0]?.text || "";
      } catch {
        return "";
      }
    },
    headers: () => ({
      "Content-Type": "application/json",
    }),
  },
  ollama: {
    name: "Ollama (local)",
    envKey: null,
    defaultModel: "llama3.2",
    endpoint: "http://localhost:11434/api/chat",
    buildBody: (model, prompt, system) => ({
      model,
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        { role: "user", content: prompt },
      ],
      stream: true,
    }),
    parseChunk: (line) => {
      try {
        const json = JSON.parse(line);
        return json.message?.content || "";
      } catch {
        return "";
      }
    },
    headers: () => ({
      "Content-Type": "application/json",
    }),
  },
};

// Model aliases for convenience
const MODEL_ALIASES = {
  gpt4: { provider: "openai", model: "gpt-4o" },
  "gpt4o": { provider: "openai", model: "gpt-4o" },
  "gpt4o-mini": { provider: "openai", model: "gpt-4o-mini" },
  "o3-mini": { provider: "openai", model: "o3-mini" },
  "o4-mini": { provider: "openai", model: "o4-mini" },
  claude: { provider: "anthropic", model: "claude-sonnet-4-20250514" },
  "claude-opus": { provider: "anthropic", model: "claude-opus-4-20250514" },
  "claude-haiku": { provider: "anthropic", model: "claude-haiku-4-20250414" },
  sonnet: { provider: "anthropic", model: "claude-sonnet-4-20250514" },
  opus: { provider: "anthropic", model: "claude-opus-4-20250514" },
  haiku: { provider: "anthropic", model: "claude-haiku-4-20250414" },
  gemini: { provider: "gemini", model: "gemini-2.5-flash" },
  "gemini-pro": { provider: "gemini", model: "gemini-2.5-pro" },
  flash: { provider: "gemini", model: "gemini-2.5-flash" },
  llama: { provider: "ollama", model: "llama3.2" },
  mistral: { provider: "ollama", model: "mistral" },
  phi: { provider: "ollama", model: "phi3" },
};

// ─── Helpers ───────────────────────────────────────────────────────────────
function loadConfig() {
  if (existsSync(CONFIG_PATH)) {
    try {
      return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
    } catch {
      return {};
    }
  }
  return {};
}

function resolveModel(modelArg) {
  if (!modelArg) {
    const config = loadConfig();
    const defaultProvider = config.defaultProvider || "openai";
    return {
      provider: defaultProvider,
      model: PROVIDERS[defaultProvider]?.defaultModel,
    };
  }

  // Check aliases first
  const lower = modelArg.toLowerCase();
  if (MODEL_ALIASES[lower]) return MODEL_ALIASES[lower];

  // Check if it's provider:model format
  if (modelArg.includes(":")) {
    const [provider, model] = modelArg.split(":", 2);
    if (PROVIDERS[provider]) {
      return { provider, model };
    }
  }

  // Check if it's a known provider name
  if (PROVIDERS[lower]) {
    return { provider: lower, model: PROVIDERS[lower].defaultModel };
  }

  // Default: try to guess provider from model name
  if (lower.includes("gpt") || lower.includes("o3") || lower.includes("o1"))
    return { provider: "openai", model: modelArg };
  if (lower.includes("claude") || lower.includes("sonnet") || lower.includes("opus") || lower.includes("haiku"))
    return { provider: "anthropic", model: modelArg };
  if (lower.includes("gemini"))
    return { provider: "gemini", model: modelArg };

  return { provider: "ollama", model: modelArg };
}

function getApiKey(provider) {
  const config = loadConfig();
  const envKey = PROVIDERS[provider].envKey;
  if (!envKey) return null; // Ollama doesn't need a key
  return process.env[envKey] || config[envKey] || null;
}

function streamRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.request(url, options, (res) => {
      if (res.statusCode >= 400) {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const err = JSON.parse(data);
            reject(
              new Error(
                err.error?.message || err.message || `HTTP ${res.statusCode}`
              )
            );
          } catch {
            reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
          }
        });
        return;
      }
      resolve(res);
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);

  // Handle flags
  if (args.includes("--version") || args.includes("-v")) {
    const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8"));
    console.log(`oneshot v${pkg.version}`);
    process.exit(0);
  }

  if (args.includes("--help") || args.includes("-h") || args.length === 0) {
    console.log(`
  oneshot - One command. Any LLM. Get answers instantly.

  USAGE:
    oneshot "your question here"
    oneshot --model claude "explain async/await"
    oneshot --model gemini "write a haiku about code"
    echo "error log" | oneshot "explain this error"

  OPTIONS:
    --model, -m    Model or alias (default: gpt4o)
    --system, -s   System prompt
    --list, -l     List available models
    --help, -h     Show this help

  MODEL ALIASES:
    gpt4, gpt4o, gpt4o-mini, o3-mini
    claude, sonnet, opus, haiku
    gemini, gemini-pro, flash
    llama, mistral, phi (local via Ollama)

  CUSTOM MODELS:
    oneshot --model openai:gpt-4-turbo "question"
    oneshot --model ollama:codellama "question"

  CONFIG:
    Create ~/.oneshotrc.json:
    {
      "OPENAI_API_KEY": "sk-...",
      "ANTHROPIC_API_KEY": "sk-ant-...",
      "GEMINI_API_KEY": "...",
      "defaultProvider": "anthropic"
    }

    Or use environment variables directly.
`);
    process.exit(0);
  }

  if (args.includes("--list") || args.includes("-l")) {
    console.log("\n  Available models:\n");
    for (const [alias, info] of Object.entries(MODEL_ALIASES)) {
      const key = getApiKey(info.provider);
      const status =
        info.provider === "ollama" ? "🟢 local" : key ? "🟢 key set" : "🔴 no key";
      console.log(
        `    ${alias.padEnd(15)} → ${info.model.padEnd(35)} [${status}]`
      );
    }
    console.log();
    process.exit(0);
  }

  // Parse arguments
  let modelArg = null;
  let systemPrompt = null;
  const promptParts = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--model" || args[i] === "-m") {
      modelArg = args[++i];
    } else if (args[i] === "--system" || args[i] === "-s") {
      systemPrompt = args[++i];
    } else {
      promptParts.push(args[i]);
    }
  }

  let prompt = promptParts.join(" ");

  // Check for piped input
  if (!process.stdin.isTTY) {
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    const piped = Buffer.concat(chunks).toString().trim();
    if (piped) {
      prompt = prompt ? `${prompt}\n\n${piped}` : piped;
    }
  }

  if (!prompt) {
    console.error("Error: No prompt provided. Use --help for usage.");
    process.exit(1);
  }

  const { provider, model } = resolveModel(modelArg);
  const providerConfig = PROVIDERS[provider];

  if (!providerConfig) {
    console.error(`Error: Unknown provider "${provider}"`);
    process.exit(1);
  }

  const apiKey = getApiKey(provider);
  if (providerConfig.envKey && !apiKey) {
    console.error(
      `Error: ${providerConfig.envKey} not set. Set it in environment or ~/.oneshotrc.json`
    );
    process.exit(1);
  }

  const body = JSON.stringify(
    providerConfig.buildBody(model, prompt, systemPrompt)
  );

  const endpoint =
    typeof providerConfig.endpoint === "function"
      ? providerConfig.endpoint(model, apiKey)
      : providerConfig.endpoint;

  const url = new URL(endpoint);
  const headers = providerConfig.headers(apiKey);

  process.stderr.write(`\x1b[2m${providerConfig.name} · ${model}\x1b[0m\n`);

  try {
    const res = await streamRequest(
      endpoint,
      {
        method: "POST",
        hostname: url.hostname,
        path: url.pathname + url.search,
        port: url.port,
        headers,
      },
      body
    );

    let buffer = "";
    for await (const chunk of res) {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const text = providerConfig.parseChunk(trimmed);
        if (text === null) break;
        if (text) process.stdout.write(text);
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      const text = providerConfig.parseChunk(buffer.trim());
      if (text) process.stdout.write(text);
    }

    process.stdout.write("\n");
  } catch (err) {
    console.error(`\nError: ${err.message}`);
    process.exit(1);
  }
}

main();
