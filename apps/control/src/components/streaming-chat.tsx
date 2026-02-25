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

    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    
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
