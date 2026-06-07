const questionInput = document.getElementById("questionInput");
const askBtn = document.getElementById("askBtn");
const answerBox = document.getElementById("answerBox");
const answerContent = document.getElementById("answerContent");
const loading = document.getElementById("loading");
const copyBtn = document.getElementById("copyBtn");

document.querySelectorAll(".suggestion-pill").forEach((pill) => {
  pill.addEventListener("click", () => {
    questionInput.value = pill.dataset.prompt || pill.textContent.trim();
    questionInput.focus();
  });
});

document.querySelectorAll(".machine-card").forEach((card) => {
  card.addEventListener("click", () => {
    const machine = card.querySelector("strong").textContent;
    questionInput.value = `How do I use the ${machine} at the ICL?`;
    questionInput.focus();
  });
});

questionInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.ctrlKey) askQuestion();
});

askBtn.addEventListener("click", askQuestion);

copyBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(answerContent.innerText);
  copyBtn.textContent = "Copied!";
  setTimeout(() => (copyBtn.textContent = "Copy"), 2000);
});

async function askQuestion() {
  const question = questionInput.value.trim();
  if (!question) return;

  askBtn.disabled = true;
  answerBox.hidden = true;
  loading.hidden = false;
  answerContent.innerHTML = "";

  try {
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });

    if (!res.ok) throw new Error("Server error");

    loading.hidden = true;
    answerBox.hidden = false;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") break;
        try {
          const { text } = JSON.parse(data);
          fullText += text;
          answerContent.innerHTML = formatMarkdown(fullText);
          answerBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
        } catch {}
      }
    }
  } catch (err) {
    loading.hidden = true;
    answerBox.hidden = false;
    answerContent.innerHTML = `<p style="color:red">Something went wrong. Please try again.</p>`;
  } finally {
    askBtn.disabled = false;
    loading.hidden = true;
  }
}

function formatMarkdown(text) {
  // Escape HTML first
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Headers
  html = html.replace(/^###\s+(.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^##\s+(.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^#\s+(.+)$/gm, "<h3>$1</h3>");

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Links
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');

  // Numbered lists
  html = html.replace(/^(\d+)\.\s+(.+)$/gm, "<li>$2</li>");
  html = html.replace(/(<li>[\s\S]*?<\/li>)(\n<li>)/g, "$1$2");
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, "<ol>$1</ol>");

  // Bullet lists
  html = html.replace(/^[-*]\s+(.+)$/gm, "<ul-item>$1</ul-item>");
  html = html.replace(/((?:<ul-item>.*<\/ul-item>\n?)+)/g, (m) =>
    "<ul>" + m.replace(/<ul-item>(.*?)<\/ul-item>/g, "<li>$1</li>") + "</ul>"
  );

  // Paragraphs — wrap lines not already in a block tag
  html = html
    .split("\n")
    .map((line) => {
      if (!line.trim()) return "";
      if (/^<(h3|ol|ul|li)/.test(line.trim())) return line;
      return `<p>${line}</p>`;
    })
    .join("\n");

  return html;
}
