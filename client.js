const questionInput = document.getElementById("questionInput");
const askBtn = document.getElementById("askBtn");
const micBtn = document.getElementById("micBtn");
const chatThread = document.getElementById("chatThread");
const loading = document.getElementById("loading");
const welcomeSection = document.getElementById("welcomeSection");
const newChatBtn = document.getElementById("newChatBtn");

// ── Section Configurations ──
const SECTIONS = {
  general: {
    title: "How can I help you explore the ICL?",
    subtitle: "Ask about lab access, policies, equipment, or staff assistance.",
    placeholder: "Ask about lab equipment, safety, 24/7 access...",
    suggestions: [
      { prompt: "What equipment and tools does the ICL have?", label: "What's in the lab?" },
      { prompt: "What are the safety rules and policies in the lab?", label: "Safety & policies" },
      { prompt: "Where is Plank 117 and how do I get 24/7 card access?", label: "24/7 lab access" },
      { prompt: "Who are the lab directors and staff at the ICL?", label: "Contact lab staff" },
    ]
  },
  "3d-printing": {
    title: "What would you like to 3D print?",
    subtitle: "Ender 3 V3 KE guide — slicing, filament change & troubleshooting.",
    placeholder: "Ask about 3D printing, filament, bed adhesion, slicing...",
    suggestions: [
      { prompt: "How do I 3D print something at the ICL?", label: "How to 3D print" },
      { prompt: "How do I load or change filament on the Ender 3 V3 KE?", label: "Change filament" },
      { prompt: "My 3D print is not sticking to the bed — how to fix?", label: "Fix bed adhesion" },
      { prompt: "How do I slice an STL file in Creality Print?", label: "Slicing guide" },
      { prompt: "What 3D printer materials and filaments are allowed?", label: "Allowed materials" },
    ]
  },
  embroidery: {
    title: "What would you like to embroider?",
    subtitle: "Janome Memory Craft 550E — hooping, digitizing, stabilizers & threading.",
    placeholder: "Ask about embroidery, hooping, stabilizers, threading...",
    suggestions: [
      { prompt: "How do I embroider a hoodie step by step?", label: "Embroider a hoodie" },
      { prompt: "How do I thread the Janome MC550E embroidery machine?", label: "Thread the machine" },
      { prompt: "Which stabilizer and needle should I use for a stretchy shirt?", label: "Stabilizer & needle matrix" },
      { prompt: "How do I convert an image to .JEF in Artistic Digitizer?", label: "Convert to .JEF" },
      { prompt: "Why is thread bunching up underneath my fabric (birdnesting)?", label: "Fix thread bunching" },
    ]
  }
};

let activeSection = "general";

// In-memory state for each section
const sectionState = {
  general: {
    conversationHistory: [],
    messages: [], // stores { type: 'user'|'assistant'|'guide_prompt', content, isFullGuide, rawData }
  },
  "3d-printing": {
    conversationHistory: [],
    messages: [],
  },
  embroidery: {
    conversationHistory: [],
    messages: [],
  }
};

// ── Voice input ──
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  const recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (e) => {
    questionInput.value = e.results[0][0].transcript;
    questionInput.dispatchEvent(new Event("input")); // trigger auto-resize
    micBtn.classList.remove("listening");
  };
  recognition.onspeechend = () => recognition.stop();
  recognition.onerror = () => micBtn.classList.remove("listening");

  micBtn.addEventListener("click", () => {
    micBtn.classList.toggle("listening");
    micBtn.classList.contains("listening") ? recognition.start() : recognition.stop();
  });
} else {
  micBtn.style.display = "none";
}

// ── Render Welcome Section ──
function renderWelcome(sectionId) {
  const config = SECTIONS[sectionId] || SECTIONS.general;
  welcomeSection.querySelector("h2").textContent = config.title;
  welcomeSection.querySelector("p").textContent = config.subtitle;
  const pillsContainer = welcomeSection.querySelector(".welcome-suggestions");
  pillsContainer.innerHTML = "";
  config.suggestions.forEach((s) => {
    const btn = document.createElement("button");
    btn.className = "suggestion-pill";
    btn.dataset.prompt = s.prompt;
    btn.textContent = s.label;
    btn.addEventListener("click", () => {
      questionInput.value = s.prompt;
      questionInput.focus();
      questionInput.dispatchEvent(new Event("input"));
    });
    pillsContainer.appendChild(btn);
  });
}

// ── Switch Active Section ──
let activeItemElement = document.querySelector(".machine-item.active") || document.querySelector(".machine-item");

function switchSection(sectionId, targetPrompt = null, clickedItem = null) {
  if (!SECTIONS[sectionId]) return;
  activeSection = sectionId;

  // Update active sidebar item — highlight ONLY the single active button
  if (clickedItem) {
    activeItemElement = clickedItem;
  } else if (!activeItemElement || activeItemElement.dataset.section !== sectionId) {
    activeItemElement = document.querySelector(`.machine-item[data-section="${sectionId}"]`);
  }

  document.querySelectorAll(".machine-item").forEach((btn) => {
    btn.classList.toggle("active", btn === activeItemElement);
  });

  // Update placeholder
  questionInput.placeholder = SECTIONS[sectionId].placeholder;

  // Re-render chat thread for this section
  renderCurrentSectionChat();

  if (targetPrompt) {
    questionInput.value = targetPrompt;
    questionInput.focus();
    questionInput.dispatchEvent(new Event("input"));
  }
}

function renderCurrentSectionChat() {
  const state = sectionState[activeSection];
  
  // Remove all message elements (keep welcomeSection)
  Array.from(chatThread.children).forEach((el) => {
    if (el.id !== "welcomeSection") el.remove();
  });

  renderWelcome(activeSection);

  if (state.messages.length === 0) {
    welcomeSection.hidden = false;
    newChatBtn.classList.remove("visible");
  } else {
    welcomeSection.hidden = true;
    newChatBtn.classList.add("visible");

    // Reconstruct messages for this section
    state.messages.forEach((msg) => {
      if (msg.type === "user") {
        const div = document.createElement("div");
        div.className = "user-bubble";
        div.textContent = msg.content;
        chatThread.appendChild(div);
      } else if (msg.type === "guide_prompt") {
        renderStoredGuideOptions(msg.originalQuery, msg.selectedMode);
      } else if (msg.type === "assistant") {
        const wrapper = document.createElement("div");
        wrapper.className = "assistant-message";
        wrapper.innerHTML = `
          <div class="answer-header">
            <div class="assistant-tag"><span class="dot"></span>Jack</div>
            <button class="copy-btn" type="button">Copy</button>
          </div>
          <div class="answer-content">${formatMarkdown(msg.content)}</div>
        `;
        wrapper.querySelector(".copy-btn").addEventListener("click", (e) => {
          const content = wrapper.querySelector(".answer-content");
          navigator.clipboard.writeText(content.innerText);
          e.target.textContent = "Copied!";
          setTimeout(() => (e.target.textContent = "Copy"), 2000);
        });

        if (msg.feedbackPayload) {
          attachFeedbackControls(wrapper, msg.feedbackPayload);
        }

        const hasMultipleSteps = /step\s*[23456789]/i.test(msg.content) || (msg.content.match(/\n\d+\./g) || []).length >= 3;
        if (msg.isFullGuide && hasMultipleSteps) {
          const dlBtn = document.createElement("button");
          dlBtn.className = "download-btn";
          dlBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Save as PDF`;
          dlBtn.addEventListener("click", () => printGuide(msg.content));
          wrapper.appendChild(dlBtn);
        }

        chatThread.appendChild(wrapper);
      }
    });

    chatThread.scrollTop = chatThread.scrollHeight;
  }
}

// ── Sidebar Click Handling ──
document.querySelectorAll(".machine-item").forEach((item) => {
  item.addEventListener("click", () => {
    const section = item.dataset.section || "general";
    const prompt = item.dataset.prompt || "";
    switchSection(section, prompt, item);
  });
});

// ── New Chat (clears only active section) ──
newChatBtn.addEventListener("click", () => {
  sectionState[activeSection].conversationHistory = [];
  sectionState[activeSection].messages = [];
  renderCurrentSectionChat();
  questionInput.value = "";
  questionInput.style.height = "auto";
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
  if (/laser|glowforge|cnc|router|resin|formlabs|lathe|soldering|iron|cricut|vinyl cutter/i.test(q)) return false;
  if (/error|fix|broken|not working|failed|stuck|wrong|issue|problem|clog|remove|take off|peel|unstuck|detach|snap|break|birdnest|pucker|where is|location|what is|find/i.test(q)) return false;
  const patterns = [
    /how (do|can|should) i (use|make|create|3d\s?print|print|start|begin|do|embroider|sew|stitch|digitize)\s+\w/i,
    /how to (use|make|create|3d\s?print|print|start|embroider|sew|stitch|digitize)\s+\w/i,
    /walk me through\s+\w/i,
    /i want to (make|create|print|3d\s?print|build|use|embroider|sew|stitch|digitize)\s+\w/i,
    /i('d like| would like) to (make|create|print|3d\s?print|build|embroider|sew|stitch|digitize)\s+\w/i,
    /help me (make|create|print|build|embroider|sew|stitch|digitize)\s+\w/i,
    /help me use the\s+\w/i,
    /get started (with|on)\s+\w/i,
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

  sectionState[activeSection].messages.push({
    type: "user",
    content: text,
  });
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
  return { contentEl: wrapper.querySelector(".answer-content"), wrapperEl: wrapper };
}

// ── Guide Options Prompt ──
function showGuideOptions(originalQuery) {
  const msgRecord = {
    type: "guide_prompt",
    originalQuery,
    selectedMode: null,
  };
  sectionState[activeSection].messages.push(msgRecord);

  renderStoredGuideOptions(originalQuery, null, msgRecord);
}

function renderStoredGuideOptions(originalQuery, selectedMode = null, msgRecordRef = null) {
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

  if (selectedMode) {
    wrapper.querySelectorAll(".guide-option").forEach((b) => {
      b.disabled = true;
      if (b.dataset.mode === selectedMode) {
        b.style.opacity = "1";
        b.style.borderColor = "var(--orange)";
        b.style.background = "#fff5f0";
      } else {
        b.style.opacity = "0.45";
        b.style.cursor = "default";
      }
    });
    return;
  }

  wrapper.querySelectorAll(".guide-option").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const mode = btn.dataset.mode;
      if (msgRecordRef) msgRecordRef.selectedMode = mode;

      wrapper.querySelectorAll(".guide-option").forEach((b) => {
        b.disabled = true;
        b.style.opacity = "0.45";
        b.style.cursor = "default";
      });
      btn.style.opacity = "1";
      btn.style.borderColor = "var(--orange)";
      btn.style.background = "#fff5f0";

      const userMessage =
        mode === "steps"
          ? `${originalQuery} — Please walk me through this one step at a time. Give me only Step 1 first, then wait for me to say "next" before continuing to the next step.`
          : `${originalQuery} — Give me the COMPLETE guide with ALL steps right now in one response. Do NOT stop after Step 1. Do NOT wait for me to say "next". Ignore any previous step-by-step instructions. Show every step from start to finish.`;

      sectionState[activeSection].conversationHistory.push({ role: "user", content: userMessage });
      await streamFromAPI(mode === "full");
    });
  });
}

// ── Core streaming logic ──
async function streamFromAPI(isFullGuide = false) {
  askBtn.disabled = true;
  loading.hidden = false;
  const currentHistory = sectionState[activeSection].conversationHistory;
  const questionForFeedback = [...currentHistory].reverse().find((m) => m.role === "user")?.content || "";
  const conversationForFeedback = currentHistory.slice();

  try {
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: currentHistory, section: activeSection }),
    });

    if (!res.ok) throw new Error("Server error");

    loading.hidden = true;
    const { contentEl, wrapperEl } = appendAssistantBubble();

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
          contentEl.innerHTML = formatMarkdownStreaming(fullText);
          contentEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
        } catch {}
      }
    }

    contentEl.innerHTML = formatMarkdown(fullText);
    currentHistory.push({ role: "assistant", content: fullText });

    const feedbackPayload = {
      question: questionForFeedback,
      answer: fullText,
      conversation: conversationForFeedback,
    };

    attachFeedbackControls(wrapperEl, feedbackPayload);

    const hasMultipleSteps = /step\s*[23456789]/i.test(fullText) || (fullText.match(/\n\d+\./g) || []).length >= 3;
    if (isFullGuide && hasMultipleSteps) {
      const dlBtn = document.createElement("button");
      dlBtn.className = "download-btn";
      dlBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Save as PDF`;
      dlBtn.addEventListener("click", () => printGuide(fullText));
      wrapperEl.appendChild(dlBtn);
    }

    // Record assistant message in section state
    sectionState[activeSection].messages.push({
      type: "assistant",
      content: fullText,
      isFullGuide,
      feedbackPayload,
    });

    wrapperEl.scrollIntoView({ behavior: "smooth", block: "end" });
  } catch (err) {
    loading.hidden = true;
    const { contentEl } = appendAssistantBubble();
    contentEl.innerHTML = `<p style="color:red">Something went wrong. Please try again.</p>`;
  } finally {
    askBtn.disabled = false;
    loading.hidden = true;
  }
}

function attachFeedbackControls(wrapperEl, payload) {
  const feedback = document.createElement("div");
  feedback.className = "feedback-row";
  feedback.innerHTML = `
    <span class="feedback-label">Was this response useful?</span>
    <button class="feedback-btn" type="button" data-rating="helpful">Helpful</button>
    <button class="feedback-btn" type="button" data-rating="unhelpful">Not helpful</button>
    <span class="feedback-status" aria-live="polite"></span>
  `;

  feedback.querySelectorAll(".feedback-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const rating = btn.dataset.rating;
      const status = feedback.querySelector(".feedback-status");
      feedback.querySelectorAll(".feedback-btn").forEach((b) => {
        b.disabled = true;
        b.classList.toggle("selected", b === btn);
      });
      status.textContent = "Saving...";

      try {
        const res = await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, rating }),
        });
        if (!res.ok) throw new Error("Feedback save failed");
        status.textContent = "Thanks, saved.";
      } catch {
        status.textContent = "Could not save.";
        feedback.querySelectorAll(".feedback-btn").forEach((b) => {
          b.disabled = false;
          b.classList.remove("selected");
        });
      }
    });
  });

  wrapperEl.appendChild(feedback);
}

function printGuide(markdownText) {
  const html = formatMarkdown(markdownText);
  const win = window.open("", "_blank");
  if (!win) {
    alert("Please allow popups for this site to save the guide as PDF.");
    return;
  }
  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>ICL Lab Guide — Jack</title>
      <style>
        body { font-family: "Segoe UI", system-ui, sans-serif; max-width: 700px; margin: 40px auto; padding: 0 24px; color: #111; font-size: 14px; line-height: 1.7; }
        h1 { font-size: 18px; color: #0d1b6e; border-bottom: 2px solid #f26522; padding-bottom: 8px; margin-bottom: 24px; }
        h3 { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #0d1b6e; margin: 20px 0 8px; padding-left: 8px; border-left: 3px solid #f26522; }
        ol, ul { padding-left: 20px; margin: 8px 0 12px; }
        li { margin-bottom: 6px; }
        strong { color: #0d1b6e; }
        .footer { margin-top: 40px; font-size: 11px; color: #999; border-top: 1px solid #eee; padding-top: 12px; }
        video, img { display: none; }
        .media-label { font-style: italic; color: #666; font-size: 12px; display: block; margin: 4px 0 12px; }
        @media print { body { margin: 20px; } }
      </style>
    </head>
    <body>
      <h1>ICL Lab Guide</h1>
      ${html}
      <div class="footer">Generated by Jack · Innovation &amp; Creativity Lab · Gettysburg College</div>
    </body>
    </html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

function lastAssistantAskedClarification() {
  const currentHistory = sectionState[activeSection].conversationHistory;
  const lastAssistant = [...currentHistory].reverse().find((m) => m.role === "assistant");
  if (!lastAssistant) return false;
  return /what (are you trying|would you like|do you want) to (make|print|cut|build|create|embroider|sew)|what (machine|equipment)|have (a machine|something) in mind/i.test(lastAssistant.content);
}

async function isTaskReply(query) {
  try {
    const res = await fetch("/api/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: query }),
    });
    if (!res.ok) return false;
    const { isTask } = await res.json();
    return isTask === true;
  } catch {
    return false;
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
  } else if (lastAssistantAskedClarification()) {
    loading.hidden = false;
    const task = await isTaskReply(question);
    loading.hidden = true;
    if (task) {
      showGuideOptions(question);
    } else {
      sectionState[activeSection].conversationHistory.push({ role: "user", content: question });
      await streamFromAPI();
    }
  } else {
    sectionState[activeSection].conversationHistory.push({ role: "user", content: question });
    await streamFromAPI();
  }
}

function formatMarkdownStreaming(text) {
  text = text.replace(/\[VIDEO:\s*(?:https?:\/\/[^\s|]+|\/[^\s|]+)\s*\|\s*([^\]]+)\]/g, "▶ $1");
  text = text.replace(/\[IMAGE:\s*(?:https?:\/\/[^\s|]+|\/[^\s|]+)\s*\|\s*([^\]]+)\]/g, "🖼 $1");
  text = text.replace(/\[VIDEO:[^\]]*$/, "");
  text = text.replace(/\[IMAGE:[^\]]*$/, "");
  return formatMarkdown(text);
}

function formatMarkdown(text) {
  const media = [];
  text = text.replace(
    /\[VIDEO:\s*(https?:\/\/[^\s|]+|\/[^\s|]+)\s*\|\s*([^\]]+)\]/g,
    (_, url, title) => {
      const idx = media.length;
      media.push(`<div class="video-card"><video controls preload="metadata" playsinline onloadedmetadata="this.closest('.video-card').classList.toggle('portrait',this.videoHeight>this.videoWidth)"><source src="${url}" type="video/mp4"></video><span class="media-label">▶ ${title.trim()}</span></div>`);
      return `%%MEDIA_${idx}%%`;
    }
  );
  text = text.replace(
    /\[IMAGE:\s*(https?:\/\/[^\s|]+|\/[^\s|]+)\s*\|\s*([^\]]+)\]/g,
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
  html = html.replace(/^\d+\.\s*$/gm, "");
  html = html.replace(/^(\d+)\.\s+(.+)$/gm, "<li>$2</li>");
  html = html.replace(/(?:<li>.*?<\/li>\s*)+/g, (m) => "<ol>" + m.trim() + "</ol>");
  html = html.replace(/^[-*]\s+(.+)$/gm, "<ul-item>$1</ul-item>");
  html = html.replace(/(?:<ul-item>.*?<\/ul-item>\s*)+/g, (m) =>
    "<ul>" + m.trim().replace(/<ul-item>(.*?)<\/ul-item>/g, "<li>$1</li>") + "</ul>"
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

// Initial setup
renderWelcome(activeSection);
