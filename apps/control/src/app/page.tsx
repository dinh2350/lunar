import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Chat } from '@/components/chat';
import { MemoryBrowser } from '@/components/memory-browser';
import { SessionViewer } from '@/components/session-viewer';
import { SettingsPanel } from '@/components/settings-panel';

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
            <TabsTrigger value="settings">⚙️ Settings</TabsTrigger>
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

          <TabsContent value="settings" className="mt-4">
            <SettingsPanel />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
