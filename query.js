require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const OpenAI = require("openai");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function embedQuery(text) {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}

async function retrieveChunks(embedding, topK = 5) {
  const { data, error } = await supabase.rpc("match_knowledge_chunks", {
    query_embedding: embedding,
    match_count: topK,
  });
  if (error) throw new Error(error.message);
  return data;
}

async function generateAnswer(query, chunks) {
  const context = chunks
    .map((c, i) => `[Source ${i + 1}: ${c.source_file}]\n${c.content}`)
    .join("\n\n---\n\n");

  const prompt = `You are an ICL lab assistant at Gettysburg College helping a beginner use makerspace equipment.
A student has asked: "${query}"

Use the following knowledge base excerpts to give them a clear, friendly, step-by-step answer.
If the information is not in the excerpts, say so honestly.

KNOWLEDGE BASE:
${context}

Give a practical, beginner-friendly response with numbered steps where appropriate.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
  });

  return response.choices[0].message.content;
}

async function query(userQuery) {
  console.log(`\nQuery: "${userQuery}"\n`);
  console.log("Embedding query...");
  const embedding = await embedQuery(userQuery);

  console.log("Retrieving relevant chunks...");
  const chunks = await retrieveChunks(embedding);
  console.log(`Found ${chunks.length} relevant chunks:\n`);
  chunks.forEach((c, i) => console.log(`  ${i + 1}. ${c.source_file} (similarity: ${c.similarity?.toFixed(3)})`));

  console.log("\nGenerating answer...\n");
  const answer = await generateAnswer(userQuery, chunks);
  console.log("=".repeat(60));
  console.log(answer);
  console.log("=".repeat(60));
}

const userQuery = process.argv[2] || "I want to 3D print a dog figurine, how do I start?";
query(userQuery).catch(console.error);
