const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  PageNumber, Header, Footer, LevelFormat
} = require("docx");
const fs = require("fs");

const orange = "F26522";
const navy = "0D1B6E";
const lightGray = "F5F6FA";
const borderGray = "DDDDDD";

const cellBorder = (color = borderGray) => ({
  top: { style: BorderStyle.SINGLE, size: 1, color },
  bottom: { style: BorderStyle.SINGLE, size: 1, color },
  left: { style: BorderStyle.SINGLE, size: 1, color },
  right: { style: BorderStyle.SINGLE, size: 1, color },
});

function heading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: orange, space: 4 } },
    children: [new TextRun({ text, bold: true, size: 32, color: navy, font: "Arial" })],
  });
}

function body(text, options = {}) {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text, size: 22, font: "Arial", ...options })],
  });
}

function bullet(text) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, size: 22, font: "Arial" })],
  });
}

function spacer() {
  return new Paragraph({ spacing: { before: 80, after: 80 }, children: [new TextRun("")] });
}

function fixTable(rows) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2200, 3580, 3580],
    rows: [
      new TableRow({
        children: [
          tableCell("#", navy, "FFFFFF", 2200, true),
          tableCell("Issue", navy, "FFFFFF", 3580, true),
          tableCell("Fix Applied", navy, "FFFFFF", 3580, true),
        ],
      }),
      ...rows.map((r, i) =>
        new TableRow({
          children: [
            tableCell(String(i + 1), i % 2 === 0 ? lightGray : "FFFFFF", "333333", 2200),
            tableCell(r[0], i % 2 === 0 ? lightGray : "FFFFFF", "333333", 3580),
            tableCell(r[1], i % 2 === 0 ? lightGray : "FFFFFF", "333333", 3580),
          ],
        })
      ),
    ],
  });
}

function tableCell(text, fill, textColor, width, bold = false) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: cellBorder(),
    shading: { fill, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold, size: 20, font: "Arial", color: textColor })],
      }),
    ],
  });
}

const fixes = [
  ["OpenAI 429 quota error on first run", "Added $5 API credit at platform.openai.com/billing (ChatGPT Pro and API billing are separate)"],
  ["Supabase table not found on insert", "Recreated table with explicit `public.knowledge_chunks` schema prefix to avoid cache miss"],
  ["IVFFlat index memory error (54000)", "Skipped vector index entirely — free Supabase tier caps at 32MB, unnecessary for 19 chunks"],
  ["GPT hallucinating laser cutter steps", "Added STRICT RULE to system prompt: only answer from KNOWLEDGE BASE, never invent instructions"],
  ["Loading dots persisting after answer", "Added `[hidden] { display: none !important; }` CSS fix + `loading.hidden = true` in finally block"],
  ["Markdown not rendering in answers", "Rewrote formatMarkdown() with proper header, bold, ordered/unordered list, and link handling"],
  ["Colored emoji clashing on machine cards", "Replaced all emoji with inline SVG icons (white/85% opacity) rendering cleanly on navy/orange"],
  ["package.json pointing to app.js", "Fixed `main` to `server.js` and added `start: node server.js` script for Railway"],
  ["Vercel deploy crash (serverless mismatch)", "Switched from Vercel to Railway — raw http.createServer works natively, no rewrite needed"],
  ["GPT saying 'I don't have a guide' for vague queries", "Added charitable interpretation rule: 'print dog' = 3D print a dog, guide through full process"],
  ["Off-topic messages getting generic redirect", "Added RULE 6: address what the student said first, then naturally pivot to making something"],
  ["'Who created you' not answered", "Added identity to system prompt: built by ICL team at Gettysburg College, powered by AI"],
  ["'Not trained on laser cutting' hardcoded in response", "Fixed prompt to dynamically name whatever the student actually asked about, never hardcode examples"],
  ["Responses too chatty and verbose", "Added RULE 2: clear, direct, numbered steps — answer should read like a printed guide sheet"],
  ["ECONNRESET on streaming responses", "Added graceful error handling: if stream started, sends warning SSE token before closing"],
  ["No conversation memory between messages", "Rebuilt frontend + backend for full chat history — conversationHistory[] sent with every request"],
  ["Vague error queries getting guessed answers", "Added RULE 2 (Clarification): ask for exact error code and printer model before responding"],
  ["Safety/injury queries getting instructions", "Added RULE 4: injuries → alert ICL staff / campus health, unsafe actions → warn + safe alternative"],
  ["No escalation path for unsolvable issues", "Added RULE 5: escalate to supervisors Eric or Josh by name for physical lab intervention"],
];

const doc = new Document({
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: "•",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      },
    ],
  },
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: orange, space: 4 } },
          children: [
            new TextRun({ text: "ICL Lab Assistant — ", bold: true, size: 20, color: navy, font: "Arial" }),
            new TextRun({ text: "Fix & Change Log", size: 20, color: "666666", font: "Arial" }),
          ],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            new TextRun({ text: "Page ", size: 18, color: "999999", font: "Arial" }),
            new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "999999", font: "Arial" }),
          ],
        })],
      }),
    },
    children: [

      // Title block
      new Paragraph({
        spacing: { before: 0, after: 80 },
        children: [new TextRun({ text: "ICL Lab Assistant", bold: true, size: 52, color: navy, font: "Arial" })],
      }),
      new Paragraph({
        spacing: { before: 0, after: 40 },
        children: [new TextRun({ text: "Fix & Change Log", size: 32, color: orange, font: "Arial" })],
      }),
      new Paragraph({
        spacing: { before: 0, after: 200 },
        children: [
          new TextRun({ text: "Gettysburg College  ·  Innovation & Creativity Lab  ·  ", size: 20, color: "888888", font: "Arial" }),
          new TextRun({ text: "ICL Team", size: 20, color: navy, bold: true, font: "Arial" }),
          new TextRun({ text: "  ·  Coded by ", size: 20, color: "888888", font: "Arial" }),
          new TextRun({ text: "Ashim", size: 20, color: orange, bold: true, font: "Arial" }),
        ],
      }),

      // Overview
      heading1("Project Overview"),
      body("The ICL Lab Assistant is a RAG (Retrieval-Augmented Generation) AI system built to guide complete beginners through using makerspace equipment at Gettysburg College's Innovation & Creativity Lab. Students type natural language questions and receive step-by-step guidance from a real-time streaming AI — even when no instructor is present."),
      spacer(),
      body("Tech stack:", { bold: true }),
      bullet("Backend: Node.js (raw http module), OpenAI gpt-4o-mini + text-embedding-3-small"),
      bullet("Vector DB: Supabase pgvector with cosine similarity search"),
      bullet("Frontend: Vanilla JS, SSE streaming, ICL orange/navy brand"),
      bullet("Deployment: Railway (persistent server, no cold starts)"),
      bullet("Knowledge base: 9 markdown docs, 19 chunks covering Ender 3 V3 KE 3D printing"),
      spacer(),

      // Fix log table
      heading1("Complete Fix Log"),
      body("All bugs, prompt failures, and improvements made during development:"),
      spacer(),
      fixTable(fixes),
      spacer(),

      // Prompt evolution
      heading1("System Prompt Evolution"),
      body("The prompt went through 6 major iterations. Final version enforces 7 rules:"),
      spacer(),
      bullet("RULE 1 — GROUNDING: Answer only from knowledge base. Name missing equipment specifically."),
      bullet("RULE 2 — TONE: Clear, direct, numbered steps. Read like a printed guide sheet."),
      bullet("RULE 3 — CLARIFICATION: Vague error queries -> ask for exact error code + printer model first."),
      bullet("RULE 4 — SHORT QUERIES: 'print dog' = 3D print a dog. Interpret charitably."),
      bullet("RULE 5 — SAFETY: Injuries -> alert staff/campus health. Unsafe actions -> warn + safe alternative."),
      bullet("RULE 6 — ESCALATION: Unresolvable issues -> escalate to Eric or Josh by name."),
      bullet("RULE 7 — OFF-TOPIC: Acknowledge what they said first, then invite them to make something."),
      spacer(),

      // Architecture
      heading1("RAG Architecture"),
      body("Request flow for every student query:"),
      spacer(),
      bullet("1. Student types query -> POST /api/ask with full conversationHistory[]"),
      bullet("2. Server extracts last user message -> embeds with text-embedding-3-small (1536 dims)"),
      bullet("3. Supabase match_knowledge_chunks RPC -> cosine similarity -> top 5 chunks returned"),
      bullet("4. Chunks injected into system prompt as KNOWLEDGE BASE context"),
      bullet("5. Full message history + system prompt sent to gpt-4o-mini with stream: true"),
      bullet("6. Server streams SSE tokens -> client renders word-by-word via formatMarkdown()"),
      spacer(),

      // Pending
      heading1("Pending / Next Steps"),
      bullet("Tinkercad guide — custom model design workflow"),
      bullet("Print failure troubleshooting doc — stringing, warping, bed adhesion"),
      bullet("Other machine knowledge bases — vinyl cutter, laser cutter, embroidery, electronics"),
      bullet("Video links — embed YouTube per step after lab visit"),
      bullet("FAQ doc — 'How long does it take?', 'Is it free?', filament spool locations"),
      bullet("AWS migration — Bedrock + OpenSearch Serverless for Amazon resume value"),
    ],
  }],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync("C:\\Users\\hp\\Desktop\\RAG_ICL\\ICL-Lab-Assistant-Fix-Log.docx", buffer);
  console.log("Done: ICL-Lab-Assistant-Fix-Log.docx");
});
