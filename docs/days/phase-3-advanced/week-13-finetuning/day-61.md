# Day 61 — Fine-tuning Fundamentals

> 🎯 **DAY GOAL:** Understand what fine-tuning is, when to use it vs. prompting, and the key concepts (LoRA, adapters, quantization)

---

## 📚 CONCEPT 1: What Is Fine-tuning?

### WHAT — Simple Definition

**Fine-tuning = Taking a pre-trained LLM and training it further on YOUR specific data so it learns YOUR patterns, terminology, and style. Like hiring a general worker and then giving them specialized training for your company.**

```
PRE-TRAINED MODEL              FINE-TUNED MODEL
┌────────────────┐             ┌────────────────┐
│ Knows: English │             │ Knows: English │
│ Knows: Code    │   + YOUR    │ Knows: Code    │
│ Knows: General │ ──DATA──▶   │ Knows: General │
│ Knowledge      │             │ + YOUR style   │
│                │             │ + YOUR terms   │
│                │             │ + YOUR format  │
└────────────────┘             └────────────────┘

ANALOGY:
  Pre-trained = University graduate (broad knowledge)
  Fine-tuned  = After 6 months at YOUR company (knows your stuff)
```

### WHEN — Fine-tuning vs. Prompting Decision Tree

```
START
  │
  ├─ Does prompting work well enough? ──YES──▶ DON'T FINE-TUNE
  │
  ├─ Do you need a specific output format
  │  that prompting can't achieve? ──YES──▶ FINE-TUNE
  │
  ├─ Do you need domain-specific knowledge
  │  not in the base model? ──YES──▶ RAG first, then fine-tune if needed
  │
  ├─ Do you need faster/cheaper inference?
  │  (shorter prompts) ──YES──▶ FINE-TUNE
  │
  ├─ Do you have < 100 training examples? ──YES──▶ DON'T FINE-TUNE (not enough data)
  │
  └─ Do you have 100-10000+ examples? ──YES──▶ FINE-TUNE ✅

COST COMPARISON:
  Prompting: $0 training, longer prompts, flexible
  RAG:       $0 training, retrieval cost, up-to-date
  Fine-tune: Training cost, shorter prompts, specialized
```

### WHY for Lunar

```
LUNAR USE CASES FOR FINE-TUNING:
1. Response style — Make Lunar sound like YOUR brand
2. Tool selection — Learn which tool to use for which query
3. Output format — Always return structured JSON
4. Domain knowledge — Learn your company's internal terms
5. Smaller model — Fine-tune a 3B model to match 7B quality
```

---

## 📚 CONCEPT 2: LoRA — The Efficient Way

### WHAT — Low-Rank Adaptation

```
FULL FINE-TUNING (expensive):
  Update ALL 7 billion parameters
  Needs: 28+ GB VRAM
  Time: Hours to days
  Cost: $$$$

LoRA (efficient):
  Freeze original weights
  Add small "adapter" layers (0.1-1% of parameters)
  Train ONLY the adapters
  Needs: 6-8 GB VRAM
  Time: Minutes to hours
  Cost: $ (or free locally!)

HOW LoRA WORKS:
┌─────────────────────────┐
│ Original Weight Matrix  │  ← FROZEN (not changed)
│      W (d × d)          │
│                         │
│  + ┌───┐   ┌───┐       │
│    │ A │ × │ B │       │  ← TRAINED (tiny matrices)
│    │d×r│   │r×d│       │     r = rank (4-64, usually 16)
│    └───┘   └───┘       │
│                         │
│  Output = W·x + A·B·x  │
└─────────────────────────┘

  If d = 4096, r = 16:
    Full: 4096 × 4096 = 16.7M params
    LoRA: (4096×16) + (16×4096) = 131K params (0.8%!)
```

### 🔗 NODE.JS ANALOGY

```javascript
// LoRA is like middleware that wraps a function
// The original function (model) stays unchanged
// The middleware (adapter) modifies the behavior

const originalHandler = (req) => baseModel(req);  // Frozen

// LoRA adapter
const adapter = (req) => {
  const base = originalHandler(req);
  const adjustment = loraWeights(req);  // Small extra computation
  return base + adjustment;              // Combined output
};
```

---

## 📚 CONCEPT 3: Quantization — Making Models Smaller

### WHAT — Reduce Number Precision

```
QUANTIZATION LEVELS:
  FP32 (full)  → 4 bytes per param → 7B model = 28 GB  ← Too big
  FP16 (half)  → 2 bytes per param → 7B model = 14 GB  ← Better
  INT8 (8-bit) → 1 byte per param  → 7B model = 7 GB   ← Good
  INT4 (4-bit) → 0.5 bytes/param   → 7B model = 3.5 GB ← Great!

QUALITY vs. SIZE TRADEOFF:
  FP16: ████████████████████ 100% quality, 14 GB
  INT8: ███████████████████  ~99% quality,  7 GB
  INT4: █████████████████    ~95% quality,  3.5 GB
  INT2: ██████████████       ~85% quality,  1.7 GB ← Too low

SWEET SPOT: Q4_K_M (4-bit with important layers kept at higher precision)
  → This is what Ollama uses by default!
```

### QLoRA = Quantization + LoRA

```
QLoRA FLOW:
  1. Load base model in 4-bit (saves VRAM)
  2. Add LoRA adapters in FP16 (full precision for training)
  3. Train only the adapters
  4. Result: Fine-tuned model that fits in 6 GB VRAM

  Regular fine-tuning:  28 GB VRAM needed
  LoRA:                  8 GB VRAM needed
  QLoRA:                 6 GB VRAM needed ← We'll use this!
```

---

## 🔨 HANDS-ON: Explore Fine-tuning Tools

### Step 1: Survey the Landscape (15 minutes)

```markdown
## Fine-tuning Tools for Lunar

| Tool | What It Does | Cost | Difficulty |
|------|-------------|------|-----------|
| Unsloth | QLoRA fine-tuning, 2x faster | Free (local) | Medium |
| Axolotl | Config-based fine-tuning | Free (local) | Medium |
| HuggingFace TRL | Official training library | Free (local) | Hard |
| OpenAI Fine-tuning | API-based fine-tuning | $$ per token | Easy |
| Together AI | API fine-tuning + hosting | $$ per hour | Easy |
| Ollama modelfile | Simple prompt tuning (NOT real fine-tuning) | Free | Very Easy |

FOR LUNAR (zero-cost priority):
  1. Ollama Modelfile → Customize system prompt + parameters (Day 62)
  2. Unsloth QLoRA   → Real fine-tuning on your data (Day 63-64)
  3. HuggingFace Hub → Share your model (Day 65)
```

### Step 2: Understand Training Data Format (15 minutes)

```jsonl
// ChatML format (most common for chat fine-tuning)
{"messages": [{"role": "system", "content": "You are Lunar, a helpful AI agent."}, {"role": "user", "content": "What's the weather?"}, {"role": "assistant", "content": "Let me check that for you.\n\n<tool_call>{\"name\": \"get_weather\", \"args\": {\"city\": \"current\"}}</tool_call>"}]}
{"messages": [{"role": "system", "content": "You are Lunar, a helpful AI agent."}, {"role": "user", "content": "Remember that I like Python"}, {"role": "assistant", "content": "Got it! I'll remember that you prefer Python. I've saved this to your preferences."}]}
```

```
TRAINING DATA REQUIREMENTS:
  Minimum:    50-100 examples (for style/format changes)
  Good:       500-1000 examples
  Great:      5000+ examples
  
  Quality > Quantity!
  50 excellent examples > 5000 mediocre ones
```

### Step 3: Create Ollama Modelfile (10 minutes)

Create `packages/agent/Modelfile`:

```dockerfile
# Lunar custom model based on Llama 3.2
FROM llama3.2:3b

# System prompt baked into the model
SYSTEM """You are Lunar, an AI agent built with Node.js.

PERSONALITY:
- Helpful, concise, technical
- You use tools when needed
- You remember user preferences
- You format responses in Markdown

TOOL CALLING:
When you need to use a tool, output:
<tool_call>{"name": "tool_name", "args": {...}}</tool_call>

Available tools: search_memory, save_memory, get_weather, run_code

Always explain what you're doing before calling a tool.
"""

# Model parameters
PARAMETER temperature 0.7
PARAMETER top_p 0.9
PARAMETER top_k 40
PARAMETER num_ctx 4096
PARAMETER stop "<|end|>"
PARAMETER stop "<|eot_id|>"

# Template (Llama 3 chat format)
TEMPLATE """{{ if .System }}<|start_header_id|>system<|end_header_id|>

{{ .System }}<|eot_id|>{{ end }}{{ if .Prompt }}<|start_header_id|>user<|end_header_id|>

{{ .Prompt }}<|eot_id|>{{ end }}<|start_header_id|>assistant<|end_header_id|>

{{ .Response }}<|eot_id|>"""
```

```bash
# Create and test
ollama create lunar-custom -f Modelfile
ollama run lunar-custom "What can you do?"
```

---

## ✅ CHECKLIST

- [ ] Understand: fine-tuning = further training on your data
- [ ] Decision tree: when to fine-tune vs. prompt vs. RAG
- [ ] LoRA: train tiny adapter layers (0.1-1% of params)
- [ ] QLoRA: quantized base + LoRA = fits in 6 GB VRAM
- [ ] Quantization levels: FP16 → INT8 → INT4 (tradeoffs)
- [ ] Training data: JSONL ChatML format
- [ ] Ollama Modelfile created for Lunar

---

## 💡 KEY TAKEAWAY

**Fine-tuning is NOT always the answer. Start with prompting → add RAG → fine-tune only when needed. When you do fine-tune, use QLoRA — it lets you train on consumer hardware (6 GB VRAM) by freezing the base model and only training tiny adapter layers. For Lunar, start with an Ollama Modelfile (Day 62), then explore real fine-tuning with Unsloth (Day 63-64) if you need more customization.**

---

## ❓ SELF-CHECK QUESTIONS

1. What's the difference between fine-tuning and RAG?
2. Why is LoRA more efficient than full fine-tuning?
3. What does QLoRA add on top of LoRA?
4. How many training examples do you need minimum?
5. When should you NOT fine-tune?

---

**Next → [Day 62: Training Data Preparation](day-62.md)**
