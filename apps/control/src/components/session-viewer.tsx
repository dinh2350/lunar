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
