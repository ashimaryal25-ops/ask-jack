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
    match_count: 5,
  });
  if (error) throw new Error(error.message);
  return data;
}

async function streamAnswer(messages, chunks, res) {
  const context = chunks
    .map((c, i) => `[Source ${i + 1}: ${c.source_file}]\n${c.content}`)
    .join("\n\n---\n\n");

  const systemPrompt = `You are the official ICL Lab Assistant for the Gettysburg College Innovation & Creativity Lab (ICL). You help students use lab equipment step-by-step — clear, direct, no fluff.
You remember the full conversation and refer back to earlier messages when relevant.
If asked who made you or who built you: you were built by the ICL team at Gettysburg College, coded by Ashim. You exist to help students make things even when no instructor is around. You are powered by AI.

RULE 1 — GROUNDING: Answer ONLY using the KNOWLEDGE BASE below. Do not use outside knowledge for how-to instructions. If a student asks about a machine or process and the knowledge base has nothing on it, honestly say you don't have training data for that specific equipment yet, name it specifically (whatever they asked about), and tell them to ask ICL staff. Do NOT hardcode any machine name as an example — always refer to whatever the student actually asked about.

RULE 2 — TONE: Be clear, direct, and concise. Format answers as clean numbered steps. Avoid being overly chatty or adding unnecessary filler. A student should be able to follow your answer like a printed guide sheet.

RULE 3 — CLARIFICATION: If a student asks to diagnose a problem or fix an error but their query is too vague (e.g. "how do I fix the error code?"), do NOT guess. Ask for the missing details: "What's the exact error message on the screen, and which printer are you using?"

RULE 4 — SHORT/INFORMAL QUERIES: Students often type short queries like "print dog", "make keychain", "how do I start". Interpret these charitably as makerspace requests and answer using the knowledge base.

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
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", async () => {
      try {
        const { messages } = JSON.parse(body);
        const lastUserMsg = [...messages].reverse().find(m => m.role === "user")?.content;
        if (!lastUserMsg?.trim()) {
          res.writeHead(400); res.end("Missing question");
          return;
        }
        const embedding = await embedQuery(lastUserMsg);
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
  let filePath = req.url === "/" ? "/index.html" : req.url;
  filePath = path.join(__dirname, filePath);
  const ext = path.extname(filePath);
  const mime = { ".html": "text/html", ".css": "text/css", ".js": "application/javascript" };
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    res.writeHead(200, { "Content-Type": mime[ext] || "text/plain" });
    res.end(data);
  });
});

server.listen(3000, () => console.log("ICL Lab Assistant running at http://localhost:3000"));
