import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

interface ModelVersion {
  version: string;
  name: string;
  baseModel: string;
  method: 'modelfile' | 'lora' | 'qlora' | 'full';
  createdAt: string;
  training: {
    dataVersion: string;
    exampleCount: number;
    epochs: number;
    loraRank?: number;
    learningRate?: number;
    batchSize?: number;
    trainingTimeSeconds?: number;
  };
  evaluation: {
    overall: number;
    style: number;
    toolCalling: number;
    format: number;
    safety: number;
  };
  files: {
    adapter?: string;   // Path to LoRA adapter
    gguf?: string;      // Path to GGUF file
    ollamaModel?: string; // Ollama model name
  };
  notes: string;
  active: boolean;
}

interface Registry {
  projectName: string;
  versions: ModelVersion[];
}

const REGISTRY_PATH = './data/model-registry.json';

function loadRegistry(): Registry {
  if (existsSync(REGISTRY_PATH)) {
    return JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8'));
  }
  return { projectName: 'lunar', versions: [] };
}

function saveRegistry(registry: Registry): void {
  const dir = REGISTRY_PATH.split('/').slice(0, -1).join('/');
  mkdirSync(dir, { recursive: true });
  writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));
}

export function registerModel(version: Omit<ModelVersion, 'active'>): void {
  const registry = loadRegistry();
  
  // Deactivate all others
  registry.versions.forEach(v => v.active = false);
  
  // Add new version as active
  registry.versions.push({ ...version, active: true });
  
  saveRegistry(registry);
  console.log(`✅ Registered ${version.name} v${version.version}`);
}

export function listModels(): void {
  const registry = loadRegistry();
  
  console.log(`\n🌙 ${registry.projectName} Model Registry`);
  console.log('═'.repeat(60));
  
  for (const v of registry.versions) {
    const active = v.active ? ' ← ACTIVE' : '';
    console.log(`\n  ${v.name} v${v.version}${active}`);
    console.log(`  Base: ${v.baseModel} | Method: ${v.method}`);
    console.log(`  Data: ${v.training.exampleCount} examples (${v.training.dataVersion})`);
    console.log(`  Eval: overall=${(v.evaluation.overall * 100).toFixed(0)}% | style=${(v.evaluation.style * 100).toFixed(0)}% | tools=${(v.evaluation.toolCalling * 100).toFixed(0)}%`);
    if (v.files.ollamaModel) {
      console.log(`  Ollama: ${v.files.ollamaModel}`);
    }
  }
}

export function getActiveModel(): ModelVersion | null {
  const registry = loadRegistry();
  return registry.versions.find(v => v.active) || null;
}

export function activateVersion(version: string): void {
  const registry = loadRegistry();
  registry.versions.forEach(v => {
    v.active = v.version === version;
  });
  saveRegistry(registry);
  const active = registry.versions.find(v => v.active);
  if (active) {
    console.log(`✅ Activated ${active.name} v${active.version}`);
  }
}

// Register the base model
registerModel({
  version: '1.0',
  name: 'lunar',
  baseModel: 'llama3.2:3b',
  method: 'modelfile',
  createdAt: new Date().toISOString(),
  training: {
    dataVersion: 'n/a',
    exampleCount: 0,
    epochs: 0,
  },
  evaluation: {
    overall: 0.52,
    style: 0.60,
    toolCalling: 0.40,
    format: 0.55,
    safety: 0.50,
  },
  files: {
    ollamaModel: 'lunar-custom',
  },
  notes: 'Base model with Modelfile customization only',
});
