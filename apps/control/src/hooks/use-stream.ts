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
        
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

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
