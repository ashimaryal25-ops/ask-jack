require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const OpenAI = require("openai");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const KNOWLEDGE_DIR = path.join(__dirname, "knowledge_base");

function parseMetadata(content, filename) {
  const machineMatch = content.match(/^machine:\s*(.+)$/m);
  const categoryMatch = content.match(/^category:\s*(.+)$/m);
  return {
    machine: machineMatch ? machineMatch[1].trim() : "general",
    category: categoryMatch ? categoryMatch[1].trim() : "general",
    source_file: filename,
  };
}

function chunkText(text, maxChars = 2000) {
  const paragraphs = text.split(/\n{2,}/);
  const chunks = [];
  let current = "";

  for (const para of paragraphs) {
    if ((current + para).length > maxChars && current.length > 0) {
      chunks.push(current.trim());
      current = para;
    } else {
      current += (current ? "\n\n" : "") + para;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

async function embedText(text) {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}

async function ingest() {
  const files = fs.readdirSync(KNOWLEDGE_DIR).filter((f) => f.endsWith(".md"));
  console.log(`Found ${files.length} knowledge files\n`);

  // Clear existing chunks
  await supabase.from("knowledge_chunks").delete().neq("id", 0);
  console.log("Cleared existing chunks\n");

  let totalChunks = 0;

  for (const file of files) {
    const content = fs.readFileSync(path.join(KNOWLEDGE_DIR, file), "utf-8");
    const metadata = parseMetadata(content, file);
    const chunks = chunkText(content);

    console.log(`Processing ${file} → ${chunks.length} chunks`);

    for (const chunk of chunks) {
      const embedding = await embedText(chunk);
      const { error } = await supabase.from("knowledge_chunks").insert({
        machine: metadata.machine,
        category: metadata.category,
        source_file: metadata.source_file,
        content: chunk,
        embedding,
      });

      if (error) {
        console.error(`Error inserting chunk from ${file}:`, error.message);
      } else {
        totalChunks++;
      }
    }
  }

  console.log(`\n✅ Done — ${totalChunks} chunks loaded into Supabase`);
}

ingest().catch(console.error);
