# Day 65 — Model Registry + Week 13 Wrap

> 🎯 **DAY GOAL:** Build a model registry to manage fine-tuned versions, share on HuggingFace, and wrap up Week 13

---

## 📚 CONCEPT 1: Model Version Management

### WHAT — Track Your Models Like Code

**A model registry tracks every fine-tuned version: training data used, hyperparameters, eval scores, and the model files. Like git for models.**

```
MODEL REGISTRY:
┌──────────────────────────────────────────────────────┐
│ lunar-v1.0 (base)                                     │
│   Model: llama3.2:3b                                  │
│   Method: Ollama Modelfile only                       │
│   Eval: style=60%, tools=40%, overall=52%             │
│                                                       │
│ lunar-v1.1 (first fine-tune)                          │
│   Model: llama3.2:3b + LoRA                           │
│   Data: 200 examples (v1)                             │
│   Config: r=16, lr=2e-4, epochs=3                     │
│   Eval: style=85%, tools=75%, overall=78%  ↑26%       │
│                                                       │
│ lunar-v1.2 (more tool data)                           │
│   Model: llama3.2:3b + LoRA                           │
│   Data: 350 examples (v2, +150 tool examples)         │
│   Config: r=16, lr=1e-4, epochs=2                     │
│   Eval: style=85%, tools=90%, overall=86%  ↑8%        │
│                                                       │
│ lunar-v1.2 ← ACTIVE (deployed in Ollama)              │
└──────────────────────────────────────────────────────┘
```

---

## 🔨 HANDS-ON: Build Model Registry

### Step 1: Registry Manager (20 minutes)

Create `scripts/training/registry.ts`:

```typescript
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
```

### Step 2: Push to HuggingFace (15 minutes)

Create `scripts/training/push-to-hub.py`:

```python
"""
Push fine-tuned Lunar model to HuggingFace Hub.

Setup:
  pip install huggingface_hub
  huggingface-cli login  (paste your token from https://huggingface.co/settings/tokens)
"""

from huggingface_hub import HfApi, create_repo

# Config
HF_USERNAME = "your-username"  # Change this!
MODEL_NAME = "lunar-agent-3b"
VERSION = "v1.1"
ADAPTER_DIR = "./lunar-finetuned/lora"
GGUF_DIR = "./lunar-finetuned/gguf"

def push_to_hub():
    api = HfApi()
    repo_id = f"{HF_USERNAME}/{MODEL_NAME}"
    
    # Create repo if doesn't exist
    try:
        create_repo(repo_id, exist_ok=True, private=True)
        print(f"📦 Repository: https://huggingface.co/{repo_id}")
    except Exception as e:
        print(f"   Repo exists or error: {e}")
    
    # Upload LoRA adapter
    print("⬆️  Uploading LoRA adapter...")
    api.upload_folder(
        folder_path=ADAPTER_DIR,
        repo_id=repo_id,
        path_in_repo=f"lora/{VERSION}",
        commit_message=f"Upload LoRA adapter {VERSION}",
    )
    
    # Upload GGUF (for Ollama users)
    print("⬆️  Uploading GGUF...")
    api.upload_folder(
        folder_path=GGUF_DIR,
        repo_id=repo_id,
        path_in_repo=f"gguf/{VERSION}",
        commit_message=f"Upload GGUF {VERSION}",
    )
    
    # Create model card
    model_card = f"""---
tags:
  - lunar
  - ai-agent
  - tool-calling
  - qlora
base_model: meta-llama/Llama-3.2-3B-Instruct
license: llama3.2
---

# Lunar Agent 3B ({VERSION})

Fine-tuned Llama 3.2 3B for the Lunar AI agent platform.

## Features
- Custom Lunar personality and style
- Tool-calling format (<tool_call> tags)
- Memory management integration
- Safety guardrails

## Usage with Ollama
```bash
# Download GGUF
wget https://huggingface.co/{repo_id}/resolve/main/gguf/{VERSION}/unsloth.Q4_K_M.gguf

# Create Ollama model
cat > Modelfile << 'EOF'
FROM ./unsloth.Q4_K_M.gguf
SYSTEM "You are Lunar, a helpful AI agent."
PARAMETER temperature 0.7
EOF

ollama create lunar-ft -f Modelfile
```

## Evaluation
| Category | Score |
|----------|-------|
| Style | 85% |
| Tool-calling | 75% |
| Format | 80% |
| Safety | 90% |
| **Overall** | **78%** |
"""
    
    api.upload_file(
        path_or_fileobj=model_card.encode(),
        path_in_repo="README.md",
        repo_id=repo_id,
        commit_message="Update model card",
    )
    
    print(f"\n✅ Pushed to https://huggingface.co/{repo_id}")

if __name__ == "__main__":
    push_to_hub()
```

---

## 📋 Week 13 Summary

### What We Built

| Day | Topic | Key Output |
|-----|-------|------------|
| 61 | Fine-tuning fundamentals | Decision tree, LoRA/QLoRA concepts, Modelfile |
| 62 | Training data preparation | Full data pipeline: collect → clean → format |
| 63 | Fine-tuning with Unsloth | Complete QLoRA training script |
| 64 | Evaluation + iteration | Eval suite, comparison, iteration guide |
| 65 | Model registry + sharing | Registry manager, HuggingFace push |

### File Structure

```
scripts/training/
├── collect-data.ts      # Gather conversations from logs
├── clean-data.ts        # PII redaction, quality filter, dedup
├── format-data.ts       # Convert to ChatML JSONL
├── pipeline.ts          # Full ETL pipeline
├── finetune.py          # Unsloth QLoRA training
├── eval-finetune.py     # Compare base vs. fine-tuned
├── registry.ts          # Model version management
└── push-to-hub.py       # HuggingFace upload

packages/agent/
└── Modelfile            # Ollama model customization

data/
├── training/
│   ├── train.jsonl      # Training split
│   ├── val.jsonl        # Validation split
│   └── full.jsonl       # Complete dataset
└── model-registry.json  # Version tracking
```

### Key Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Fine-tune tool | Unsloth | 2x faster, 60% less VRAM, free |
| Method | QLoRA | Fits in 6 GB VRAM |
| Base model | Llama 3.2 3B | Small enough for consumer hardware |
| Export format | GGUF (q4_k_m) | Compatible with Ollama |
| LoRA rank | 16 | Good capacity without overparameterizing |

---

## ✅ WEEK 13 CHECKLIST

- [ ] Understand when to fine-tune vs. prompt vs. RAG
- [ ] Training data pipeline collects real + synthetic examples
- [ ] Data cleaned (PII removed, quality filtered, deduplicated)
- [ ] ChatML JSONL format with train/val split
- [ ] QLoRA fine-tuning runs on free Colab T4
- [ ] Model exports to GGUF for Ollama
- [ ] Evaluation compares base vs. fine-tuned per category
- [ ] Iteration loop: evaluate → add data → retrain
- [ ] Model registry tracks versions + eval scores
- [ ] Can push to HuggingFace Hub

---

## 💡 KEY TAKEAWAY

**Fine-tuning is a workflow, not a one-time event: collect data → clean → train → evaluate → iterate. Use QLoRA (via Unsloth) to fine-tune on consumer hardware. Export to GGUF for Ollama. Track every version in a registry with eval scores so you can always roll back. Share on HuggingFace when ready. The most important insight: 80% of fine-tuning success is in data quality, not model architecture or hyperparameters.**

---

**Next → [Week 14: Multimodal AI](../week-14-multimodal/day-66.md)**
