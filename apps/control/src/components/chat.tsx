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
