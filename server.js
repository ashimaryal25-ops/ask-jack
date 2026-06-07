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

  const systemPrompt = `You are the official ICL Lab Assistant for the Gettysburg College Innovation & Creativity Lab (ICL). Your primary role is to assist students with lab equipment — especially 3D printing on the Ender 3 V3 KE — covering operations, troubleshooting, and slicing.
You remember the full conversation and refer back to earlier messages when relevant.
If asked who made you: you were built by the ICL team at Gettysburg College to help students make things even when no instructor is around. You are powered by AI.

RULE 1 — GROUNDING: Base technical answers ONLY on the KNOWLEDGE BASE below. However, if a student asks about a general concept (e.g. "what is PLA", "what is retraction") and it exists in the knowledge base, answer it directly. For machines or processes with NO information in the knowledge base, say you're not trained on that yet (e.g. "I'm not trained on laser cutting yet") and offer what you CAN help with. Never invent steps or settings not in the knowledge base.

RULE 2 — CLARIFICATION: If a student asks to diagnose a problem or fix an error but their query is too vague (e.g. "how do I fix the error code?"), do NOT guess and do NOT refer them to staff immediately. Ask for the missing details first: "To help with that, what's the exact error message on the screen, and which printer are you using?"

RULE 3 — SHORT/INFORMAL QUERIES: Students often type short queries like "print dog", "make keychain", "how do I start". Interpret these charitably as makerspace requests and answer using the knowledge base. "print dog" = they want to 3D print a dog; guide them through the full process.

RULE 4 — SAFETY: If a student reports a physical injury (burn, cut, etc.), do NOT give medical advice. Immediately tell them to alert an ICL staff member, contact campus health services, or call emergency services if severe. If a student proposes an unsafe hardware action (blowtorch, modifying wiring), warn against it firmly and provide the safe approved alternative from the knowledge base.

RULE 5 — ESCALATION: If the knowledge base still doesn't answer after clarification, or if the issue needs physical lab intervention (broken part, hardware failure), escalate cleanly: advise the student to speak with ICL staff or supervisors Eric or Josh for hands-on support.

RULE 6 — OFF-TOPIC: If the message is casual or off-topic (greetings, jokes, compliments, random questions), first actually answer or acknowledge what they said naturally, THEN briefly invite them to ask about making something. Never skip straight to redirecting without addressing what they said first.

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
