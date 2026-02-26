export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gray-950 text-white">
      {/* Hero */}
      <section className="text-center py-20 px-4">
        <h1 className="text-5xl font-bold">🌙 Lunar</h1>
        <p className="text-xl text-gray-400 mt-4 max-w-xl mx-auto">
          Self-hosted AI agent that remembers, thinks, and acts.
          <br />
          Privacy-first. Zero cost. Open source.
        </p>
        <div className="mt-8 flex gap-4 justify-center">
          <a
            href="/chat"
            className="bg-indigo-600 hover:bg-indigo-700 px-6 py-3 rounded-lg font-medium transition"
          >
            Try Demo
          </a>
          <a
            href="https://github.com/yourusername/lunar"
            className="border border-gray-600 hover:border-gray-400 px-6 py-3 rounded-lg font-medium transition"
          >
            GitHub
          </a>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 py-16 px-4">
        <Feature
          icon="🧠"
          title="Long-Term Memory"
          desc="Remembers conversations across sessions with hybrid vector + BM25 search"
        />
        <Feature
          icon="🔧"
          title="Tool System"
          desc="Web search, code runner, file ops, and extensible via MCP"
        />
        <Feature
          icon="🔒"
          title="Privacy-First"
          desc="Everything runs on your machine. Your data never leaves."
        />
        <Feature
          icon="💬"
          title="Multi-Channel"
          desc="Telegram, Discord, WhatsApp, and Web — one bot, everywhere"
        />
        <Feature
          icon="👥"
          title="Multi-Agent"
          desc="Coordinator + specialist agents for complex tasks"
        />
        <Feature
          icon="🎨"
          title="Multimodal"
          desc="Vision, voice (STT/TTS), and image generation"
        />
      </section>

      {/* Tech Stack */}
      <section className="max-w-2xl mx-auto py-16 px-4 text-center">
        <h2 className="text-2xl font-bold mb-6">Built With</h2>
        <p className="text-gray-400">
          Node.js 22 · TypeScript 5 · Fastify · SQLite · Ollama · Next.js · Docker
        </p>
      </section>

      {/* Footer */}
      <footer className="text-center py-8 text-gray-500 border-t border-gray-800">
        <p>MIT License · Made with 100 days of learning</p>
      </footer>
    </main>
  );
}

function Feature({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="text-center p-6 rounded-xl bg-gray-900 border border-gray-800">
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-gray-400 text-sm">{desc}</p>
    </div>
  );
}
