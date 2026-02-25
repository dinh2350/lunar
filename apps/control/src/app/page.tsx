'use client';

import { Suspense, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StreamingChat } from '@/components/streaming-chat';
import { MemoryBrowser } from '@/components/memory-browser';
import { SessionViewer } from '@/components/session-viewer';
import { SettingsPanel } from '@/components/settings-panel';
import { LiveMetrics } from '@/components/live-metrics';
import { ThemeToggle } from '@/components/theme-toggle';
import { ErrorBoundary } from '@/components/error-boundary';
import { ChatSkeleton } from '@/components/chat-skeleton';
import { useKeyboard } from '@/hooks/use-keyboard';

export default function Home() {
  const [tab, setTab] = useState('chat');

  useKeyboard([
    { key: '1', ctrl: true, handler: () => setTab('chat'), description: 'Chat' },
    { key: '2', ctrl: true, handler: () => setTab('memory'), description: 'Memory' },
    { key: '3', ctrl: true, handler: () => setTab('sessions'), description: 'Sessions' },
    { key: '4', ctrl: true, handler: () => setTab('settings'), description: 'Settings' },
  ]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b p-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">🌙 Lunar Control Panel</h1>
        <div className="flex items-center gap-2">
          <kbd className="text-xs text-muted-foreground">
            Ctrl+1-4: switch tabs
          </kbd>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto p-6 space-y-6">
        {/* Live Metrics Bar */}
        <ErrorBoundary>
          <LiveMetrics />
        </ErrorBoundary>

        {/* Main Content */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="chat">💬 Chat</TabsTrigger>
            <TabsTrigger value="memory">🧠 Memory</TabsTrigger>
            <TabsTrigger value="sessions">📋 Sessions</TabsTrigger>
            <TabsTrigger value="settings">⚙️ Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="mt-4">
            <ErrorBoundary>
              <Suspense fallback={<ChatSkeleton />}>
                <StreamingChat />
              </Suspense>
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="memory" className="mt-4">
            <ErrorBoundary>
              <MemoryBrowser />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="sessions" className="mt-4">
            <ErrorBoundary>
              <SessionViewer />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            <ErrorBoundary>
              <SettingsPanel />
            </ErrorBoundary>
          </TabsContent>
        </Tabs>
      </main>

      <footer className="border-t p-4 text-center text-sm text-muted-foreground">
        Lunar AI Agent &bull; Built with Node.js + TypeScript
      </footer>
    </div>
  );
}
