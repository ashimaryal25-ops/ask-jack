# Jack — ICL Lab Assistant

> A production RAG assistant that guides complete beginners through makerspace equipment, step by step — even when no instructor is around.

![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=nodedotjs&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=flat&logo=openai&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase_pgvector-3FCF8E?style=flat&logo=supabase&logoColor=white)
![Railway](https://img.shields.io/badge/Deployed_on_Railway-0B0D0E?style=flat&logo=railway&logoColor=white)
![JavaScript](https://img.shields.io/badge/Vanilla_JS-F7DF1E?style=flat&logo=javascript&logoColor=black)

### 🔗 Live: [iclassistant.up.railway.app](https://iclassistant.up.railway.app)

**Jack** is an AI assistant built for the Innovation & Creativity Lab (ICL) at Gettysburg College. Students ask a question in plain English — *"how do I 3D print a phone stand?"* — and Jack walks them through the real lab procedure, one step at a time, with inline photos and videos of the actual equipment.

It is **not a ChatGPT wrapper.** Every answer is grounded in a custom knowledge base of ICL-specific documentation through a real Retrieval-Augmented Generation (RAG) pipeline — so Jack answers from the lab's actual procedures and says "I don't have that yet" instead of hallucinating when it doesn't know.

It is named after Clarence B. "Jack" Rogers Jr. (Class of 1951), the Gettysburg College alumnus whose philanthropy made the lab possible.

---

## Features

- **Grounded RAG answers** — responses come only from the ICL knowledge base, not the model's training data
- **Two guide modes** — a full walkthrough all at once, or one step at a time at the student's pace
- **Inline media** — videos and photos of the real lab equipment render directly inside the steps
- **Conversation memory** — students can ask follow-up questions mid-process and Jack stays in context
- **Voice input** — ask by speaking, for kiosk and touchscreen use
- **Save as PDF** — export a full guide as a printable sheet to take to the machine
- **Intent classification** — detects when a vague request should branch into a guided walkthrough
- **Feedback logging** — 👍/👎 on each answer, stored for measuring real-world helpfulness
- **Hardened endpoints** — per-IP rate limiting, request-size caps, and path-traversal protection
- **Streaming responses** — answers stream in word-by-word over Server-Sent Events

---

## How it works

Jack runs a two-phase RAG pipeline.

**Phase 1 — Ingestion** (run once when docs change):

```mermaid
flowchart LR
  A[Markdown docs] --> B[Chunk into ~2000-char pieces]
  B --> C[Embed each chunk<br/>text-embedding-3-small]
  C --> D[(Supabase pgvector)]
```

**Phase 2 — Query** (every student message):

```mermaid
flowchart LR
  A[Student question] --> B[Embed the question]
  B --> C[pgvector cosine search]
  C --> D[Top relevant chunks]
  D --> E[Inject into system prompt]
  E --> F[gpt-4o-mini · streaming]
  F --> G[SSE → word-by-word in the browser]
```

The knowledge base is plain Markdown, so adding a new machine is just writing a new doc and re-running ingestion — no code changes. Media is embedded with simple `[VIDEO: url | title]` and `[IMAGE: url | caption]` tags that the frontend renders into players and images.

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Backend | Node.js (raw `http` module, no framework) |
| LLM | OpenAI `gpt-4o-mini` |
| Embeddings | OpenAI `text-embedding-3-small` (1536-dim) |
| Vector store | Supabase Postgres + `pgvector` (cosine similarity) |
| Frontend | Vanilla JS, custom CSS, Server-Sent Events |
| Hosting | Railway (persistent server, no cold starts) |

---

## Roadmap

- Expand the knowledge base to more machines (embroidery, laser cutter, vinyl cutter)
- Real lab photos and instructional videos for every step
- A source side-panel so students can open the original document beside a step
- Floating desktop widget + kiosk mode for the lab computers
- Photo upload so students can show Jack a problem and get a diagnosis

---

## About

Built by Ashim Aryal for the Rogers Center for Innovation & Creativity at Gettysburg College.
