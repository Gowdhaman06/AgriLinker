// ============================================================
// AgriLinker — Messaging Controller (Supabase Realtime-backed)
// Real-time messages via Supabase Postgres Changes subscription
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {

  // ── Auth Guard ───────────────────────────────────────────────
  const currentUser = await App.fetchCurrentUser();
  if (!currentUser) { window.location.href = "auth.html"; return; }

  // ── DOM ──────────────────────────────────────────────────────
  const threadsContainer  = document.getElementById("threads-container");
  const messagesContainer = document.getElementById("chat-messages-container");
  const headerAvatar      = document.getElementById("chat-header-avatar");
  const headerName        = document.getElementById("chat-header-name");
  const headerRole        = document.getElementById("chat-header-role");
  const chatForm          = document.getElementById("chat-send-form");
  const chatInput         = document.getElementById("chat-input-field");
  const sendBtn           = document.getElementById("chat-send-btn");

  let allMessages       = [];
  let allProfiles       = {};  // id → profile
  let activeThreadUserId = null;
  let realtimeChannel    = null;

  // ── Load all messages for current user ──────────────────────
  async function loadMessages() {
    allMessages = await DB.getMessages(currentUser.id);
    renderThreads();
  }

  // ── Build profile lookup map from message participants ───────
  async function buildProfileMap() {
    const ids = new Set();
    allMessages.forEach(m => {
      if (m.sender_id)   ids.add(m.sender_id);
      if (m.receiver_id) ids.add(m.receiver_id);
    });

    // Also include chat_with param
    const urlParams   = new URLSearchParams(window.location.search);
    const chatWithParam = urlParams.get("chat_with");
    if (chatWithParam) ids.add(chatWithParam);

    ids.delete(currentUser.id);

    for (const id of ids) {
      if (!allProfiles[id]) {
        const profile = await DB.getProfile(id);
        if (profile) allProfiles[id] = profile;
      }
    }
  }

  // ── 1. Render conversation threads list ─────────────────────
  async function renderThreads() {
    await buildProfileMap();
    threadsContainer.innerHTML = "";

    const participantIds = new Set();
    allMessages.forEach(m => {
      if (m.sender_id   === currentUser.id) participantIds.add(m.receiver_id);
      if (m.receiver_id === currentUser.id) participantIds.add(m.sender_id);
    });

    // Include URL param participant
    const urlParams     = new URLSearchParams(window.location.search);
    const chatWithParam = urlParams.get("chat_with");
    if (chatWithParam && chatWithParam !== currentUser.id) participantIds.add(chatWithParam);

    const participants = Array.from(participantIds).map(pid =>
      allProfiles[pid] || { id: pid, name: "AgriLinker Member", role: "user" }
    );

    if (participants.length === 0) {
      threadsContainer.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--text-muted);font-size:0.9rem;">No active conversations.</div>`;
      return;
    }

    participants.forEach(p => {
      const threadMsgs = allMessages
        .filter(m =>
          (m.sender_id === currentUser.id && m.receiver_id === p.id) ||
          (m.sender_id === p.id && m.receiver_id === currentUser.id)
        )
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

      const lastMsg    = threadMsgs[threadMsgs.length - 1];
      const previewText = lastMsg ? lastMsg.content : "Tap to open chat...";
      const unread     = threadMsgs.filter(m => m.receiver_id === currentUser.id && !m.read).length;

      const threadDiv  = document.createElement("div");
      threadDiv.className = `thread-item ${activeThreadUserId === p.id ? "active" : ""}`;
      threadDiv.setAttribute("data-id", p.id);

      threadDiv.innerHTML = `
        <div class="thread-avatar">${(p.name || "?").charAt(0)}</div>
        <div class="thread-details">
          <div class="thread-name">
            ${p.name}
            <span class="badge ${p.role === "farmer" ? "badge-success" : "badge-accent"}"
              style="font-size:0.6rem;padding:0.1rem 0.3rem;margin-left:0.25rem;">
              ${(p.role || "user").toUpperCase()}
            </span>
            ${unread > 0 ? `<span style="margin-left:auto;background:var(--lime);color:#000;border-radius:999px;padding:0.1rem 0.45rem;font-size:0.65rem;font-weight:700;">${unread}</span>` : ""}
          </div>
          <div class="thread-preview">${previewText}</div>
        </div>`;

      threadDiv.addEventListener("click", () => openConversation(p.id));
      threadsContainer.appendChild(threadDiv);
    });
  }

  // ── 2. Open a conversation ───────────────────────────────────
  async function openConversation(participantId) {
    activeThreadUserId = participantId;

    document.querySelectorAll(".thread-item").forEach(item => {
      item.classList.toggle("active", item.getAttribute("data-id") === participantId);
    });

    // Fetch profile if not cached
    if (!allProfiles[participantId]) {
      const p = await DB.getProfile(participantId);
      if (p) allProfiles[participantId] = p;
    }

    const threadUser = allProfiles[participantId] || { name: "AgriLinker Member", role: "user" };
    headerAvatar.textContent = (threadUser.name || "?").charAt(0);
    headerName.textContent   = threadUser.name || "AgriLinker Member";
    headerRole.textContent   = (threadUser.role || "user").toUpperCase();

    chatInput.disabled = false;
    sendBtn.disabled   = false;

    // Mark messages as read
    await DB.markMessagesRead(currentUser.id, participantId);
    allMessages = allMessages.map(m =>
      m.sender_id === participantId && m.receiver_id === currentUser.id ? { ...m, read: true } : m
    );

    renderMessages();
    renderThreads();
  }

  // ── 3. Render message bubbles ────────────────────────────────
  function renderMessages() {
    if (!activeThreadUserId) return;
    messagesContainer.innerHTML = "";

    const threadMsgs = allMessages
      .filter(m =>
        (m.sender_id === currentUser.id && m.receiver_id === activeThreadUserId) ||
        (m.sender_id === activeThreadUserId && m.receiver_id === currentUser.id)
      )
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    if (threadMsgs.length === 0) {
      messagesContainer.innerHTML = `<div style="margin:auto;text-align:center;color:var(--text-muted);font-size:0.9rem;">No messages yet. Say hello! 👋</div>`;
      return;
    }

    threadMsgs.forEach(m => {
      const bubble   = document.createElement("div");
      const isSent   = m.sender_id === currentUser.id;
      bubble.className = `msg-bubble ${isSent ? "msg-sent" : "msg-received"}`;

      const timeStr  = new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      bubble.innerHTML = `<div>${m.content}</div><div class="msg-time">${timeStr}</div>`;
      messagesContainer.appendChild(bubble);
    });

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // ── 4. Send message ──────────────────────────────────────────
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const content = chatInput.value.trim();
    if (!content || !activeThreadUserId) return;

    chatInput.value = "";
    chatInput.disabled = true;

    const sent = await DB.sendMessage(currentUser.id, activeThreadUserId, content);
    if (sent) {
      allMessages.push(sent);
      renderMessages();
      renderThreads();
    }

    chatInput.disabled = false;
    chatInput.focus();
  });

  // ── 5. Supabase Realtime subscription ───────────────────────
  function subscribeToMessages() {
    realtimeChannel = supabaseClient
      .channel("messages-realtime")
      .on(
        "postgres_changes",
        {
          event:  "INSERT",
          schema: "public",
          table:  "messages",
          filter: `receiver_id=eq.${currentUser.id}`
        },
        async (payload) => {
          const newMsg = payload.new;

          // Fetch sender profile if not cached
          if (!allProfiles[newMsg.sender_id]) {
            const profile = await DB.getProfile(newMsg.sender_id);
            if (profile) allProfiles[newMsg.sender_id] = profile;
          }

          allMessages.push(newMsg);

          // Re-render if conversation is active
          if (activeThreadUserId === newMsg.sender_id) {
            renderMessages();
            await DB.markMessagesRead(currentUser.id, newMsg.sender_id);
          } else {
            const senderName = allProfiles[newMsg.sender_id]?.name || "Someone";
            App.showToast(`New message from ${senderName}`);
          }

          renderThreads();
        }
      )
      .subscribe();
  }

  // ── Init ─────────────────────────────────────────────────────
  await loadMessages();
  subscribeToMessages();

  // Open chat from URL param
  const urlParams     = new URLSearchParams(window.location.search);
  const chatWithParam = urlParams.get("chat_with");
  if (chatWithParam) {
    await openConversation(chatWithParam);
  }
});
