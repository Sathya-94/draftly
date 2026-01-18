const API_BASE = window.API_BASE || "http://localhost:4000/api";

window.onload = () => {
  // Elements
  const loginSection = document.getElementById("login-section");
  const mailboxSection = document.getElementById("mailbox-section");
  const loginBtnHero = document.getElementById("login-btn-hero");
  const logoutBtn = document.getElementById("logout-btn");
  const sidebarToggle = document.getElementById("sidebar-toggle");
  const sidebarPanel = document.getElementById("sidebar-panel");
  const mainPane = document.getElementById("main-pane");
  const emailList = document.getElementById("email-list");
  const emailViewer = document.getElementById("email-viewer");
  const emptyViewer = document.getElementById("empty-viewer");
  const emailSubject = document.getElementById("email-subject");
  const emailBody = document.getElementById("email-body");
  const emailFrom = document.getElementById("email-from");
  const emailTo = document.getElementById("email-to");
  const emailDate = document.getElementById("email-date");
  const draftBody = document.getElementById("draft-body");
  const approveBtn = document.getElementById("approve-btn");
  const rejectBtn = document.getElementById("reject-btn");
  const draftActionsFab = document.getElementById("draft-actions-fab");

  const sendBtn = document.getElementById("send-btn");
  const saveBtn = document.getElementById("save-btn");
  const generateBtn = document.getElementById("generate-btn");
  const toneSelect = document.getElementById("tone-select");
  const toastContainer = document.getElementById("toast-container");
  const generateSpinner = document.getElementById("generate-spinner");
  const saveSpinner = document.getElementById("save-spinner");
  const sendSpinner = document.getElementById("send-spinner");
  let currentEmail = null; // track selected email
  let currentDraft = null;
  const baseEmailItemClass = "email-item p-3 cursor-pointer hover:bg-indigo-50 transition rounded-lg mx-2";
  let selectedEmailItem = null;

  function renderEmailHtml(htmlContent, fallbackText) {
    emailBody.innerHTML = "";
    const iframe = document.createElement("iframe");
    iframe.setAttribute("sandbox", "allow-same-origin allow-popups");
    iframe.className = "w-full h-full";
    const safeHtml =
      htmlContent ||
      (fallbackText ? fallbackText.replace(/\n/g, "<br>") : "(no content)");
    const doc = `
      <html>
        <head>
          <base target="_blank" />
          <style>
            :root { color-scheme: light; }
            body { margin: 0; font-family: "Inter", system-ui, -apple-system, sans-serif; line-height: 1.6; padding: 12px; color: #0f172a; }
            img { max-width: 100%; height: auto; }
            table { width: 100%; border-collapse: collapse; }
            p { margin: 0 0 0.75rem 0; }
            a { color: #4f46e5; }
          </style>
        </head>
        <body>${safeHtml}</body>
      </html>`;
    iframe.srcdoc = doc;
    emailBody.appendChild(iframe);
  }

  // Initial state
  emailViewer.classList.add("hidden");

  // Token helpers
  function setTokens({ accessToken, refreshToken }) {
    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("refreshToken", refreshToken);
  }
  function getAccessToken() { return localStorage.getItem("accessToken"); }
  function getRefreshToken() { return localStorage.getItem("refreshToken"); }
  function clearTokens() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
  }

  function showToast(message, type = "info") {
    if (!toastContainer) {
      alert(message);
      return;
    }
    const toast = document.createElement("div");
    const toneClass = type === "success" ? "success" : type === "error" ? "error" : "info";
    toast.className = `toast ${toneClass}`;
    toast.innerHTML = `
      <span class="text-lg">${type === "success" ? "✅" : type === "error" ? "⚠️" : "ℹ️"}</span>
      <div class="flex-1 leading-snug">${message}</div>
    `;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.classList.add("opacity-0", "transition", "duration-300");
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function toggleAuthUI(isAuthed) {
    if (isAuthed) {
      logoutBtn.classList.remove("hidden");
      if (loginBtnHero) loginBtnHero.classList.add("hidden");
    } else {
      logoutBtn.classList.add("hidden");
      if (loginBtnHero) loginBtnHero.classList.remove("hidden");
    }
  }

  // Refresh Draftly access token
  async function refreshAccessToken() {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken })
      });
      if (!res.ok) throw new Error("Refresh failed");
      const data = await res.json();
      if (data.accessToken) {
        localStorage.setItem("accessToken", data.accessToken);
        return true;
      }
    } catch (err) {
      console.error("Refresh error:", err);
      clearTokens();
      showLogin();
      return false;
    }
  }

  // Wrapper for API calls with auto-refresh
  async function apiFetch(path, options = {}) {
    // Ensure we always send a bearer token; refresh if missing/expired
    async function withToken() {
      let token = getAccessToken();
      if (!token) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) throw new Error("Unauthorized");
        token = getAccessToken();
      }
      return token;
    }

    let token = await withToken();

    let res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`
      }
    });

    if (res.status === 401) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) throw new Error("Unauthorized");
      token = getAccessToken();
      res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
          ...(options.headers || {}),
          Authorization: `Bearer ${token}`
        }
      });
    }

    if (!res.ok) throw new Error("Request failed");
    return res.json();
  }

  // Show login section
  function showLogin() {
    loginSection.classList.remove("hidden");
    mailboxSection.classList.add("hidden");
    toggleAuthUI(false);
  }

  // Show mailbox section
  function showMailbox() {
    loginSection.classList.add("hidden");
    mailboxSection.classList.remove("hidden");
    toggleAuthUI(true);
    emailViewer.classList.add("hidden");
    emptyViewer.classList.remove("hidden");
    loadEmails();
  }

  // Load emails
  async function loadEmails() {
    emailList.innerHTML = `<li class="p-4 flex justify-center"><div class="spinner"></div></li>`;
    selectedEmailItem = null;
    try {
      const emails = await apiFetch("/emails");
      emailList.innerHTML = "";
      emails.forEach(e => {
        const li = document.createElement("li");
        li.className = baseEmailItemClass;
        li.innerHTML = `
          <div class="flex items-center justify-between gap-3">
            <div class="font-semibold text-slate-800 line-clamp-1" title="${e.subject || "(no subject)"}">${e.subject || "(no subject)"}</div>
            <span class="text-xs text-slate-400 line-clamp-1" title="${e.from || ""}">${e.from || ""}</span>
          </div>
          <div class="text-sm text-slate-600 line-clamp-2" title="${e.snippet || ""}">${e.snippet || ""}</div>
        `;
        li.addEventListener("click", () => {
          if (selectedEmailItem) {
            selectedEmailItem.classList.remove("selected");
          }
          li.classList.add("selected");
          selectedEmailItem = li;
          showEmail(e);
        });
        emailList.appendChild(li);
      });
    } catch (err) {
      emailList.innerHTML = `<li class="text-red-500">${err.message}</li>`;
    }
  }

  // Show selected email + draft
  async function showEmail(email) {
    currentEmail = email;
    emailSubject.textContent = email.subject || "(no subject)";
    emailSubject.title = email.subject || "(no subject)";
    emailBody.innerHTML = `<div class="w-full h-full flex items-center justify-center"><div class="spinner"></div></div>`;
    emailFrom.textContent = "";
    emailTo.textContent = "";
    emailDate.textContent = "";
    emptyViewer.classList.add("hidden");
    emailViewer.classList.remove("hidden");

    let latestMessageId = email.id;

    try {
      const thread = await apiFetch(`/emails/${email.threadId || email.id}`);
      const messages = thread.messages || [];
      const latestMessage = messages[messages.length - 1] || messages[0];
      if (latestMessage) {
        latestMessageId = latestMessage.id;
        const htmlContent = latestMessage.html || latestMessage.bodyHtml;
        renderEmailHtml(htmlContent, latestMessage.body || latestMessage.snippet);
        emailFrom.textContent = latestMessage.from || "";
        emailTo.textContent = latestMessage.to ? `To: ${latestMessage.to}` : "";
        emailDate.textContent = latestMessage.date || "";
      } else {
        renderEmailHtml("", "(no content)");
      }
    } catch (err) {
      renderEmailHtml("", `Failed to load email: ${err.message}`);
    }

    try {
      const draft = await apiFetch(`/drafts?threadId=${email.threadId || email.id}&messageId=${latestMessageId}`);
      if (draft) {
        currentDraft = draft;
        draftBody.value = draft.body || "";
        approveBtn.onclick = () => updateDraftStatus(draft.id, "approved");
        rejectBtn.onclick = () => updateDraftStatus(draft.id, "rejected");
        saveBtn.onclick = () => saveDraft(draft.id, draftBody.value);
        sendBtn.onclick = () => sendDraft(draft.id);
      } else {
        currentDraft = null;
        draftBody.value = "";
        approveBtn.onclick = null;
        rejectBtn.onclick = null;
        saveBtn.onclick = null;
        sendBtn.onclick = null;
      }
      // Always wire generate button
      generateBtn.onclick = () => generateDraft(email.threadId || email.id, latestMessageId, toneSelect?.value);
    } catch (err) {
      currentDraft = null;
      draftBody.value = "";
      approveBtn.onclick = null;
      rejectBtn.onclick = null;
      saveBtn.onclick = null;
      sendBtn.onclick = null;
      generateBtn.onclick = () => generateDraft(email.threadId || email.id, latestMessageId, toneSelect?.value);
    }

    updateDraftActionsVisibility();
  }

// Generate draft via AI
async function generateDraft(threadId, messageId, toneOverride) {
  try {
    if (generateSpinner) generateSpinner.classList.remove("hidden");
    generateBtn?.setAttribute("disabled", "true");

    const tone = toneOverride || toneSelect?.value || "concise";
    // Stream tokens to the textarea for responsive UX
    const startStream = () => fetch(`${API_BASE}/drafts/generate/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getAccessToken()}`
      },
      body: JSON.stringify({
        threadId,
        messageId,
        tone
      })
    });

    let res = await startStream();
    if (res.status === 401) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) throw new Error("Unauthorized");
      res = await startStream();
    }

    if (!res.ok || !res.body) {
      throw new Error("Streaming failed to start");
    }

    draftBody.value = "";
    let buffer = "";
    let finalDraft = null;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() || "";

      for (const evt of events) {
        const line = evt.trim();
        if (!line.startsWith("data:")) continue;
        const data = line.replace(/^data:\s*/, "");
        if (data === "[DONE]") {
          reader.cancel();
          break;
        }
        try {
          const parsed = JSON.parse(data);
          if (parsed.token) {
            draftBody.value += parsed.token;
          }
          if (parsed.finalDraft) {
            finalDraft = parsed.finalDraft;
          }
          if (parsed.error) {
            throw new Error(parsed.error);
          }
        } catch (err) {
          // If not JSON, just append raw text
          draftBody.value += data;
        }
      }
    }

    if (finalDraft) {
      currentDraft = finalDraft;
      approveBtn.onclick = () => updateDraftStatus(finalDraft.id, "approved");
      rejectBtn.onclick = () => updateDraftStatus(finalDraft.id, "rejected");
      saveBtn.onclick = () => saveDraft(finalDraft.id, draftBody.value);
      sendBtn.onclick = () => sendDraft(finalDraft.id);
    }
    updateDraftActionsVisibility();
  } catch (err) {
    alert("Draft generation failed: " + err.message);
  } finally {
    if (generateSpinner) generateSpinner.classList.add("hidden");
    generateBtn?.removeAttribute("disabled");
  }
}


// Send draft
async function sendDraft(draftId) {
  try {
    if (sendSpinner) sendSpinner.classList.remove("hidden");
    sendBtn?.setAttribute("disabled", "true");

    const result = await apiFetch(`/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draftId })
    });
    handleSendResponse(result);
  } catch (err) {
    handleSendError(err);
  } finally {
    if (sendSpinner) sendSpinner.classList.add("hidden");
    sendBtn?.removeAttribute("disabled");
  }
}

function handleSendResponse(result) {
  if (result.status === "sent") {
    showToast("Draft sent successfully", "success");
    return;
  }
  if (result.status === "already_sent") {
    showToast("This draft was already sent.", "info");
    return;
  }
  showToast(`Send result: ${result.status || "unknown"}`, "info");
}


function handleSendError(err) {
  const message = err?.message || "";
  // Bubble up server messages if present
  if (message.includes("Draft not approved")) {
    showToast("Cannot send: draft is not approved.", "error");
    return;
  }
  if (message.includes("Draft is rejected")) {
    showToast("Cannot send: draft has been rejected.", "error");
    return;
  }
  showToast("Send failed: " + message, "error");
}


  // Update draft status
  async function updateDraftStatus(draftId, status) {
    const updated = await apiFetch(`/drafts/${draftId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    console.log("Draft updated:", updated);
  }

  // Save draft edits
async function saveDraft(draftId, body) {
    try {
      if (saveSpinner) saveSpinner.classList.remove("hidden");
      saveBtn?.setAttribute("disabled", "true");

      const updated = await apiFetch(`/drafts/${draftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body })
      });
      console.log("Draft saved:", updated);
      currentDraft = updated;
      showToast("Draft saved", "success");
      updateDraftActionsVisibility();
    } finally {
      if (saveSpinner) saveSpinner.classList.add("hidden");
      saveBtn?.removeAttribute("disabled");
    }
}

  // Listen for tokens via BroadcastChannel
  const channel = new BroadcastChannel("draftly-auth");
  channel.onmessage = (event) => {
    setTokens(event.data);
    showMailbox();
  };

  // Open popup on login click
  if (loginBtnHero) {
    loginBtnHero.addEventListener("click", () => {
      window.open(`${API_BASE}/auth/google`, "googleLogin", "width=500,height=600");
    });
  }

  // Sidebar collapse/expand
  if (sidebarToggle && sidebarPanel && mainPane) {
    let collapsed = false;
    sidebarToggle.addEventListener("click", () => {
      collapsed = !collapsed;
      if (collapsed) {
        sidebarPanel.classList.add("hidden", "lg:hidden");
        mainPane.classList.remove("lg:col-span-11");
        mainPane.classList.add("main-pane-expanded");
        sidebarToggle.title = "Expand sidebar";
      } else {
        sidebarPanel.classList.remove("hidden", "lg:hidden");
        mainPane.classList.remove("main-pane-expanded");
        mainPane.classList.add("lg:col-span-11");
        sidebarToggle.title = "Collapse sidebar";
      }
    });
  }

  // Logout
  logoutBtn.addEventListener("click", async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken })
      });
    }
    clearTokens();
    showLogin();
  });

  function updateDraftActionsVisibility() {
    const hasContent =
      draftBody.value.trim().length > 0 ||
      (currentDraft && (currentDraft.body || "").trim().length > 0);
    if (draftActionsFab) {
      draftActionsFab.classList.toggle("hidden", !hasContent);
    }
  }

  draftBody.addEventListener("input", updateDraftActionsVisibility);
};
