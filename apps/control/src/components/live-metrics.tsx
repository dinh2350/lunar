'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SystemMetrics {
  gateway: { status: 'up' | 'down'; uptime: number };
  ollama: { status: 'up' | 'down'; models: string[] };
  memory: { chunks: number; sizeBytes: number };
  sessions: { active: number; total: number };
  stats: {
    messagesToday: number;
    toolCalls: number;
    avgResponseMs: number;
  };
}

export function LiveMetrics() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch('/api/metrics');
        const data = await res.json();
        setMetrics(data);
        setLastUpdate(new Date());
      } catch {
        // silently fail
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

  if (!metrics) return <div className="text-sm text-muted-foreground">Loading metrics...</div>;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">💬 Messages</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{metrics.stats.messagesToday}</p>
          <p className="text-xs text-muted-foreground">today</p>
        </CardContent>
      </Card>

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
