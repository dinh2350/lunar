import { Chat } from '@/components/chat';

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b p-4">
        <h1 className="text-2xl font-bold">🌙 Lunar Control Panel</h1>
      </header>
      
      <main className="container mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Chat />
        </div>
        
        <div className="space-y-4">
          <div className="p-4 rounded-lg border">
            <h3 className="font-semibold mb-2">System Health</h3>
            <div className="space-y-1 text-sm">
              <div>❤️ Gateway: <span className="text-green-500">UP</span></div>
              <div>🤖 Ollama: <span className="text-green-500">UP</span></div>
              <div>📊 Model: qwen2.5:3b</div>
            </div>
          </div>
          
          <div className="p-4 rounded-lg border">
            <h3 className="font-semibold mb-2">Statistics</h3>
            <div className="space-y-1 text-sm">
              <div>💬 Messages today: --</div>
              <div>🔧 Tool calls: --</div>
              <div>📚 Memory chunks: --</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
