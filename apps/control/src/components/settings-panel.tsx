'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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
    hybridAlpha: number;
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
            This defines Lunar&apos;s personality and behavior
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
