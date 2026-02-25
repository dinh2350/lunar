# Day 41 — Control Panel UI: Next.js + shadcn/ui

> 🎯 **DAY GOAL:** Build a web-based control panel for Lunar — real-time chat, settings, and memory browser

---

## 📚 CONCEPT 1: Why a Control Panel?

### WHAT — Simple Definition

**A web dashboard where you can chat with Lunar, view conversations, browse memory, configure settings, and monitor health — all in a browser.**

```
┌─────────────────────────────────────────────────────┐
│  🌙 Lunar Control Panel                    [Settings]│
├──────────────┬──────────────────────────────────────┤
│              │                                       │
│  Sessions    │  Chat with Lunar                      │
│  ──────────  │  ─────────────────                    │
│  📱 telegram │  You: What's my schedule today?       │
│  💬 webchat  │                                       │
│  🖥️ cli     │  🔧 memory_search("schedule today")   │
│              │  📎 Found: Meeting at 3pm              │
│              │                                       │
│  Memory      │  Lunar: You have a meeting at 3pm     │
│  ──────────  │  about the RAG feature.               │
│  📄 MEMORY.md│                                       │
│  📅 Feb 25   │  [Type a message...]          [Send]  │
│  📅 Feb 24   │                                       │
├──────────────┴──────────────────────────────────────┤
│  ❤️ Gateway: UP  🤖 Ollama: UP  📊 247 chunks       │
└─────────────────────────────────────────────────────┘
```

### WHY — Why Not Just Use CLI?

```
CLI is great for development, but:
  ❌ Can't show to others easily
  ❌ No visual memory browser
  ❌ No real-time typing indicators
  ❌ Hard to review past conversations
  ❌ Not impressive in portfolio/demos

Control Panel:
  ✅ Visual, shareable, impressive
  ✅ Real-time WebSocket chat
  ✅ Browse memory and sessions
  ✅ Monitor system health
  ✅ Configure settings without restarting
  ✅ Portfolio-worthy UI
```

---

## 📚 CONCEPT 2: Tech Stack — Next.js + shadcn/ui

### WHAT — Why This Stack?

```
NEXT.JS 14+ (App Router):
  → React framework with server components
  → File-based routing (app/page.tsx = / route)
  → Built-in API routes
  → Most popular React framework
  → You'll see it in 90% of AI startup job postings

SHADCN/UI:
  → Beautiful, accessible UI components
  → Copy-paste into your project (not a dependency!)
  → Built on Tailwind CSS + Radix UI
  → Customizable (not a black box)
  → Used by: Vercel, Supabase, Cal.com

TAILWIND CSS:
  → Utility-first CSS (class="flex items-center p-4")
  → No separate CSS files
  → Fast development, consistent design
```

---

## 🔨 HANDS-ON: Set Up Control Panel

### Step 1: Create Next.js App (10 minutes)

```bash
cd ~/Documents/project/lunar
pnpm create next-app@latest apps/control \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"

cd apps/control
```

### Step 2: Install shadcn/ui (10 minutes)

```bash
npx shadcn@latest init
# Style: Default
# Base color: Neutral
# CSS variables: Yes

# Add components
npx shadcn@latest add button input card badge scroll-area separator
```

### Step 3: Chat Component (30 minutes)

Create `apps/control/src/components/chat.tsx`:

```tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Message {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolName?: string;
  timestamp: Date;
}

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Connect to Lunar WebSocket
    const ws = new WebSocket('ws://localhost:3100/ws/chat');
    
    ws.onopen = () => console.log('Connected to Lunar');
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'message':
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: data.content,
            timestamp: new Date(),
          }]);
          setIsTyping(false);
          break;
        case 'tool_call':
          setMessages(prev => [...prev, {
            role: 'tool',
            content: `${data.name}(${JSON.stringify(data.args)})`,
            toolName: data.name,
            timestamp: new Date(),
          }]);
          break;
        case 'typing':
          setIsTyping(true);
          break;
      }
    };

    wsRef.current = ws;
    return () => ws.close();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim() || !wsRef.current) return;
    
    const msg: Message = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, msg]);
    wsRef.current.send(JSON.stringify({ type: 'message', content: input }));
    setInput('');
  };

  return (
    <Card className="flex flex-col h-[600px]">
      <div className="p-4 border-b">
        <h2 className="font-semibold">Chat with Lunar</h2>
      </div>
      
      <ScrollArea className="flex-1 p-4">
        {messages.map((msg, i) => (
          <div key={i} className={`mb-3 ${msg.role === 'user' ? 'text-right' : ''}`}>
            {msg.role === 'tool' ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline">🔧 {msg.toolName}</Badge>
                <span className="font-mono text-xs">{msg.content}</span>
              </div>
            ) : (
              <div className={`inline-block p-3 rounded-lg max-w-[80%] ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              }`}>
                {msg.content}
              </div>
            )}
          </div>
        ))}
        {isTyping && (
          <div className="text-sm text-muted-foreground animate-pulse">
            Lunar is thinking...
          </div>
        )}
        <div ref={scrollRef} />
      </ScrollArea>

      <div className="p-4 border-t flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type a message..."
        />
        <Button onClick={sendMessage}>Send</Button>
      </div>
    </Card>
  );
}
```

### Step 4: Dashboard Page (15 minutes)

Create `apps/control/src/app/page.tsx`:

```tsx
import { Chat } from '@/components/chat';

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b p-4">
        <h1 className="text-2xl font-bold">🌙 Lunar Control Panel</h1>
      </header>
      
      <main className="container mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chat - takes 2 columns */}
        <div className="lg:col-span-2">
          <Chat />
        </div>
        
        {/* Sidebar */}
        <div className="space-y-4">
          {/* Health Status */}
          <div className="p-4 rounded-lg border">
            <h3 className="font-semibold mb-2">System Health</h3>
            <div className="space-y-1 text-sm">
              <div>❤️ Gateway: <span className="text-green-500">UP</span></div>
              <div>🤖 Ollama: <span className="text-green-500">UP</span></div>
              <div>📊 Model: qwen2.5:3b</div>
            </div>
          </div>
          
          {/* Quick Stats */}
          <div className="p-4 rounded-lg border">
            <h3 className="font-semibold mb-2">Statistics</h3>
            <div className="space-y-1 text-sm">
              <div>💬 Messages today: --</div>
              <div>🔧 Tool calls: --</div>
              <div>📚 Memory chunks: --</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
```

### Step 5: Run It (5 minutes)

```bash
cd apps/control
pnpm dev
# Open http://localhost:3000

# Make sure Lunar gateway is running on :3100
```

---

## ✅ CHECKLIST

- [ ] Next.js app created with shadcn/ui
- [ ] WebSocket chat component works
- [ ] Messages display with user/assistant/tool styling
- [ ] Typing indicator shows while Lunar thinks
- [ ] Dashboard layout with sidebar
- [ ] Health status display

---

## 💡 KEY TAKEAWAY

**The control panel makes Lunar visual and shareable. Next.js + shadcn/ui is the fastest path to a professional-looking dashboard. WebSocket provides real-time chat. This UI is what makes your portfolio stand out — screenshots of a beautiful AI control panel speak louder than code.**

---

**Next → [Day 42: Memory Browser + Session Viewer](day-42.md)**
