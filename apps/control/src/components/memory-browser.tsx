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

          <div className="flex gap-4 mb-4 text-sm text-muted-foreground">
            <span>📊 {stats.total} total chunks</span>
            <span>📂 {stats.sources} sources</span>
            <span>🔍 {chunks.length} results</span>
          </div>

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
