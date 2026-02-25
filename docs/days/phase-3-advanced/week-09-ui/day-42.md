# Day 42 — Memory Browser + Session Viewer

> 🎯 **DAY GOAL:** Build a visual memory browser and session history viewer for the control panel

---

## 📚 CONCEPT 1: Visualizing AI Memory

### WHAT — Simple Definition

**A UI that lets you browse Lunar's memory — see what it remembers about you, search through past conversations, and inspect individual memory chunks with their embeddings and scores.**

```
┌─────────────────────────────────────────────────────────┐
│  🧠 Memory Browser                    [Search: ______] │
├────────────────┬────────────────────────────────────────┤
│ 📂 Sources     │  🔍 Search Results for "project ideas" │
│ ──────────     │  ──────────────────────────────────────│
│ ☑ MEMORY.md    │  📄 Score: 0.89  | Source: MEMORY.md   │
│ ☑ Daily logs   │  "User is interested in building an    │
│ ☑ Sessions     │   AI-powered note-taking app"          │
│ ☑ Documents    │  ─────────────────────────────────────│
│                │  📄 Score: 0.76  | Source: 2025-02-24  │
│ 📊 Stats       │  "Discussed RAG architecture for       │
│ ──────────     │   personal knowledge base project"     │
│ Chunks: 247    │  ─────────────────────────────────────│
│ Size: 1.2MB    │  📄 Score: 0.71  | Source: session-42  │
│ Last: 2m ago   │  "Brainstormed 5 project ideas for     │
│                │   portfolio: chatbot, code review..."   │
└────────────────┴────────────────────────────────────────┘
```

### WHY — Why Browse Memory?

```
FOR DEBUGGING:
  → "Why did Lunar say that?" — check what memory it found
  → "Is the search working?" — test queries visually  
  → "Did it remember?" — verify memory writes

FOR TRUST:
  → Users can see exactly what the AI knows about them
  → Transparency builds confidence
  → Delete specific memories (GDPR-style control)

FOR PORTFOLIO:
  → Memory browser is IMPRESSIVE in demos
  → Shows you understand RAG at a deep level
  → Visually demonstrates embeddings + search
```

### 🔗 NODE.JS ANALOGY

```
// Memory browser = database admin panel (like Prisma Studio)

// Prisma Studio: Browse rows, run queries, edit data
// Memory Browser: Browse chunks, run semantic search, view scores

// Both turn invisible data into visible, manageable UI
```

---

## 🔨 HANDS-ON: Build Memory Browser

### Step 1: Memory API Route (15 minutes)

Create `apps/control/src/app/api/memory/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3100';

// GET /api/memory — search memory or list all
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const source = searchParams.get('source');
  const limit = searchParams.get('limit') || '20';

  try {
    const endpoint = query
      ? `${GATEWAY_URL}/api/memory/search?q=${encodeURIComponent(query)}&limit=${limit}`
      : `${GATEWAY_URL}/api/memory/chunks?source=${source || 'all'}&limit=${limit}`;

    const response = await fetch(endpoint);
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch memory' },
      { status: 500 }
    );
  }
}

// DELETE /api/memory — delete a specific chunk
export async function DELETE(request: NextRequest) {
  const { chunkId } = await request.json();
  
  try {
    const response = await fetch(`${GATEWAY_URL}/api/memory/chunks/${chunkId}`, {
      method: 'DELETE',
    });
    return NextResponse.json({ success: response.ok });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete chunk' },
      { status: 500 }
    );
  }
}
```

### Step 2: Memory Browser Component (30 minutes)

Create `apps/control/src/components/memory-browser.tsx`:

```tsx
'use client';

import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface MemoryChunk {
  id: string;
  content: string;
  source: string;
  score?: number;
  metadata: {
    createdAt: string;
    tokens: number;
    type: string;
  };
}

export function MemoryBrowser() {
  const [query, setQuery] = useState('');
  const [chunks, setChunks] = useState<MemoryChunk[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, sources: 0 });

  const searchMemory = useCallback(async () => {
    setLoading(true);
    try {
      const url = query
        ? `/api/memory?q=${encodeURIComponent(query)}`
        : '/api/memory';
      const res = await fetch(url);
      const data = await res.json();
      setChunks(data.chunks || []);
      setStats(data.stats || { total: 0, sources: 0 });
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const deleteChunk = async (chunkId: string) => {
    if (!confirm('Delete this memory chunk?')) return;
    
    await fetch('/api/memory', {
      method: 'DELETE',
      body: JSON.stringify({ chunkId }),
    });
    setChunks(prev => prev.filter(c => c.id !== chunkId));
  };

  // Score color: green (high) → yellow → red (low)
  const scoreColor = (score?: number) => {
    if (!score) return 'bg-gray-100';
    if (score > 0.8) return 'bg-green-100 text-green-800';
    if (score > 0.6) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>🧠 Memory Browser</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Search Bar */}
          <div className="flex gap-2 mb-4">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchMemory()}
              placeholder="Search memory (semantic)..."
            />
            <Button onClick={searchMemory} disabled={loading}>
              {loading ? '...' : '🔍 Search'}
            </Button>
          </div>

          {/* Stats */}
          <div className="flex gap-4 mb-4 text-sm text-muted-foreground">
            <span>📊 {stats.total} total chunks</span>
            <span>📂 {stats.sources} sources</span>
            <span>🔍 {chunks.length} results</span>
          </div>

          {/* Results */}
          <ScrollArea className="h-[500px]">
            <div className="space-y-3">
              {chunks.map((chunk) => (
                <Card key={chunk.id} className="p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex gap-2">
                      <Badge variant="outline">{chunk.source}</Badge>
                      <Badge variant="outline">{chunk.metadata.type}</Badge>
                      {chunk.score && (
                        <Badge className={scoreColor(chunk.score)}>
                          {(chunk.score * 100).toFixed(0)}%
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteChunk(chunk.id)}
                    >
                      🗑️
                    </Button>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{chunk.content}</p>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {new Date(chunk.metadata.createdAt).toLocaleString()} •{' '}
                    {chunk.metadata.tokens} tokens
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
```

### Step 3: Session History Component (20 minutes)

Create `apps/control/src/components/session-viewer.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Session {
  id: string;
  channel: string;
  userId: string;
  messageCount: number;
  toolCalls: number;
  startedAt: string;
  lastMessageAt: string;
  preview: string;
}

interface SessionMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolName?: string;
  timestamp: string;
}

export function SessionViewer() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<SessionMessage[]>([]);

  useEffect(() => {
    fetch('/api/sessions')
      .then(res => res.json())
      .then(data => setSessions(data.sessions || []));
  }, []);

  const loadSession = async (sessionId: string) => {
    setSelected(sessionId);
    const res = await fetch(`/api/sessions/${sessionId}`);
    const data = await res.json();
    setMessages(data.messages || []);
  };

  const channelIcon: Record<string, string> = {
    telegram: '📱',
    webchat: '💬',
    discord: '🎮',
    whatsapp: '📞',
    cli: '🖥️',
  };

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Session List */}
      <Card className="col-span-1">
        <CardHeader>
          <CardTitle>📋 Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            {sessions.map(session => (
              <div
                key={session.id}
                onClick={() => loadSession(session.id)}
                className={`p-3 rounded-lg cursor-pointer mb-2 ${
                  selected === session.id ? 'bg-primary/10' : 'hover:bg-muted'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span>{channelIcon[session.channel] || '💬'}</span>
                  <span className="font-medium text-sm">{session.channel}</span>
                  <Badge variant="outline" className="text-xs">
                    {session.messageCount} msgs
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {session.preview}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(session.lastMessageAt).toLocaleString()}
                </p>
              </div>
            ))}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Message Viewer */}
      <Card className="col-span-2">
        <CardHeader>
          <CardTitle>
            {selected ? `Session ${selected.slice(0, 8)}...` : 'Select a session'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            {messages.map((msg, i) => (
              <div key={i} className="mb-3">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={msg.role === 'user' ? 'default' : 'secondary'}>
                    {msg.role}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                {msg.role === 'tool' ? (
                  <code className="text-xs bg-muted p-2 rounded block">
                    🔧 {msg.toolName}: {msg.content}
                  </code>
                ) : (
                  <p className="text-sm pl-2">{msg.content}</p>
                )}
              </div>
            ))}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
```

### Step 4: Add to Layout (10 minutes)

Update `apps/control/src/app/page.tsx` with tabs:

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Chat } from '@/components/chat';
import { MemoryBrowser } from '@/components/memory-browser';
import { SessionViewer } from '@/components/session-viewer';

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b p-4">
        <h1 className="text-2xl font-bold">🌙 Lunar Control Panel</h1>
      </header>
      
      <main className="container mx-auto p-6">
        <Tabs defaultValue="chat">
          <TabsList>
            <TabsTrigger value="chat">💬 Chat</TabsTrigger>
            <TabsTrigger value="memory">🧠 Memory</TabsTrigger>
            <TabsTrigger value="sessions">📋 Sessions</TabsTrigger>
          </TabsList>
          
          <TabsContent value="chat" className="mt-4">
            <Chat />
          </TabsContent>
          
          <TabsContent value="memory" className="mt-4">
            <MemoryBrowser />
          </TabsContent>
          
          <TabsContent value="sessions" className="mt-4">
            <SessionViewer />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
```

---

## ✅ CHECKLIST

- [ ] Memory browser with semantic search
- [ ] Results show score, source, timestamp
- [ ] Delete individual memory chunks
- [ ] Session list grouped by channel
- [ ] Click session to view full conversation
- [ ] Tool calls displayed in session viewer
- [ ] Tabs for Chat / Memory / Sessions

---

## 💡 KEY TAKEAWAY

**The memory browser makes the invisible visible. Being able to search Lunar's memory, see relevance scores, and browse past sessions transforms debugging from guesswork to insight. This is also the most impressive demo feature — showing a recruiter that your AI agent has inspectable, searchable memory is a huge differentiator.**

---

**Next → [Day 43: Real-Time Features + Streaming UI](day-43.md)**
