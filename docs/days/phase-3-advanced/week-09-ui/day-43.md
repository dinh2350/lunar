# Day 43 — Real-Time Features + Streaming UI

> 🎯 **DAY GOAL:** Add real-time streaming responses, typing indicators, and live system metrics to the control panel

---

## 📚 CONCEPT 1: Streaming in the Browser

### WHAT — Simple Definition

**Instead of waiting for the full response, show tokens as they arrive — word by word, like ChatGPT does. Uses Server-Sent Events (SSE) or WebSocket for real-time data flow.**

```
WITHOUT STREAMING:                    WITH STREAMING:
──────────────────                    ─────────────────
User: "Explain RAG"                   User: "Explain RAG"
                                      
[........waiting 5s........]          RAG stands|
                                      RAG stands for Retriev|
"RAG stands for Retrieval             RAG stands for Retrieval
 Augmented Generation. It             Augmented Genera|
 combines search with LLMs            RAG stands for Retrieval
 to ground responses in               Augmented Generation. It|
 factual data."                       ...
                                      (feels instant, engaging)
→ 5 seconds of nothing                → Response appears immediately
→ User wonders "is it broken?"        → User reads as it types
```

### WHY — UX Impact

```
STREAMING BENEFITS:
  ✅ Time-to-first-token < 500ms (feels instant)
  ✅ User starts reading immediately
  ✅ Can cancel early if response is wrong direction
  ✅ Shows tool calls happening in real-time
  ✅ Every modern AI product uses streaming

TRUST:
  → User sees the AI "thinking" step by step
  → Tool calls appear before results → transparency
  → No mysterious black box
```

### 🔗 NODE.JS ANALOGY

```
// Streaming = Node.js streams!

// BATCH (no streaming):
const data = await readFile('big.txt');  // Wait for ALL
res.send(data);                          // Send at once

// STREAMING:
createReadStream('big.txt')              // Start immediately
  .pipe(res);                            // Send chunks as read

// LLM streaming is EXACTLY the same idea:
// Instead of waiting for full response,
// pipe tokens to the UI as they're generated
```

---

## 🔨 HANDS-ON: Streaming Chat Component

### Step 1: SSE Hook (20 minutes)

Create `apps/control/src/hooks/use-stream.ts`:

```ts
'use client';

import { useState, useCallback, useRef } from 'react';

interface StreamOptions {
  url: string;
  body: Record<string, unknown>;
  onToken: (token: string) => void;
  onToolCall?: (name: string, args: unknown) => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
}

export function useStream() {
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const startStream = useCallback(async (options: StreamOptions) => {
    const { url, body, onToken, onToolCall, onDone, onError } = options;
    
    // Cancel previous stream if any
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    
    setIsStreaming(true);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: abort.signal,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Parse SSE events
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          
          if (data === '[DONE]') {
            onDone?.();
            continue;
          }

          try {
            const event = JSON.parse(data);
            
            switch (event.type) {
              case 'token':
                onToken(event.content);
                break;
              case 'tool_call':
                onToolCall?.(event.name, event.args);
                break;
              case 'tool_result':
                onToken(`\n\n`);
                break;
              case 'error':
                onError?.(new Error(event.message));
                break;
            }
          } catch {
            // Non-JSON data, treat as raw token
            onToken(data);
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        onError?.(err as Error);
      }
    } finally {
      setIsStreaming(false);
    }
  }, []);

  const stopStream = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return { startStream, stopStream, isStreaming };
}
```

### Step 2: Streaming Chat Component (25 minutes)

Create `apps/control/src/components/streaming-chat.tsx`:

```tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useStream } from '@/hooks/use-stream';

interface Message {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolName?: string;
  isStreaming?: boolean;
}

export function StreamingChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const { startStream, stopStream, isStreaming } = useStream();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return;
    const userMsg = input;
    setInput('');

    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    
    // Add empty assistant message (will be filled by stream)
    setMessages(prev => [...prev, { 
      role: 'assistant', content: '', isStreaming: true 
    }]);

    await startStream({
      url: '/api/chat/stream',
      body: { message: userMsg },
      
      onToken: (token) => {
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === 'assistant') {
            last.content += token;
          }
          return updated;
        });
      },

      onToolCall: (name, args) => {
        // Insert tool call before assistant message
        setMessages(prev => {
          const updated = [...prev];
          const assistantMsg = updated.pop()!;
          updated.push({
            role: 'tool',
            content: JSON.stringify(args, null, 2),
            toolName: name,
          });
          updated.push(assistantMsg);
          return updated;
        });
      },

      onDone: () => {
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last) last.isStreaming = false;
          return updated;
        });
      },

      onError: (error) => {
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last) {
            last.content += `\n\n⚠️ Error: ${error.message}`;
            last.isStreaming = false;
          }
          return updated;
        });
      },
    });
  };

  return (
    <Card className="flex flex-col h-[600px]">
      <div className="p-4 border-b flex justify-between items-center">
        <h2 className="font-semibold">💬 Chat with Lunar</h2>
        {isStreaming && (
          <Button variant="outline" size="sm" onClick={stopStream}>
            ⏹️ Stop
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1 p-4">
        {messages.map((msg, i) => (
          <div key={i} className={`mb-3 ${msg.role === 'user' ? 'text-right' : ''}`}>
            {msg.role === 'tool' ? (
              <div className="flex items-center gap-2 text-sm my-2">
                <Badge variant="outline" className="bg-amber-50">
                  🔧 {msg.toolName}
                </Badge>
                <code className="text-xs bg-muted p-1 rounded max-w-[300px] truncate">
                  {msg.content}
                </code>
              </div>
            ) : (
              <div className={`inline-block p-3 rounded-lg max-w-[80%] ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              }`}>
                <span>{msg.content}</span>
                {msg.isStreaming && (
                  <span className="animate-pulse ml-1">▊</span>
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={scrollRef} />
      </ScrollArea>

      <div className="p-4 border-t flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type a message..."
          disabled={isStreaming}
        />
        <Button onClick={sendMessage} disabled={isStreaming}>
          {isStreaming ? '...' : 'Send'}
        </Button>
      </div>
    </Card>
  );
}
```

### Step 3: Live Metrics Dashboard (20 minutes)

Create `apps/control/src/components/live-metrics.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface SystemMetrics {
  gateway: { status: 'up' | 'down'; uptime: number };
  ollama: { status: 'up' | 'down'; models: string[] };
  memory: { chunks: number; sizeBytes: number };
  sessions: { active: number; total: number };
  stats: {
    messagestoday: number;
    toolCalls: number;
    avgResponseMs: number;
  };
}

export function LiveMetrics() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Poll every 5 seconds
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch('/api/metrics');
        const data = await res.json();
        setMetrics(data);
        setLastUpdate(new Date());
      } catch {
        // Silently fail — will retry
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  const StatusDot = ({ up }: { up: boolean }) => (
    <span className={`inline-block w-2 h-2 rounded-full ${
      up ? 'bg-green-500' : 'bg-red-500'
    }`} />
  );

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1048576).toFixed(1)}MB`;
  };

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  if (!metrics) return <div className="text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* Gateway */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <StatusDot up={metrics.gateway.status === 'up'} />
            Gateway
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">
            {metrics.gateway.status === 'up' ? '✅' : '❌'}
          </p>
          <p className="text-xs text-muted-foreground">
            Uptime: {formatUptime(metrics.gateway.uptime)}
          </p>
        </CardContent>
      </Card>

      {/* Messages */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">💬 Messages</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{metrics.stats.messagestoday}</p>
          <p className="text-xs text-muted-foreground">today</p>
        </CardContent>
      </Card>

      {/* Memory */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">🧠 Memory</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{metrics.memory.chunks}</p>
          <p className="text-xs text-muted-foreground">
            chunks ({formatBytes(metrics.memory.sizeBytes)})
          </p>
        </CardContent>
      </Card>

      {/* Response Time */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">⚡ Speed</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{metrics.stats.avgResponseMs}ms</p>
          <p className="text-xs text-muted-foreground">avg response</p>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## ✅ CHECKLIST

- [ ] SSE stream parsing hook created
- [ ] Tokens appear character by character
- [ ] Cursor blinks while streaming
- [ ] Stop button cancels generation
- [ ] Tool calls appear inline during streaming
- [ ] Live metrics polling every 5s
- [ ] Status dots show green/red

---

## 💡 KEY TAKEAWAY

**Streaming transforms the UX from "waiting" to "watching" — a 5-second response feels instant when tokens flow continuously. The `useStream` hook handles SSE parsing, abort control, and error recovery. Live metrics give the dashboard a professional, production feel. These real-time features are what separate a demo project from a real product.**

---

**Next → [Day 44: Settings Panel + Model Configuration](day-44.md)**
