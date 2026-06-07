const { createClient } = require("@supabase/supabase-js");
const OpenAI = require("openai");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).end("Method not allowed");
    return;
  }

  const { question } = req.body;
  if (!question?.trim()) {
    res.status(400).end("Missing question");
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");

  try {
    const embRes = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: question,
    });
    const embedding = embRes.data[0].embedding;

    const { data: chunks, error } = await supabase.rpc("match_knowledge_chunks", {
      query_embedding: embedding,
      match_count: 5,
    });
    if (error) throw new Error(error.message);

    const context = chunks
      .map((c, i) => `[Source ${i + 1}: ${c.source_file}]\n${c.content}`)
      .join("\n\n---\n\n");

    const prompt = `You are the ICL Lab Assistant at Gettysburg College's Innovation & Creativity Lab.
Your job is to guide beginners step-by-step through using lab equipment — from zero to finished build.
Be friendly, clear, and encouraging. Use numbered steps. Never assume prior knowledge.

STRICT RULE: Only answer using the information in the KNOWLEDGE BASE below. Do not use any outside knowledge.
If the knowledge base does not contain enough information to answer the question, say:
"I don't have a guide for that yet. Please ask an ICL staff member for help with this."
Never invent steps, settings, or instructions that are not explicitly in the knowledge base.

Student asked: "${question}"

KNOWLEDGE BASE:
${context}`;

    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      stream: true,
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || "";
      if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
    }
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error(err);
    res.write(`data: ${JSON.stringify({ text: "Something went wrong. Please try again." })}\n\n`);
    res.end();
  }
};
