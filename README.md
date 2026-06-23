# 🍼 MilkDrop Planner — Skill

## Motivation

Managing a breast milk stash is harder than it looks. Safe storage windows differ between ambient temperature, fridge, standard freezer, and deep freezer. Pumping parents have to track dozens of bags across multiple locations, remember which is oldest, and make sure nothing is used past its safe window.

This tool puts CDC & AAP guidelines into an AI agent that can check any single bag for expiry, audit an entire stash with urgency levels, and generate a 7-day FIFO feeding plan that always reaches for the oldest milk first.

---

## 👨‍👩‍👧 Not a developer?

If you just want to check your breast milk stash — no setup, no AI subscription, no server — use the companion web app instead:

**[🍼 MilkDrop Planner](https://drop.kareninatech.com)** — open the link, fill in your bags, and get instant expiry dates and handling instructions. Free, open source, runs entirely in the browser.

---

## Concept

An **agent-agnostic HTTP Skill Server**. Any AI framework (LangChain, Vercel AI SDK, AutoGen, or a custom agent) can connect to it via standard HTTP and JSON Schema — no SDK, no API key required on the server side.

→ **To connect your agent, see [SKILL.md](./SKILL.md).**

---

## 🔌 Connect your agent

There is **no SDK and no vendor lock-in**. The entire contract is three HTTP endpoints plus standard JSON Schema, so any framework can drive it:

- `GET /api/prompt` → returns `{ prompt }`. Load it as your system prompt.
- `GET /api/tools` → returns `{ tools: [...] }`. Each entry has a logical `name` (e.g. `checkBagSafety`), the `endpoint` to POST to (e.g. `/api/tools/check-bag-safety`), a `description`, and a JSON Schema `parameters` object. Note the `name` and the `endpoint` differ — register the schema under `name`, but send the request to `endpoint`.
- `POST <endpoint>` → call the tool with a JSON body matching its `parameters` schema.

The base URL is `http://localhost:3000` (or whatever `PORT` you set). The examples below all do the same thing — fetch the tools and wire them in — in three different stacks.

<details>
<summary><strong>Plain <code>curl</code> — any language</strong></summary>

```bash
# 1. Load the system prompt
curl -s http://localhost:3000/api/prompt

# 2. Discover the tools (name, endpoint, and JSON Schema for each)
curl -s http://localhost:3000/api/tools

# 3. Call a tool — here, check a single fridge bag
curl -s -X POST http://localhost:3000/api/tools/check-bag-safety \
  -H 'Content-Type: application/json' \
  -d '{
    "pumpDate": "2026-06-20",
    "volumeInOz": 4,
    "location": "fridge"
  }'
```

</details>

<details>
<summary><strong>LangChain (Python)</strong></summary>

```python
import requests
from langchain_core.tools import StructuredTool

BASE_URL = "http://localhost:3000"

system_prompt = requests.get(f"{BASE_URL}/api/prompt").json()["prompt"]
tool_defs = requests.get(f"{BASE_URL}/api/tools").json()["tools"]

def make_tool(defn):
    def _call(**kwargs):
        res = requests.post(f"{BASE_URL}{defn['endpoint']}", json=kwargs)
        return res.json()

    return StructuredTool.from_function(
        func=_call,
        name=defn["name"],
        description=defn["description"],
        args_schema=defn["parameters"],
    )

tools = [make_tool(d) for d in tool_defs]
# Pass `tools` and `system_prompt` to your agent / LLM as usual.
```

</details>

<details>
<summary><strong>Vercel AI SDK (TypeScript)</strong></summary>

```ts
import { generateText, tool, jsonSchema } from 'ai';
import { openai } from '@ai-sdk/openai';

const BASE_URL = 'http://localhost:3000';

const { prompt: system } = await fetch(`${BASE_URL}/api/prompt`).then((r) => r.json());
const { tools: defs } = await fetch(`${BASE_URL}/api/tools`).then((r) => r.json());

const tools = Object.fromEntries(
  defs.map((d: any) => [
    d.name,
    tool({
      description: d.description,
      parameters: jsonSchema(d.parameters),
      execute: async (args) => {
        const res = await fetch(`${BASE_URL}${d.endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(args),
        });
        return res.json();
      },
    }),
  ]),
);

await generateText({ model: openai('gpt-4o'), system, tools, prompt: 'Check my breast milk stash.' });
```

</details>

These are just three examples — **any** framework that speaks HTTP and JSON Schema works the same way. For the full step-by-step protocol (server startup, the onboarding flow, and tool call details), see **[SKILL.md](./SKILL.md)**.

---

## ✨ Key Features

- **Agent-agnostic:** Any framework that can read JSON Schema and make HTTP calls works out of the box.
- **Four storage locations:** Handles `ambient` (counter), `fridge`, `freezer`, and `ultra-freezer` — each with its own CDC & AAP safe window.
- **Single-bag expiry check:** Returns exact expiry date, days remaining, and location-specific handling and warming instructions.
- **Full stash audit:** Returns urgency levels for every bag (`expired`, `expiring` within 24 h, `soon` within 72 h, or `safe`) plus a summary count.
- **7-day FIFO schedule:** Plans the week using oldest milk first to minimise waste and reports any daily shortfall.

---

## 🛠️ Available scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start the server in watch mode |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled build |
| `npm test` | Run all tests |
| `npm run types` | Type-check without emitting |

---

## ⚠️ Safety notice

- This tool does **not** replace professional medical or lactation advice.
- Always trust your senses — if the milk smells or looks off, discard it regardless of what the app says.
- Storage window calculations follow the **conservative end** of CDC & AAP recommended ranges.
- When in doubt, throw it out.
