# Day 44 — Settings Panel + Model Configuration

> 🎯 **DAY GOAL:** Build a settings UI to configure Lunar without editing files — model selection, system prompt, MCP servers, and memory settings

---

## 📚 CONCEPT 1: Runtime Configuration

### WHAT — Simple Definition

**A settings page where you can change Lunar's brain (model), personality (system prompt), tools (MCP servers), and behavior (memory settings) — all without restarting.**

```
┌─────────────────────────────────────────────────┐
│  ⚙️ Settings                                    │
├─────────────────────────────────────────────────┤
│                                                  │
│  🤖 MODEL CONFIGURATION                         │
│  ─────────────────────                           │
│  Provider: [Ollama     ▾]                        │
│  Model:    [qwen2.5:3b ▾]  ← dropdown of avail │
│  Temp:     [====●=======] 0.7                    │
│  Max Tok:  [========●===] 4096                   │
│                                                  │
│  💬 SYSTEM PROMPT                                │
│  ─────────────────                               │
│  ┌─────────────────────────────────────────┐    │
│  │ You are Lunar, a helpful AI assistant.  │    │
│  │ You remember past conversations and     │    │
│  │ use tools when helpful.                 │    │
│  └─────────────────────────────────────────┘    │
│                                                  │
│  🔧 MCP SERVERS                                  │
│  ──────────────                                  │
│  ☑ memory-server    [Running]                    │
│  ☑ github-server    [Running]                    │
│  ☐ fetch-server     [Stopped]   [Start]          │
│                                                  │
│           [Save Changes]  [Reset Defaults]       │
└─────────────────────────────────────────────────┘
```

### WHY — Stop Editing Config Files

```
WITHOUT SETTINGS UI:
  1. Open config.json in editor
  2. Change model name (hope you spell it right)
  3. Restart server
  4. Wait for model to load
  5. Realize typo, go back to step 1

WITH SETTINGS UI:
  1. Open browser → Settings tab
  2. Pick model from dropdown (shows only available models)
  3. Click Save → applies immediately
  4. Done ✅
```

### 🔗 NODE.JS ANALOGY

```
// Settings UI = environment variable dashboard

// WITHOUT:
export PORT=3000 && export DB_URL=... && node server.js

// WITH (like settings panel):
// → Open dashboard → change PORT to 3001 → Save → Auto-restart
// → No terminal needed, no typos, instant feedback
```

---

## 🔨 HANDS-ON: Build Settings

### Step 1: Settings API (15 minutes)

Create `apps/control/src/app/api/settings/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3100';

// GET /api/settings — load current config
export async function GET() {
  try {
    const res = await fetch(`${GATEWAY_URL}/api/settings`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Gateway unavailable' }, { status: 503 });
  }
}

// PUT /api/settings — update config
export async function PUT(request: NextRequest) {
  const settings = await request.json();
  
  try {
    const res = await fetch(`${GATEWAY_URL}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
```

Create `apps/control/src/app/api/models/route.ts`:

```ts
import { NextResponse } from 'next/server';

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3100';

// GET /api/models — list available models
export async function GET() {
  try {
    const res = await fetch(`${GATEWAY_URL}/api/models`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ models: [] });
  }
}
```

### Step 2: Settings Component (35 minutes)

Create `apps/control/src/components/settings-panel.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface Settings {
  model: {
    provider: 'ollama' | 'gemini' | 'groq' | 'openrouter';
    name: string;
    temperature: number;
    maxTokens: number;
  };
  systemPrompt: string;
  memory: {
    searchLimit: number;
    hybridAlpha: number;  // 0 = full BM25, 1 = full vector
    temporalDecay: boolean;
    mmrDiversity: number;
  };
  mcpServers: Array<{
    name: string;
    status: 'running' | 'stopped' | 'error';
    command: string;
  }>;
}

interface Model {
  name: string;
  size: string;
  quantization: string;
}

export function SettingsPanel() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/settings').then(r => r.json()),
      fetch('/api/models').then(r => r.json()),
    ]).then(([s, m]) => {
      setSettings(s);
      setModels(m.models || []);
    });
  }, []);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const update = <K extends keyof Settings>(
    section: K,
    key: string,
    value: unknown
  ) => {
    setSettings(prev => {
      if (!prev) return prev;
      if (typeof prev[section] === 'object' && !Array.isArray(prev[section])) {
        return {
          ...prev,
          [section]: { ...(prev[section] as Record<string, unknown>), [key]: value },
        };
      }
      return { ...prev, [section]: value };
    });
  };

  if (!settings) return <p>Loading settings...</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Model Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>🤖 Model Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Provider */}
          <div>
            <label className="text-sm font-medium">Provider</label>
            <select
              className="w-full mt-1 p-2 border rounded-md"
              value={settings.model.provider}
              onChange={(e) => update('model', 'provider', e.target.value)}
            >
              <option value="ollama">Ollama (Local)</option>
              <option value="gemini">Gemini (Free Tier)</option>
              <option value="groq">Groq (Free Tier)</option>
              <option value="openrouter">OpenRouter</option>
            </select>
          </div>

          {/* Model */}
          <div>
            <label className="text-sm font-medium">Model</label>
            <select
              className="w-full mt-1 p-2 border rounded-md"
              value={settings.model.name}
              onChange={(e) => update('model', 'name', e.target.value)}
            >
              {models.map(m => (
                <option key={m.name} value={m.name}>
                  {m.name} ({m.size})
                </option>
              ))}
            </select>
          </div>

          {/* Temperature */}
          <div>
            <label className="text-sm font-medium">
              Temperature: {settings.model.temperature}
            </label>
            <input
              type="range"
              min="0" max="2" step="0.1"
              className="w-full mt-1"
              value={settings.model.temperature}
              onChange={(e) => update('model', 'temperature', +e.target.value)}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Precise (0)</span>
              <span>Creative (2)</span>
            </div>
          </div>

          {/* Max Tokens */}
          <div>
            <label className="text-sm font-medium">
              Max Tokens: {settings.model.maxTokens}
            </label>
            <input
              type="range"
              min="256" max="8192" step="256"
              className="w-full mt-1"
              value={settings.model.maxTokens}
              onChange={(e) => update('model', 'maxTokens', +e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* System Prompt */}
      <Card>
        <CardHeader>
          <CardTitle>💬 System Prompt</CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            className="w-full h-32 p-3 border rounded-md font-mono text-sm"
            value={settings.systemPrompt}
            onChange={(e) => setSettings(prev => 
              prev ? { ...prev, systemPrompt: e.target.value } : prev
            )}
          />
          <p className="text-xs text-muted-foreground mt-1">
            This defines Lunar's personality and behavior
          </p>
        </CardContent>
      </Card>

      {/* Memory Settings */}
      <Card>
        <CardHeader>
          <CardTitle>🧠 Memory Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">
              Search Results: {settings.memory.searchLimit}
            </label>
            <input
              type="range"
              min="3" max="20" step="1"
              className="w-full mt-1"
              value={settings.memory.searchLimit}
              onChange={(e) => update('memory', 'searchLimit', +e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium">
              Hybrid Alpha: {settings.memory.hybridAlpha}
            </label>
            <input
              type="range"
              min="0" max="1" step="0.1"
              className="w-full mt-1"
              value={settings.memory.hybridAlpha}
              onChange={(e) => update('memory', 'hybridAlpha', +e.target.value)}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>BM25 (keyword)</span>
              <span>Vector (semantic)</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.memory.temporalDecay}
              onChange={(e) => update('memory', 'temporalDecay', e.target.checked)}
            />
            <label className="text-sm">Enable temporal decay (prefer recent memories)</label>
          </div>
        </CardContent>
      </Card>

      {/* MCP Servers */}
      <Card>
        <CardHeader>
          <CardTitle>🔧 MCP Servers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {settings.mcpServers.map((server, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded border">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    server.status === 'running' ? 'bg-green-500' :
                    server.status === 'error' ? 'bg-red-500' : 'bg-gray-300'
                  }`} />
                  <span className="font-medium text-sm">{server.name}</span>
                </div>
                <Badge variant={server.status === 'running' ? 'default' : 'secondary'}>
                  {server.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex gap-4">
        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving...' : saved ? '✅ Saved!' : '💾 Save Changes'}
        </Button>
        <Button variant="outline" onClick={() => window.location.reload()}>
          ↩️ Reset
        </Button>
      </div>
    </div>
  );
}
```

### Step 3: Integrate into Layout (5 minutes)

Add settings tab to main page:

```tsx
// In apps/control/src/app/page.tsx — add to tabs

import { SettingsPanel } from '@/components/settings-panel';

// Add to TabsList:
<TabsTrigger value="settings">⚙️ Settings</TabsTrigger>

// Add TabsContent:
<TabsContent value="settings" className="mt-4">
  <SettingsPanel />
</TabsContent>
```

---

## ✅ CHECKLIST

- [ ] Settings API routes (GET and PUT)
- [ ] Model selector dropdown (shows available models)
- [ ] Temperature and max tokens sliders
- [ ] System prompt textarea
- [ ] Memory settings (alpha, decay, limits)
- [ ] MCP server status display
- [ ] Save button with feedback
- [ ] Reset button

---

## 💡 KEY TAKEAWAY

**The settings panel turns Lunar from a developer tool into a configurable product. Users can change the model, adjust creativity, edit the personality, and manage tools — all from a browser. This is the difference between a CLI tool and a real application. The key pattern: Next.js API routes proxy to your Gateway, keeping the backend URL flexible.**

---

**Next → [Day 45: Polish, Dark Mode, and Week 9 Wrap](day-45.md)**
