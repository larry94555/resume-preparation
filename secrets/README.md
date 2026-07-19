# secrets/

Model configuration (and any API keys) live here so they never get committed.

- **`secrets.env.example`** — a committed template. Copy it to **`secrets.env`**
  and fill in your values.
- **`secrets.env`** — your real file. It is **gitignored** (everything in this
  folder except `*.example` and `README.md` is ignored).

The loader `utils/load-secrets.mjs` reads `secrets/secrets.env` and copies the
values into the process environment (without overriding anything already set in
your shell). The CLIs load it automatically; the web app loads it on startup.

Choose one setup in `secrets.env`:

- **Local model** — `LLM_BASE_URL=http://localhost:11434/v1` (Ollama) and
  `LLM_MODEL`.
- **Hosted llama server over the web** — `LLAMA_SERVER_URL=https://…/v1` and
  `API_KEY=…` (these friendly names are mapped to `LLM_BASE_URL` / `LLM_API_KEY`).

Check what would load (values masked):

```bash
npm run secrets:check
```
