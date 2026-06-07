const questionInput = document.getElementById("questionInput");
const askBtn = document.getElementById("askBtn");
const chatThread = document.getElementById("chatThread");
const loading = document.getElementById("loading");
const welcomeSection = document.getElementById("welcomeSection");

let conversationHistory = [];

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

function appendUserBubble(text) {
  welcomeSection.hidden = true;
  const div = document.createElement("div");
  div.className = "user-bubble";
  div.textContent = text;
  chatThread.appendChild(div);
  div.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function appendAssistantBubble() {
  const wrapper = document.createElement("div");
  wrapper.className = "assistant-message";
  wrapper.innerHTML = `
    <div class="answer-header">
      <div class="assistant-tag"><span class="dot"></span>Build Guide</div>
      <button class="copy-btn" type="button">Copy</button>
    </div>
    <div class="answer-content"></div>
  `;
  wrapper.querySelector(".copy-btn").addEventListener("click", (e) => {
    const content = wrapper.querySelector(".answer-content");
    navigator.clipboard.writeText(content.innerText);
    e.target.textContent = "Copied!";
    setTimeout(() => (e.target.textContent = "Copy"), 2000);
  });
  chatThread.appendChild(wrapper);
  return wrapper.querySelector(".answer-content");
}

async function askQuestion() {
  const question = questionInput.value.trim();
  if (!question) return;

  conversationHistory.push({ role: "user", content: question });
  appendUserBubble(question);
  questionInput.value = "";

  askBtn.disabled = true;
  loading.hidden = false;

  try {
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: conversationHistory }),
    });

    if (!res.ok) throw new Error("Server error");

    loading.hidden = true;
    const contentEl = appendAssistantBubble();

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
          contentEl.innerHTML = formatMarkdown(fullText);
          contentEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
        } catch {}
      }
    }

    conversationHistory.push({ role: "assistant", content: fullText });
  } catch (err) {
    loading.hidden = true;
    const contentEl = appendAssistantBubble();
    contentEl.innerHTML = `<p style="color:red">Something went wrong. Please try again.</p>`;
  } finally {
    askBtn.disabled = false;
    loading.hidden = true;
  }
}

function formatMarkdown(text) {
  // Video cards — must run BEFORE HTML escaping
  text = text.replace(
    /\[VIDEO:\s*(https?:\/\/[^\s|]+)\s*\|\s*([^\]]+)\]/g,
    (_, url, title) =>
      `<div class="video-card"><video controls preload="none"><source src="${url}" type="video/mp4"></video><span class="video-label">${title.trim()}</span></div>`
  );

  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Restore video cards after escaping (they were already safe HTML)
  html = html.replace(/&lt;div class="video-card"&gt;[\s\S]*?&lt;\/div&gt;/g, (m) =>
    m.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
  );

  html = html.replace(/^###\s+(.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^##\s+(.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^#\s+(.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  html = html.replace(/^(\d+)\.\s+(.+)$/gm, "<li>$2</li>");
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, "<ol>$1</ol>");
  html = html.replace(/^[-*]\s+(.+)$/gm, "<ul-item>$1</ul-item>");
  html = html.replace(/((?:<ul-item>.*<\/ul-item>\n?)+)/g, (m) =>
    "<ul>" + m.replace(/<ul-item>(.*?)<\/ul-item>/g, "<li>$1</li>") + "</ul>"
  );
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
