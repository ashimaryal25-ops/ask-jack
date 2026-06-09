const questionInput = document.getElementById("questionInput");
const askBtn = document.getElementById("askBtn");
const chatThread = document.getElementById("chatThread");
const loading = document.getElementById("loading");
const welcomeSection = document.getElementById("welcomeSection");
const newChatBtn = document.getElementById("newChatBtn");

let conversationHistory = [];

newChatBtn.addEventListener("click", () => {
  conversationHistory = [];
  Array.from(chatThread.children).forEach(el => {
    if (el.id !== "welcomeSection") el.remove();
  });
  welcomeSection.hidden = false;
  newChatBtn.classList.remove("visible");
  questionInput.value = "";
  questionInput.style.height = "auto";
});

document.querySelectorAll(".suggestion-pill").forEach((pill) => {
  pill.addEventListener("click", () => {
    questionInput.value = pill.dataset.prompt || pill.textContent.trim();
    questionInput.focus();
  });
});

document.querySelectorAll(".machine-item").forEach((item) => {
  item.addEventListener("click", () => {
    questionInput.value = item.dataset.prompt || "";
    questionInput.focus();
  });
});

// Auto-grow textarea
questionInput.addEventListener("input", () => {
  questionInput.style.height = "auto";
  questionInput.style.height = questionInput.scrollHeight + "px";
});

questionInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    askQuestion();
  }
});

askBtn.addEventListener("click", askQuestion);

// ── Detect guide-type requests ──
function isGuideRequest(query) {
  const q = query.toLowerCase().trim();
  // Don't intercept troubleshooting queries
  if (/error|fix|broken|not working|failed|stuck|wrong|issue|problem|clog/i.test(q)) return false;
  const patterns = [
    /how (do|can|should) i (use|make|create|3d\s?print|print|cut|start|begin|do)/i,
    /how to (use|make|create|3d\s?print|print|cut|start)/i,
    /walk me through/i,
    /i want to (make|create|print|3d\s?print|cut|build|use)/i,
    /i('d like| would like) to (make|create|print|3d\s?print|cut|build)/i,
    /help me (make|create|print|cut|build|use the)/i,
    /get started (with|on)/i,
    /where do i start/i,
  ];
  return patterns.some(p => p.test(q));
}

function appendUserBubble(text) {
  welcomeSection.hidden = true;
  newChatBtn.classList.add("visible");
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
      <div class="assistant-tag"><span class="dot"></span>Jack</div>
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

// ── Show guide mode options ──
function showGuideOptions(originalQuery) {
  const wrapper = document.createElement("div");
  wrapper.className = "assistant-message";
  wrapper.innerHTML = `
    <div class="answer-header">
      <div class="assistant-tag"><span class="dot"></span>Jack</div>
    </div>
    <div class="answer-content">
      <p style="margin-bottom:14px;color:#374151;">How would you like me to guide you?</p>
      <div class="guide-options">
        <button class="guide-option" data-mode="full">
          <span class="guide-option-icon">📋</span>
          <div>
            <div class="guide-option-title">Full Guide</div>
            <div class="guide-option-desc">Complete walkthrough — all steps at once</div>
          </div>
        </button>
        <button class="guide-option" data-mode="steps">
          <span class="guide-option-icon">🪜</span>
          <div>
            <div class="guide-option-title">Step by Step</div>
            <div class="guide-option-desc">One step at a time, at your own pace</div>
          </div>
        </button>
      </div>
    </div>
  `;
  chatThread.appendChild(wrapper);
  wrapper.scrollIntoView({ behavior: "smooth", block: "nearest" });

  wrapper.querySelectorAll(".guide-option").forEach(btn => {
    btn.addEventListener("click", async () => {
      const mode = btn.dataset.mode;
      // Lock options after selection
      wrapper.querySelectorAll(".guide-option").forEach(b => {
        b.disabled = true;
        b.style.opacity = "0.45";
        b.style.cursor = "default";
      });
      btn.style.opacity = "1";
      btn.style.borderColor = "var(--orange)";
      btn.style.background = "#fff5f0";

      const userMessage = mode === "steps"
        ? `${originalQuery} — Please walk me through this one step at a time. Give me only Step 1 first, then wait for me to say "next" before continuing to the next step.`
        : originalQuery;

      conversationHistory.push({ role: "user", content: userMessage });
      await streamFromAPI();
    });
  });
}

// ── Core streaming logic ──
async function streamFromAPI() {
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

async function askQuestion() {
  const question = questionInput.value.trim();
  if (!question) return;

  appendUserBubble(question);
  questionInput.value = "";
  questionInput.style.height = "auto";

  if (isGuideRequest(question)) {
    showGuideOptions(question);
  } else {
    conversationHistory.push({ role: "user", content: question });
    await streamFromAPI();
  }
}

function formatMarkdown(text) {
  const media = [];
  text = text.replace(
    /\[VIDEO:\s*(https?:\/\/[^\s|]+)\s*\|\s*([^\]]+)\]/g,
    (_, url, title) => {
      const idx = media.length;
      media.push(`<div class="video-card"><video controls preload="metadata" playsinline onloadedmetadata="this.closest('.video-card').classList.toggle('portrait',this.videoHeight>this.videoWidth)"><source src="${url}" type="video/mp4"></video><span class="media-label">▶ ${title.trim()}</span></div>`);
      return `%%MEDIA_${idx}%%`;
    }
  );
  text = text.replace(
    /\[IMAGE:\s*(https?:\/\/[^\s|]+)\s*\|\s*([^\]]+)\]/g,
    (_, url, caption) => {
      const idx = media.length;
      media.push(`<div class="image-card"><img src="${url}" alt="${caption.trim()}" loading="lazy"><span class="media-label">${caption.trim()}</span></div>`);
      return `%%MEDIA_${idx}%%`;
    }
  );

  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

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

  media.forEach((card, i) => {
    html = html.replace(`%%MEDIA_${i}%%`, card);
  });

  return html;
}
