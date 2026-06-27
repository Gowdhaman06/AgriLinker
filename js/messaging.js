// Messaging UI controller and simulated response bots
document.addEventListener("DOMContentLoaded", () => {
  const currentUser = App.getCurrentUser();
  if (!currentUser) {
    window.location.href = "auth.html";
    return;
  }

  let messages = JSON.parse(localStorage.getItem("agrilinker_messages") || "[]");
  const users = JSON.parse(localStorage.getItem("agrilinker_users") || "[]");

  // DOM bindings
  const threadsContainer = document.getElementById("threads-container");
  const messagesContainer = document.getElementById("chat-messages-container");
  const headerAvatar = document.getElementById("chat-header-avatar");
  const headerName = document.getElementById("chat-header-name");
  const headerRole = document.getElementById("chat-header-role");
  
  const chatForm = document.getElementById("chat-send-form");
  const chatInput = document.getElementById("chat-input-field");
  const sendBtn = document.getElementById("chat-send-btn");

  let activeThreadUserId = null;

  // 1. Group messages into thread list
  function renderThreads() {
    threadsContainer.innerHTML = "";
    
    // Find all users the current user has chatted with
    const participantIds = new Set();
    messages.forEach(msg => {
      if (msg.senderId === currentUser.id) {
        participantIds.add(msg.receiverId);
      } else if (msg.receiverId === currentUser.id) {
        participantIds.add(msg.senderId);
      }
    });

    // If query param is present, add that user too
    const urlParams = new URLSearchParams(window.location.search);
    const chatWithParam = urlParams.get("chat_with");
    if (chatWithParam && chatWithParam !== currentUser.id) {
      participantIds.add(chatWithParam);
    }

    const participants = Array.from(participantIds).map(pid => {
      return users.find(u => u.id === pid) || { id: pid, name: "AgriLinker Member", role: "user" };
    });

    if (participants.length === 0) {
      threadsContainer.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.9rem;">No active conversations.</div>`;
      return;
    }

    participants.forEach(p => {
      const threadMsgs = messages.filter(m => 
        (m.senderId === currentUser.id && m.receiverId === p.id) ||
        (m.senderId === p.id && m.receiverId === currentUser.id)
      ).sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));

      const lastMsg = threadMsgs[threadMsgs.length - 1];
      const previewText = lastMsg ? lastMsg.content : "Tap to open chat...";

      const threadDiv = document.createElement("div");
      threadDiv.className = `thread-item ${activeThreadUserId === p.id ? 'active' : ''}`;
      threadDiv.setAttribute("data-id", p.id);
      
      threadDiv.innerHTML = `
        <div class="thread-avatar">${p.name.charAt(0)}</div>
        <div class="thread-details">
          <div class="thread-name">${p.name} <span class="badge ${p.role === 'farmer' ? 'badge-success' : 'badge-accent'}" style="font-size:0.6rem; padding:0.1rem 0.3rem; margin-left:0.25rem;">${p.role.toUpperCase()}</span></div>
          <div class="thread-preview">${previewText}</div>
        </div>
      `;

      threadDiv.addEventListener("click", () => {
        openConversation(p.id);
      });

      threadsContainer.appendChild(threadDiv);
    });
  }

  // 2. Open active conversation details
  function openConversation(participantId) {
    activeThreadUserId = participantId;
    
    // Highlight correct thread list item
    document.querySelectorAll(".thread-item").forEach(item => {
      if (item.getAttribute("data-id") === participantId) {
        item.classList.add("active");
      } else {
        item.classList.remove("active");
      }
    });

    const threadUser = users.find(u => u.id === participantId) || { name: "AgriLinker Member", role: "user" };

    // Update Header
    headerAvatar.textContent = threadUser.name.charAt(0);
    headerName.textContent = threadUser.name;
    headerRole.textContent = threadUser.role.toUpperCase();

    // Enable inputs
    chatInput.disabled = false;
    sendBtn.disabled = false;

    renderMessages();
  }

  // 3. Render messages bubbles
  function renderMessages() {
    if (!activeThreadUserId) return;

    messagesContainer.innerHTML = "";

    const threadMsgs = messages.filter(m => 
      (m.senderId === currentUser.id && m.receiverId === activeThreadUserId) ||
      (m.senderId === activeThreadUserId && m.receiverId === currentUser.id)
    ).sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));

    if (threadMsgs.length === 0) {
      messagesContainer.innerHTML = `<div style="margin: auto; text-align: center; color: var(--text-muted); font-size: 0.9rem;">No messages yet. Send a greeting to begin!</div>`;
      return;
    }

    threadMsgs.forEach(m => {
      const bubble = document.createElement("div");
      const isSent = m.senderId === currentUser.id;
      bubble.className = `msg-bubble ${isSent ? 'msg-sent' : 'msg-received'}`;
      
      const timeStr = new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      bubble.innerHTML = `
        <div>${m.content}</div>
        <div class="msg-time">${timeStr}</div>
      `;

      messagesContainer.appendChild(bubble);
    });

    // Auto-scroll chat area to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // 4. Send Message Form Submit
  chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const content = chatInput.value.trim();
    if (!content || !activeThreadUserId) return;

    const newMsg = {
      id: "msg_" + Date.now(),
      senderId: currentUser.id,
      receiverId: activeThreadUserId,
      content: content,
      timestamp: new Date().toISOString()
    };

    messages.push(newMsg);
    localStorage.setItem("agrilinker_messages", JSON.stringify(messages));
    
    chatInput.value = "";
    renderMessages();
    renderThreads();

    // Trigger simulated chatbot replies to make the app feel alive
    simulateReply(content);
  });

  // 5. Automated response replies simulator
  function simulateReply(userMessage) {
    const threadUser = users.find(u => u.id === activeThreadUserId);
    if (!threadUser) return;

    let response = "";
    
    // Customize replies based on user roles
    if (threadUser.role === "farmer") {
      if (userMessage.toLowerCase().includes("fresh") || userMessage.toLowerCase().includes("quality")) {
        response = "Greetings! Yes, all my products are harvested fresh daily. You are welcome to set up a farm pickup run to inspect quality!";
      } else if (userMessage.toLowerCase().includes("price") || userMessage.toLowerCase().includes("discount")) {
        response = "Our pricing is set directly at fair farm-gate values. Since there are no middle agents, it is already optimized.";
      } else {
        response = "Thank you for reaching out! Let me check the crops in the greenhouse and get back to you shortly.";
      }
    } else if (threadUser.role === "customer") {
      if (userMessage.toLowerCase().includes("status") || userMessage.toLowerCase().includes("deliver")) {
        response = "Perfect! I am tracking the order status. Let me know when the delivery agent starts the transit.";
      } else {
        response = "Hi! Thank you for the update. Looking forward to getting the fresh farm produce.";
      }
    } else {
      response = "I am on my way to deliver the package. Will update status on the tracker map!";
    }

    setTimeout(() => {
      const botMsg = {
        id: "msg_" + Date.now(),
        senderId: threadUser.id,
        receiverId: currentUser.id,
        content: response,
        timestamp: new Date().toISOString()
      };

      messages.push(botMsg);
      localStorage.setItem("agrilinker_messages", JSON.stringify(messages));
      
      // Re-render if active thread is still open
      if (activeThreadUserId === threadUser.id) {
        renderMessages();
      }
      renderThreads();
      
      // Toast notification alert
      App.showToast(`New message from ${threadUser.name}`);
    }, 2500);
  }

  // Load threads and check active params on start
  renderThreads();

  const urlParams = new URLSearchParams(window.location.search);
  const chatWithParam = urlParams.get("chat_with");
  if (chatWithParam) {
    openConversation(chatWithParam);
  }
});
