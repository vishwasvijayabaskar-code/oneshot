# oneshot 🎯

> One command. Any LLM. Get answers instantly from your terminal.

```bash
oneshot "explain kubernetes pods in one sentence"
# → A Pod is the smallest deployable unit in Kubernetes, wrapping one or more containers that share storage and network.
```

**Zero dependencies. Works with OpenAI, Anthropic, Google Gemini, and Ollama. Streaming by default.**

## Install

```bash
# npm
npm install -g oneshot-ai

# Or just clone and link
git clone https://github.com/vishwasvijayabaskar-code/oneshot.git
cd oneshot && npm link
```

## Quick Start

```bash
# Set your API key
export OPENAI_API_KEY="sk-..."

# Ask anything
oneshot "what is a closure in JavaScript?"

# Use a different model
oneshot -m claude "rewrite this function to be more readable"
oneshot -m gemini "write a haiku about debugging"
oneshot -m llama "explain docker compose"  # local via Ollama

# Pipe input
cat error.log | oneshot "explain this error"
git diff | oneshot "write a commit message for this"
curl api.example.com/users | oneshot "summarize this JSON"
```

## Model Aliases

No need to memorize model IDs. Use short aliases:

| Alias | Model | Provider |
|-------|-------|----------|
| `gpt4` / `gpt4o` | gpt-4o | OpenAI |
| `gpt4o-mini` | gpt-4o-mini | OpenAI |
| `o3-mini` | o3-mini | OpenAI |
| `o4-mini` | o4-mini | OpenAI |
| `claude` / `sonnet` | claude-sonnet-4 | Anthropic |
| `opus` | claude-opus-4 | Anthropic |
| `haiku` | claude-haiku-4 | Anthropic |
| `gemini` / `flash` | gemini-2.5-flash | Google |
| `gemini-pro` | gemini-2.5-pro | Google |
| `llama` | llama3.2 | Ollama |
| `mistral` | mistral | Ollama |
| `phi` | phi3 | Ollama |

Custom models: `oneshot -m openai:gpt-4-turbo "question"`

## Configuration

Create `~/.oneshotrc.json`:

```json
{
  "OPENAI_API_KEY": "sk-...",
  "ANTHROPIC_API_KEY": "sk-ant-...",
  "GEMINI_API_KEY": "...",
  "defaultProvider": "anthropic"
}
```

Or use environment variables — they take priority.

## Features

- **Streaming** — responses appear word by word
- **Pipe-friendly** — `cat file | oneshot "explain"` works out of the box
- **Zero dependencies** — just Node.js 18+, no `npm install` bloat
- **Multi-provider** — OpenAI, Anthropic, Gemini, Ollama in one tool
- **Smart model detection** — `oneshot -m claude` just works
- **System prompts** — `oneshot -s "you are a senior engineer" "review this code"`

## Examples

```bash
# Explain an error
node app.js 2>&1 | oneshot "what went wrong?"

# Generate code
oneshot -m claude "python script to resize all images in a folder to 800px wide"

# Quick translations
oneshot "translate to Spanish: Where is the nearest coffee shop?"

# System prompt for persona
oneshot -s "respond like a pirate" "explain recursion"

# List available models and their status
oneshot --list
```

## Why oneshot?

| Feature | oneshot | shell-gpt | aider |
|---------|---------|-----------|-------|
| Zero deps | ✅ | ❌ | ❌ |
| Multi-provider | ✅ 4 providers | ⚠️ OpenAI-first | ⚠️ Limited |
| Streaming | ✅ | ✅ | ✅ |
| Pipe support | ✅ | ✅ | ❌ |
| Install time | <1s | ~30s | ~60s |
| Lines of code | ~300 | ~5000 | ~50000 |

## Also By Me

- [gitgenius](https://github.com/vishwasvijayabaskar-code/gitgenius) — AI-powered git commits, PR descriptions, changelogs
- [aiterm](https://github.com/vishwasvijayabaskar-code/aiterm) — AI terminal assistant, auto-explain errors
- [promptbattle](https://github.com/vishwasvijayabaskar-code/promptbattle) — Compare LLM responses side-by-side
- [awesome-ai-agents](https://github.com/vishwasvijayabaskar-code/awesome-ai-agents) — Curated list of AI agent frameworks
- [ai-system-design-primer](https://github.com/vishwasvijayabaskar-code/ai-system-design-primer) — System design for AI systems

## License

MIT
