# Reply Studio for X

A local desktop app that helps you decide whether an X post is worth replying to and drafts one sharp reply if it is.

Paste a public X link or raw post text. The app imports the post, reasons through what it is actually saying, suggests one reply, and gives you a clear Comment or Skip verdict.

## Features

- Import a public X post from a link or paste raw text
- Get a single reply recommendation instead of a pile of variations
- Choose between Quick Local, Focused AI, Claude, and Ollama modes
- Keep the app local-only on `127.0.0.1`

## Requirements

- Node.js 18 or newer
- No npm dependencies are required
- Optional API keys if you want hosted model modes
- Optional Ollama runtime if you want local model mode

## Quick Start

### Windows launcher

Double-click `launch.bat`.

The launcher finds a free port between `8785` and `8795`, starts the local server, waits for `/api/health`, and opens the app in your browser automatically.

### Manual start

```bash
node server.js
```

The manual server defaults to `http://127.0.0.1:8765`.

You can also choose a port explicitly:

```bash
node server.js 8785
```

## Optional environment variables

Copy `.env.example` to `.env` if you want server-side defaults.

```bash
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
PORT=8765
X_REPLY_MODEL=gpt-5
X_REPLY_REASONING_EFFORT=high
CLAUDE_MODEL=claude-sonnet-4-5
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=
```

## Modes

| Mode | What it uses | API key needed? |
| --- | --- | --- |
| Quick Local | Built-in keyword and tone analysis | No |
| Focused AI | OpenAI two-pass reasoning | Yes |
| Claude | Anthropic two-pass reasoning | Yes |
| Ollama | Local Ollama runtime | No, but Ollama must be running |

## Project Files

- `index.html` - single-page UI
- `styles.css` - app styling
- `app.js` - frontend logic and local reasoning engine
- `server.js` - local Node.js server and API integrations
- `launch.bat` - Windows launcher

## Privacy and safety

- This is a manual copilot, not an auto-reply bot
- The server binds to `127.0.0.1` only
- Browser-entered API keys are stored in localStorage in that browser profile
- Server-side API keys can be supplied through environment variables instead
- Public post import uses the X oEmbed endpoint and only works for public posts

## Development checks

```bash
npm run check
```

## License

MIT. See `LICENSE`.
