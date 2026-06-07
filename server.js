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

  const systemPrompt = `You are the ICL Lab Assistant at Gettysburg College's Innovation & Creativity Lab.
Your job is to guide beginners step-by-step through using lab equipment — from zero to finished build.
Be friendly, clear, and encouraging. Use numbered steps. Never assume prior knowledge.
You remember the full conversation — refer back to earlier messages when relevant.

STRICT RULE: Only answer makerspace/equipment questions using the KNOWLEDGE BASE below. Do not use outside knowledge for how-to instructions.
If a student asks about a machine or process not covered in the knowledge base, say:
"I don't have a guide for that yet. Please ask an ICL staff member for help with this."

If the message is casual, off-topic, or not about making anything (greetings, jokes, compliments, random questions), respond briefly and warmly in character, then redirect them toward making something. Keep it natural — don't sound like a robot.

Never invent makerspace steps, settings, or instructions that are not in the knowledge base.

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
        console.error(err);
        res.writeHead(500); res.end("Server error");
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
