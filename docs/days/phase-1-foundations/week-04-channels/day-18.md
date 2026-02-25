# Day 18 — WebChat Connector (WebSocket)

> 🎯 **DAY GOAL:** Chat with Lunar in a web browser via WebSocket

---

## 📚 CONCEPT 1: WebSocket for Real-Time Chat

### WHAT — Simple Definition

**WebSocket = a persistent two-way connection between browser and server.** Unlike HTTP (request → response → done), WebSocket stays open so both sides can send messages anytime. Perfect for chat.

### WHY — Why WebSocket Instead of HTTP?

```
HTTP (request-response):
  Browser: POST /chat "Hello"  → wait...  ← "Hi there!"  [connection closed]
  Browser: POST /chat "How?"   → wait...  ← "I'm great!" [connection closed]
  Each message = new connection → slow for chat

WebSocket (persistent):
  Browser ↔ Server: [connection opens, stays open]
  Browser → "Hello"
  Server → "Hi there!"
  Server → "By the way..."   ← server can push anytime!
  Browser → "How?"
  Server → "I'm great!"
  [connection stays open until one side closes it]

For streaming AI responses (word by word), WebSocket is essential.
```

### WHEN — HTTP vs WebSocket?

```
USE HTTP when:
  ✅ One-off API calls (/health, /api/status)
  ✅ File uploads
  ✅ REST APIs

USE WebSocket when:
  ✅ Real-time chat
  ✅ Streaming AI responses (token by token)
  ✅ Live updates (typing indicators, status)
  ✅ Any bidirectional communication
```

### 🔗 NODE.JS ANALOGY

```typescript
// You already know this! ws (or Socket.io):
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });
wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    ws.send('Got your message!');
  });
});

// Same pattern, but now we connect it to the AI agent
```

---

## 🔨 HANDS-ON: Build WebChat Connector + Test Client

### Step 1: WebSocket Connector (25 minutes)

Create `packages/connectors/src/webchat/connector.ts`:

```typescript
import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import type { InboundEnvelope } from '@lunar/shared';

interface WebChatMessage {
  type: 'message' | 'ping';
  text?: string;
}

interface WebChatReply {
  type: 'message' | 'typing' | 'error';
  content?: string;
}

export interface ConnectorCallbacks {
  onMessage: (envelope: InboundEnvelope) => Promise<string>;
}

export function createWebChatServer(port: number, callbacks: ConnectorCallbacks) {
  const wss = new WebSocketServer({ port });

  wss.on('connection', (ws: WebSocket) => {
    const peerId = `webchat:${randomUUID().slice(0, 8)}`;
    console.log(`🌐 [WebChat] Connected: ${peerId}`);

    ws.on('message', async (raw: Buffer) => {
      let msg: WebChatMessage;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        ws.send(JSON.stringify({ type: 'error', content: 'Invalid JSON' }));
        return;
      }

      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }

      if (msg.type !== 'message' || !msg.text) return;

      // Normalize to InboundEnvelope
      const envelope: InboundEnvelope = {
        provider: 'webchat',
        peerId,
        text: msg.text,
        chatType: 'direct',
        ts: new Date().toISOString(),
      };

      console.log(`📨 [WebChat] ${peerId}: ${msg.text}`);

      // Show typing indicator
      ws.send(JSON.stringify({ type: 'typing' } satisfies WebChatReply));

      try {
        const reply = await callbacks.onMessage(envelope);
        ws.send(JSON.stringify({ type: 'message', content: reply } satisfies WebChatReply));
      } catch (error: any) {
        ws.send(JSON.stringify({ type: 'error', content: 'Something went wrong' }));
      }
    });

    ws.on('close', () => {
      console.log(`🌐 [WebChat] Disconnected: ${peerId}`);
    });
  });

  console.log(`🌐 WebChat server running on ws://localhost:${port}`);
  return wss;
}
```

### Step 2: Test HTML Client (20 minutes)

Create `packages/connectors/src/webchat/test-client.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Lunar WebChat</title>
  <style>
    body { font-family: system-ui; max-width: 600px; margin: 40px auto; padding: 0 20px; }
    #chat { border: 1px solid #ddd; border-radius: 8px; height: 400px; overflow-y: auto; padding: 16px; margin-bottom: 12px; }
    .msg { margin: 8px 0; padding: 8px 12px; border-radius: 12px; max-width: 80%; }
    .user { background: #007AFF; color: white; margin-left: auto; text-align: right; }
    .bot { background: #E9ECEF; color: #333; }
    .typing { color: #999; font-style: italic; }
    #input-area { display: flex; gap: 8px; }
    #input { flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 8px; font-size: 16px; }
    button { padding: 10px 20px; background: #007AFF; color: white; border: none; border-radius: 8px; cursor: pointer; }
    button:hover { background: #0056CC; }
    h1 { text-align: center; }
    #status { text-align: center; color: #999; margin-bottom: 12px; }
  </style>
</head>
<body>
  <h1>🌙 Lunar WebChat</h1>
  <div id="status">Connecting...</div>
  <div id="chat"></div>
  <div id="input-area">
    <input id="input" placeholder="Type a message..." onkeyup="if(event.key==='Enter')send()">
    <button onclick="send()">Send</button>
  </div>

  <script>
    const chat = document.getElementById('chat');
    const input = document.getElementById('input');
    const status = document.getElementById('status');
    let typingEl = null;

    const ws = new WebSocket('ws://localhost:18790');

    ws.onopen = () => { status.textContent = '🟢 Connected'; status.style.color = '#28a745'; };
    ws.onclose = () => { status.textContent = '🔴 Disconnected'; status.style.color = '#dc3545'; };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      // Remove typing indicator
      if (typingEl) { typingEl.remove(); typingEl = null; }

      if (msg.type === 'typing') {
        typingEl = addMessage('Thinking...', 'typing');
      } else if (msg.type === 'message') {
        addMessage(msg.content, 'bot');
      } else if (msg.type === 'error') {
        addMessage('⚠️ ' + msg.content, 'bot');
      }
    };

    function send() {
      const text = input.value.trim();
      if (!text) return;
      addMessage(text, 'user');
      ws.send(JSON.stringify({ type: 'message', text }));
      input.value = '';
    }

    function addMessage(text, type) {
      const div = document.createElement('div');
      div.className = `msg ${type}`;
      div.textContent = text;
      chat.appendChild(div);
      chat.scrollTop = chat.scrollHeight;
      return div;
    }
  </script>
</body>
</html>
```

### Step 3: Test It (10 minutes)

Start the WebChat server, then open the HTML file in your browser.

```
Browser: Hello Lunar!
Lunar: (typing...)
Lunar: Hello! How can I help you today?

Browser: What tools do you have?
Lunar: I have these tools: bash, read_file, memory_search, memory_write...
```

---

## ✅ CHECKLIST

- [ ] WebSocket server listening on port 18790
- [ ] Messages normalized to InboundEnvelope (same as Telegram)
- [ ] Typing indicator sent while AI processes
- [ ] HTML test client connects and communicates
- [ ] Sessions work (each WebSocket connection = unique peerId)

---

## 💡 KEY TAKEAWAY

**Two channels (Telegram + WebChat), same agent, same memory. This is the power of the connector pattern — add a new platform by writing one file.**

---

**Next → [Day 19: Long-Term Memory Structure](day-19.md)**
