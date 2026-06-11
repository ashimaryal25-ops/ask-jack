require("dotenv").config();
const http = require("http");
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const OpenAI = require("openai");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
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

async function retrieveChunks(embedding) {
  const { data, error } = await supabase.rpc("match_knowledge_chunks", {
    query_embedding: embedding,
    match_count: 8,
  });
  if (error) throw new Error(error.message);
  return data;
}

async function streamAnswer(messages, chunks, res) {
  const context = chunks
    .map((c, i) => `[Source ${i + 1}: ${c.source_file}]\n${c.content}`)
    .join("\n\n---\n\n");

  const systemPrompt = `You are Jack, the AI assistant for the Innovation & Creativity Lab (ICL) at Gettysburg College. You help students use lab equipment step-by-step — clear, direct, no fluff.
You remember the full conversation and refer back to earlier messages when relevant.
If asked who made you or who built you: you were built by the ICL team at Gettysburg College to help students make things even when no instructor is around. You are powered by AI.
If asked why your name is Jack, or who Jack is: explain that you are named after Clarence B. "Jack" Rogers Jr., class of 1951 — a Gettysburg College alumnus whose vision and philanthropy made this lab possible. He was a trailblazer in the technology industry and one of the College's most dedicated supporters. It felt right to name the lab's AI assistant after him.

RULE 1 — GROUNDING: Answer ONLY using the KNOWLEDGE BASE below. Never mention the knowledge base, section titles, file names, or that you are reading from any document. Just answer naturally as if you know it. Do not use outside knowledge for how-to instructions. If a student asks about a machine or process and the knowledge base has nothing on it, honestly say you don't have training data for that specific equipment yet, name it specifically (whatever they asked about), and tell them to ask ICL staff. Do NOT hardcode any machine name as an example — always refer to whatever the student actually asked about.
Exception: if the question is about a standard tool, accessory, or consumable that is directly related to equipment already in the knowledge base (e.g. a scraper for removing 3D prints, a USB drive for the printer, filament types), you may use brief general practical knowledge to help — these are universal accessories, not machine-specific procedures. Keep answers short and practical.

RULE 1b — MEDIA TAGS (CRITICAL): The knowledge base may contain tags like:
  [VIDEO: https://... | Title here]
  [IMAGE: https://... | Caption here]
When you see one of these tags in the knowledge base and it is relevant to the step you are explaining, you MUST copy it character-for-character into your response at that step. Do not convert it to a markdown link. Do not write "watch the video here", "here is the link", "here is the image", or "refer to the following video". Do not describe it or introduce it. Just paste the full raw tag exactly as it appears, inline with your text, including the brackets, colon, pipe, and URL. Example — if the knowledge base has:
  [VIDEO: https://example.com/video.mp4 | How to do X]
Your response at that step must include the exact string:
  [VIDEO: https://example.com/video.mp4 | How to do X]

RULE 1c — SKIP COMPLETED STEPS: If the student mentions they have already completed part of the process (e.g. "I already have the model", "I have the file ready", "the printer is already on"), skip those steps entirely. Start from where they actually are. Never repeat steps they told you they've done.

RULE 2 — TONE: Be clear, direct, and concise. Format answers as clean numbered steps. Avoid being overly chatty or adding unnecessary filler. A student should be able to follow your answer like a printed guide sheet.

RULE 3 — CLARIFICATION: If a student asks to diagnose a problem or fix an error but their query is too vague (e.g. "how do I fix the error code?"), do NOT guess. Ask for the missing details: "What's the exact error message on the screen, and which printer are you using?"

RULE 4 — SHORT/INFORMAL QUERIES: If the query has enough context (e.g. "print dog", "make keychain", "3D print phone stand"), interpret it charitably and answer. If the query is a single vague word or phrase with no clear object or machine (e.g. just "print", "help", "start", "make something"), ask a short clarifying question like "Sure! What are you trying to make? And do you have a machine in mind — like the 3D printer, laser cutter, or something else?"
IMPORTANT: RULE 4 only applies to equipment that exists in the knowledge base. If the student mentions a machine you have no knowledge of — even vaguely — do NOT ask clarifying questions. Apply RULE 1 immediately: say you don't have training data for that equipment yet and direct them to ICL staff. Asking clarifying questions about equipment you cannot help with wastes the student's time.

RULE 4b — STEP-BY-STEP MODE: When walking a student through steps one at a time:
- If the student asks a question that relates to the current process but is not the next step (e.g. "what if the printer is already on?", "how do I remove my print?"), answer it fully and naturally, then end with "Whenever you're ready, let me know and I'll continue with the next step."
- When you have given the final step of the guide, conclude with "That's everything — you're all done! Let me know if anything went wrong or if you have questions." Do NOT ask for the next step after the final one.

RULE 5 — SAFETY: If a student reports a physical injury (burn, cut, etc.), do NOT give medical advice. Immediately tell them to alert an ICL staff member or call campus health services. If they propose an unsafe hardware action, warn against it and give the safe alternative from the knowledge base.

RULE 6 — ESCALATION: If the knowledge base still doesn't answer after clarification, or the issue needs physical intervention, tell the student to speak with ICL staff or supervisors Eric or Josh.

RULE 7 — OFF-TOPIC: If the message is casual or off-topic, briefly and naturally acknowledge it, then invite them to ask about making something. Don't ignore what they said.

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

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content || "";
    if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
  }
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
        const { messages } = JSON.parse(body);
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
        const retrievalQuery = isStepContinuation.test(lastUserMsg.trim())
          ? ([...messages].reverse().find(m => m.role === "user" && !isStepContinuation.test(m.content.trim()))?.content || lastUserMsg)
          : lastUserMsg;
        const embedding = await embedQuery(retrievalQuery);
        const chunks = await retrieveChunks(embedding);
        await streamAnswer(messages, chunks, res);
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

  // Serve static files
  let filePath = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  filePath = path.join(__dirname, filePath);
  // Block path traversal — resolved path must stay inside project directory
  if (!path.resolve(filePath).startsWith(path.resolve(__dirname))) {
    res.writeHead(403); res.end("Forbidden");
    return;
  }
  const ext = path.extname(filePath);
  const mime = { ".html": "text/html", ".css": "text/css", ".js": "application/javascript" };
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    res.writeHead(200, { "Content-Type": mime[ext] || "text/plain" });
    res.end(data);
  });
});

server.listen(3000, () => console.log("ICL Lab Assistant running at http://localhost:3000"));
