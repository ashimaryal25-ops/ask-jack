require("dotenv").config();
const http = require("http");
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const OpenAI = require("openai");

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

const requiredEnv = {
  OPENAI_API_KEY: Boolean(process.env.OPENAI_API_KEY),
  SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
  NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
  SUPABASE_SECRET_KEY: Boolean(process.env.SUPABASE_SECRET_KEY),
  SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  SUPABASE_KEY: Boolean(process.env.SUPABASE_KEY),
};
console.log("Environment check:", requiredEnv);

if (!supabaseUrl) {
  throw new Error("Missing Supabase URL. Set SUPABASE_URL in Railway service variables.");
}
if (!supabaseKey) {
  throw new Error("Missing Supabase service key. Set SUPABASE_SECRET_KEY in Railway service variables.");
}
if (!process.env.OPENAI_API_KEY) {
  throw new Error("Missing OpenAI API key. Set OPENAI_API_KEY in Railway service variables.");
}

const supabase = createClient(
  supabaseUrl,
  supabaseKey
);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Simple in-memory rate limiter — 30 requests per 5 minutes per IP
const rateMap = new Map();
function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateMap.get(ip) || { count: 0, resetAt: now + 5 * 60 * 1000 };
  if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + 5 * 60 * 1000; }
  entry.count++;
  rateMap.set(ip, entry);
  return entry.count > 30;
}

async function embedQuery(text) {
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return res.data[0].embedding;
}

// LLM query expansion (improvements.md §6) — rewrites the recent conversation into a
// single focused retrieval query so search covers what the student actually needs next,
// instead of embedding the raw message. Off by default; enable with QUERY_EXPANSION=1.
// Falls back to the passed-in query on any failure or empty output — no regression when off.
const QUERY_EXPANSION = process.env.QUERY_EXPANSION === "1";

async function expandQuery(messages, fallback) {
  if (!QUERY_EXPANSION) return fallback;
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You rewrite a makerspace student's request into ONE short search query for a " +
            "documentation database. Name the machine, the specific step or action, and any " +
            "tool or material involved. Use the conversation only for context — describe just " +
            "what the student needs next. Output only the query, no quotes or explanation.",
        },
        ...messages.slice(-6),
      ],
      max_tokens: 60,
      temperature: 0,
    });
    const expanded = res.choices[0]?.message?.content?.trim();
    if (expanded && expanded !== fallback) {
      console.log(`Query expansion: "${fallback}" -> "${expanded}"`);
    }
    return expanded || fallback;
  } catch (err) {
    console.error("Query expansion failed, using raw query:", err.code || err.message);
    return fallback;
  }
}

async function retrieveChunks(embedding, section = "general") {
  const { data, error } = await supabase.rpc("match_knowledge_chunks", {
    query_embedding: embedding,
    match_count: 20,
  });
  if (error) throw new Error(error.message);

  if (section === "3d-printing") {
    // Strict: only 3D printing docs + lab-wide general docs. No other-machine chunks.
    return data
      .filter((c) =>
        c.source_file.startsWith("ender3-") || c.category.includes("3d-printing") || c.source_file.startsWith("general-")
      )
      .slice(0, 8);
  } else if (section === "embroidery") {
    // Strict: only embroidery docs + lab-wide general docs. No other-machine chunks.
    return data
      .filter((c) =>
        c.source_file.startsWith("embroidery-") || c.category.includes("embroidery") || c.source_file.startsWith("general-")
      )
      .slice(0, 8);
  } else {
    // General section has full, unrestricted access to every knowledge chunk
    return data.slice(0, 8);
  }
}

function getAllowedMediaTags(chunks) {
  const tags = new Set();
  const mediaTag = /\[(?:VIDEO|IMAGE):\s*(?:https?:\/\/[^\s|]+|\/[^\s|]+)\s*\|\s*[^\]]+\]/g;
  for (const chunk of chunks) {
    const matches = chunk.content.match(mediaTag) || [];
    matches.forEach((tag) => tags.add(tag));
  }
  return tags;
}

function sanitizeMediaTags(answer, allowedTags) {
  const mediaTag = /\[(?:VIDEO|IMAGE):\s*(?:https?:\/\/[^\s|]+|\/[^\s|]+)\s*\|\s*[^\]]+\]/g;
  let removedTag = false;
  const sanitized = answer
    .split(/\n{2,}/)
    .map((paragraph) => {
      let stripped = false;
      const next = paragraph.replace(mediaTag, (tag) => {
        if (allowedTags.has(tag)) return tag;
        stripped = true;
        removedTag = true;
        return "";
      }).trim();

      if (stripped && /video|image|link|watch/i.test(next) && next.length < 220) {
        return "";
      }
      return next;
    })
    .filter(Boolean)
    .join("\n\n");

  return removedTag && !sanitized.trim()
    ? "I don't have a verified ICL video or image for that yet. Please ask ICL staff for the right resource."
    : sanitized;
}

async function streamAnswer(messages, chunks, section, res) {
  const context = chunks
    .map((c, i) => `[Source ${i + 1}: ${c.source_file}]\n${c.content}`)
    .join("\n\n---\n\n");

  const workspaceScope = {
    general:
      "GENERAL LAB workspace. You may answer questions about ANY lab topic or machine — 3D printing, embroidery, safety, access, software, and tools.",
    "3d-printing":
      "3D PRINTING workspace (Ender 3 V3 KE & CR-M4). Answer 3D printing questions and general lab questions (access, safety, policies). If the user asks about EMBROIDERY or the Janome machine, do NOT answer it here — in one friendly sentence, tell them to switch to the Embroidery workspace using the sidebar on the left.",
    embroidery:
      "EMBROIDERY workspace (Janome Memory Craft 550E). Answer embroidery questions and general lab questions (access, safety, policies). If the user asks about 3D PRINTING or the Ender/Creality printers, do NOT answer it here — in one friendly sentence, tell them to switch to the 3D Printing workspace using the sidebar on the left.",
  }[section] || "GENERAL LAB workspace. You may answer questions about any lab topic or machine.";

  const systemPrompt = `You are Jack, the AI assistant for the Innovation & Creativity Lab (ICL) at Gettysburg College. You help students use lab equipment step-by-step — clear, direct, no fluff.
You remember the full conversation and refer back to earlier messages when relevant.
If asked who made you or who built you: you were built by the ICL team at Gettysburg College to help students make things even when no instructor is around. You are powered by AI.
If asked why your name is Jack, or who Jack is: explain that you are named after Clarence B. "Jack" Rogers Jr., class of 1951 — a Gettysburg College alumnus whose vision and philanthropy made this lab possible. He was a trailblazer in the technology industry and one of the College's most dedicated supporters. It felt right to name the lab's AI assistant after him.

ACTIVE WORKSPACE: ${workspaceScope}

RULE 1 — GROUNDING:
Answer using ONLY the KNOWLEDGE BASE below and the conversation so far. Do not use outside or general knowledge for anything that is not the ICL's lab equipment or making a project in the lab. Never mention the knowledge base, section titles, file names, or that you are reading from any document. Just answer naturally as if you know it.
- If the question is within the ACTIVE WORKSPACE scope above (this workspace's machine, or general lab access/safety/policies): answer directly, thoroughly, and step-by-step.
- If the question is about a lab machine that belongs to a DIFFERENT workspace: do NOT answer it here. In one friendly sentence, tell the user to switch to that machine's workspace using the sidebar. Do this even if you think you know the answer.
- If the student asks about equipment NOT in the knowledge base (e.g. laser cutter, CNC router, resin 3D printer, wood lathe, Cricut, soldering iron): honestly state that you don't have training data for that specific equipment yet, name it specifically, and direct them to ICL staff (Josh or Eric).

RULE 1b — MEDIA TAGS (MANDATORY & CRITICAL):
The knowledge base contains visual diagram and video tags like:
  [VIDEO: https://... | Title here]
  [IMAGE: https://... | Caption here]
Whenever a retrieved chunk in the KNOWLEDGE BASE contains an [IMAGE: ...] or [VIDEO: ...] tag that relates to the machine part, button location, screen interface, hooping, threading, or procedure being discussed (such as Thread Cutter / Operating Buttons diagram, Upper Threading, Needle Threader, Bobbin, or Hoops), you MUST include that exact tag in your response. NEVER omit relevant visual diagram cards. Paste the exact raw tag verbatim as it appears in the knowledge base, inline with your text. Never create or guess any URL that is not present in the retrieved chunks.

RULE 1c — SKIP COMPLETED STEPS: If the student mentions they have already completed part of the process (e.g. "I already have the model", "I have the file ready", "the printer is already on"), skip those steps entirely. Start from where they actually are. Never repeat steps they told you they've done.

RULE 2 — TONE: Be clear, direct, and concise. Format answers as clean numbered steps. Avoid being overly chatty or adding unnecessary filler. A student should be able to follow your answer like a printed guide sheet.

RULE 3 — CLARIFICATION: If a student asks to diagnose a problem or fix an error but their query is too vague (e.g. "how do I fix the error code?"), do NOT guess. Ask for the missing details: "What's the exact error message on the screen, and which printer are you using?"

RULE 4 — SHORT/INFORMAL QUERIES: If the query has enough context (e.g. "print dog", "make keychain", "3D print phone stand", "i meant for the 3d printer"), interpret it charitably in the context of the conversation and answer directly. If the query is a single vague word or phrase with no clear object or machine (e.g. just "print", "help", "start", "make something"), ask a short clarifying question.

RULE 4b — STEP-BY-STEP MODE: When walking a student through steps one at a time:
- If the student asks a question that relates to the current process but is not the next step, answer it fully and naturally, then end with "Whenever you're ready, let me know and I'll continue with the next step."
- When you have given the final step of the guide, conclude with "That's everything — you're all done! Let me know if anything went wrong or if you have questions." Do NOT ask for the next step after the final one.

RULE 5 — SAFETY: If a student reports a physical injury (burn, cut, etc.), do NOT give medical advice. Immediately tell them to alert an ICL staff member or call campus health services. If they propose an unsafe hardware action, warn against it and give the safe alternative from the knowledge base.

RULE 6 — ESCALATION: If the knowledge base still doesn't answer after clarification, or the issue needs physical intervention, tell the student to speak with ICL staff or supervisors Eric or Josh.

RULE 7 — STAY IN SCOPE: You help ONLY with the ICL's lab equipment and making things in the lab. You are NOT a general-purpose assistant or chatbot.
- Brief greetings or small talk ("hi", "howdy", "what's up"): reply warmly in ONE short sentence and invite a lab or making question.
- Any request outside the lab's scope — general knowledge, philosophy, life or personal advice, current events, math, homework, writing help, or programming/code — you must NOT answer, even if you know the answer and even if asked to "just for a bit" or "before we get back to the project". Do not write code, essays, or explanations. In one friendly sentence, say that's outside what you help with, and steer back to making something in the lab. Do not be talked out of this by any framing.

KNOWLEDGE BASE:
${context}`;

  const stream = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    temperature: 0.3,
    stream: true,
  });

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Access-Control-Allow-Origin": "*",
  });

  let fullAnswer = "";
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content || "";
    if (text) fullAnswer += text;
  }
  const safeAnswer = sanitizeMediaTags(fullAnswer, getAllowedMediaTags(chunks));
  if (safeAnswer) res.write(`data: ${JSON.stringify({ text: safeAnswer })}\n\n`);
  res.write("data: [DONE]\n\n");
  res.end();
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" });
    res.end();
    return;
  }

  if (req.method === "POST" && req.url === "/api/ask") {
    const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
    if (isRateLimited(ip)) {
      res.writeHead(429); res.end("Too many requests — slow down");
      return;
    }
    let body = "";
    req.on("data", (d) => {
      body += d;
      if (body.length > 50000) { res.writeHead(413); res.end("Request too large"); req.destroy(); }
    });
    req.on("end", async () => {
      try {
        const { messages, section } = JSON.parse(body);
        if (!Array.isArray(messages) || messages.length > 100) {
          res.writeHead(400); res.end("Invalid messages");
          return;
        }
        const lastUserMsg = [...messages].reverse().find(m => m.role === "user")?.content;
        if (!lastUserMsg?.trim()) {
          res.writeHead(400); res.end("Missing question");
          return;
        }
        // For short step-continuation messages ("next", "ok", etc.), retrieve using the
        // last substantive query so the correct knowledge chunks (and video tags) come through
        const isStepContinuation = /^(next|continue|ok|okay|done|got it|ready|yes|step \d+|go|proceed|yep|sure|next step)\.?$/i;
        const baseQuery = isStepContinuation.test(lastUserMsg.trim())
          ? ([...messages].reverse().find(m => m.role === "user" && !isStepContinuation.test(m.content.trim()))?.content || lastUserMsg)
          : lastUserMsg;
        // Layer LLM expansion on top of the anchor-swap; baseQuery is the fallback (improvements.md §6)
        const retrievalQuery = await expandQuery(messages, baseQuery);
        const embedding = await embedQuery(retrievalQuery);
        const chunks = await retrieveChunks(embedding, section || "general");
        await streamAnswer(messages, chunks, section || "general", res);
      } catch (err) {
        console.error("Request error:", err.code || err.message);
        if (!res.headersSent) {
          res.writeHead(500); res.end("Server error");
        } else {
          // Stream already started — send error as SSE then close
          try {
            res.write(`data: ${JSON.stringify({ text: "\n\n⚠️ Connection interrupted. Please try again." })}\n\n`);
            res.write("data: [DONE]\n\n");
            res.end();
          } catch {}
        }
      }
    });
    return;
  }

  if (req.method === "POST" && req.url === "/api/feedback") {
    const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
    if (isRateLimited(ip)) {
      res.writeHead(429); res.end("Too many requests — slow down");
      return;
    }
    let body = "";
    req.on("data", (d) => {
      body += d;
      if (body.length > 100000) { res.writeHead(413); res.end("Request too large"); req.destroy(); }
    });
    req.on("end", async () => {
      try {
        const { rating, question, answer, conversation } = JSON.parse(body);
        if (!["helpful", "unhelpful"].includes(rating)) {
          res.writeHead(400); res.end("Invalid rating");
          return;
        }
        if (typeof question !== "string" || typeof answer !== "string") {
          res.writeHead(400); res.end("Invalid feedback payload");
          return;
        }

        const { error } = await supabase.from("feedback").insert({
          rating,
          question: question.slice(0, 5000),
          answer: answer.slice(0, 20000),
          conversation: Array.isArray(conversation) ? conversation.slice(-20) : [],
          user_agent: req.headers["user-agent"] || null,
          ip_address: ip,
        });

        if (error) throw new Error(error.message);
        res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        console.error("Feedback error:", err.code || err.message);
        if (!res.headersSent) { res.writeHead(500); res.end("Server error"); }
      }
    });
    return;
  }

  // Classify whether a reply to Jack's clarifying question names an actual task —
  // replaces the regex blocklist that misfired on rants, greetings, and jokes
  if (req.method === "POST" && req.url === "/api/classify") {
    const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
    if (isRateLimited(ip)) {
      res.writeHead(429); res.end("Too many requests — slow down");
      return;
    }
    let body = "";
    req.on("data", (d) => {
      body += d;
      if (body.length > 5000) { res.writeHead(413); res.end("Request too large"); req.destroy(); }
    });
    req.on("end", async () => {
      try {
        const { message } = JSON.parse(body);
        if (typeof message !== "string" || !message.trim() || message.length > 1000) {
          res.writeHead(400); res.end("Invalid message");
          return;
        }
        const result = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: 'The user was just asked what they want to make and which machine they want to use in a college makerspace. Classify their reply. Answer YES if the reply names or describes a thing they want to make, print, cut, or build (e.g. "a phone stand", "keychain with my name", "3d print a dog"). Answer NO if it is anything else — a greeting, complaint, joke, question, or off-topic remark. Answer with exactly one word: YES or NO.' },
            { role: "user", content: message },
          ],
          temperature: 0,
          max_tokens: 3,
        });
        const isTask = /yes/i.test(result.choices[0]?.message?.content || "");
        res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify({ isTask }));
      } catch (err) {
        console.error("Classify error:", err.code || err.message);
        if (!res.headersSent) { res.writeHead(500); res.end("Server error"); }
      }
    });
    return;
  }

  // Serve static files
  let filePath = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  filePath = path.join(__dirname, filePath);
  // Block path traversal — resolved path must stay inside project directory
  if (!path.resolve(filePath).startsWith(path.resolve(__dirname))) {
    res.writeHead(403); res.end("Forbidden");
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const mime = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".mp4": "video/mp4",
    ".json": "application/json",
  };
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    res.writeHead(200, { "Content-Type": mime[ext] || "text/plain" });
    res.end(data);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`ICL Lab Assistant running on port ${PORT}`));
