# Day 63 — Fine-tuning with Unsloth

> 🎯 **DAY GOAL:** Run your first QLoRA fine-tuning job using Unsloth — 2x faster than standard training, fits on consumer GPU

---

## 📚 CONCEPT 1: Unsloth — Why It's the Best Free Option

### WHAT — Simple Definition

**Unsloth is a Python library that makes LoRA/QLoRA fine-tuning 2x faster and uses 60% less memory. It patches the model internals for efficiency. Perfect for consumer hardware.**

```
UNSLOTH vs. STANDARD:
                     Standard HF    Unsloth
  Training speed:    1x             2x faster
  VRAM usage:        8-12 GB        4-6 GB
  Cost:              Free           Free
  GPU needed:        RTX 3060+      RTX 3060+ (or free Colab)
  Setup:             Complex        Simple (4 lines)

SUPPORTED MODELS:
  ✅ Llama 3.2 (1B, 3B)
  ✅ Llama 3.1 (8B)
  ✅ Mistral (7B)
  ✅ Phi-3 (3.8B)
  ✅ Gemma 2 (2B, 9B)
  ✅ Qwen 2.5 (0.5B - 72B)
```

### WHY Unsloth for Lunar

```
LUNAR FINE-TUNING PATH:
  1. No GPU?    → Use Google Colab (free T4 GPU)
  2. Have GPU?  → Run locally with Unsloth
  3. M1/M2 Mac? → Use MLX (alternative, Day 64)

WHAT WE'LL TRAIN:
  Base model:  Llama 3.2 3B (fits in 4 GB VRAM with Q4)
  Method:      QLoRA (4-bit quantized + LoRA adapters)
  Data:        Our training data from Day 62
  Goal:        Teach Lunar's style + tool-calling format
  Time:        ~30 min on free Colab T4
```

---

## 🔨 HANDS-ON: Fine-tune Llama 3.2 for Lunar

### Step 1: Setup Environment (10 minutes)

Create `scripts/training/finetune.py`:

```python
"""
Lunar Fine-tuning Script using Unsloth
Run on: Google Colab (free) or local GPU (RTX 3060+)

Setup:
  pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"
  pip install --no-deps trl peft accelerate bitsandbytes
"""

from unsloth import FastLanguageModel
import torch

# ─── Config ───
MODEL_NAME = "unsloth/Llama-3.2-3B-Instruct-bnb-4bit"  # Pre-quantized
MAX_SEQ_LENGTH = 2048
LORA_R = 16          # LoRA rank (higher = more capacity, more VRAM)
LORA_ALPHA = 16      # Scaling factor (usually = r)
LORA_DROPOUT = 0     # 0 = Unsloth optimized
OUTPUT_DIR = "./lunar-finetuned"

print("📦 Loading model...")
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name=MODEL_NAME,
    max_seq_length=MAX_SEQ_LENGTH,
    dtype=None,        # Auto-detect (float16 for GPU)
    load_in_4bit=True, # QLoRA!
)

# ─── Add LoRA Adapters ───
print("🔧 Adding LoRA adapters...")
model = FastLanguageModel.get_peft_model(
    model,
    r=LORA_R,
    target_modules=[
        "q_proj", "k_proj", "v_proj", "o_proj",  # Attention
        "gate_proj", "up_proj", "down_proj",       # FFN
    ],
    lora_alpha=LORA_ALPHA,
    lora_dropout=LORA_DROPOUT,
    bias="none",
    use_gradient_checkpointing="unsloth",  # 60% less VRAM
    random_state=42,
)

print(f"  Trainable params: {model.print_trainable_parameters()}")
```

### Step 2: Load Training Data (10 minutes)

Add to `finetune.py`:

```python
from datasets import load_dataset
from unsloth.chat_templates import get_chat_template

# ─── Set Chat Template ───
tokenizer = get_chat_template(
    tokenizer,
    chat_template="llama-3.1",  # Llama 3 format
)

# ─── Load Our Data ───
print("📊 Loading training data...")

# Load from our JSONL files
dataset = load_dataset(
    "json",
    data_files={
        "train": "./data/training/train.jsonl",
        "validation": "./data/training/val.jsonl",
    },
)

def format_example(example):
    """Convert our ChatML format to the model's expected format"""
    messages = example["messages"]
    text = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=False,
    )
    return {"text": text}

train_dataset = dataset["train"].map(format_example)
val_dataset = dataset["validation"].map(format_example)

print(f"  Train: {len(train_dataset)} examples")
print(f"  Val:   {len(val_dataset)} examples")
print(f"  Sample: {train_dataset[0]['text'][:200]}...")
```

### Step 3: Train! (15 minutes)

Add to `finetune.py`:

```python
from trl import SFTTrainer
from transformers import TrainingArguments

# ─── Training Config ───
print("🚀 Starting training...")

trainer = SFTTrainer(
    model=model,
    tokenizer=tokenizer,
    train_dataset=train_dataset,
    eval_dataset=val_dataset,
    dataset_text_field="text",
    max_seq_length=MAX_SEQ_LENGTH,
    dataset_num_proc=2,
    packing=False,       # True for short examples (faster)
    args=TrainingArguments(
        # Output
        output_dir=OUTPUT_DIR,
        
        # Training
        per_device_train_batch_size=2,
        gradient_accumulation_steps=4,  # Effective batch = 2*4 = 8
        num_train_epochs=3,
        warmup_steps=5,
        
        # Optimizer
        learning_rate=2e-4,
        weight_decay=0.01,
        optim="adamw_8bit",  # 8-bit Adam (saves VRAM)
        lr_scheduler_type="linear",
        
        # Logging
        logging_steps=10,
        eval_strategy="steps",
        eval_steps=50,
        save_strategy="steps",
        save_steps=100,
        
        # Speed
        fp16=not torch.cuda.is_bf16_supported(),
        bf16=torch.cuda.is_bf16_supported(),
        
        # Misc
        seed=42,
        report_to="none",  # Set to "wandb" for experiment tracking
    ),
)

# Train!
stats = trainer.train()
print(f"\n✅ Training complete!")
print(f"   Total steps:  {stats.global_step}")
print(f"   Train loss:   {stats.training_loss:.4f}")
print(f"   Train time:   {stats.metrics['train_runtime']:.0f}s")
```

### Step 4: Save and Export (10 minutes)

Add to `finetune.py`:

```python
# ─── Save LoRA Adapter ───
print("💾 Saving LoRA adapter...")
model.save_pretrained(f"{OUTPUT_DIR}/lora")
tokenizer.save_pretrained(f"{OUTPUT_DIR}/lora")
print(f"   Saved to {OUTPUT_DIR}/lora/")

# ─── Export to GGUF for Ollama ───
print("📦 Exporting to GGUF (for Ollama)...")
model.save_pretrained_gguf(
    f"{OUTPUT_DIR}/gguf",
    tokenizer,
    quantization_method="q4_k_m",  # Best quality/size ratio
)
print(f"   Saved to {OUTPUT_DIR}/gguf/")

# ─── Test the Model ───
print("\n🧪 Testing fine-tuned model...")
FastLanguageModel.for_inference(model)

messages = [
    {"role": "system", "content": "You are Lunar, a helpful AI agent."},
    {"role": "user", "content": "Remember that I prefer dark mode"},
]

inputs = tokenizer.apply_chat_template(
    messages,
    tokenize=True,
    add_generation_prompt=True,
    return_tensors="pt",
).to("cuda")

outputs = model.generate(
    input_ids=inputs,
    max_new_tokens=200,
    temperature=0.7,
)

response = tokenizer.decode(outputs[0], skip_special_tokens=True)
print(f"\n  Response: {response}")
```

### Step 5: Import to Ollama (5 minutes)

```bash
# Create Ollama model from GGUF
# The GGUF file will be at: ./lunar-finetuned/gguf/unsloth.Q4_K_M.gguf

cat > Modelfile.finetuned << 'EOF'
FROM ./lunar-finetuned/gguf/unsloth.Q4_K_M.gguf

SYSTEM "You are Lunar, a helpful AI agent built with Node.js."
PARAMETER temperature 0.7
PARAMETER top_p 0.9
PARAMETER num_ctx 2048
EOF

ollama create lunar-ft -f Modelfile.finetuned
ollama run lunar-ft "What tools do you have?"
```

---

## ✅ CHECKLIST

- [ ] Unsloth installed (Colab or local)
- [ ] Model loaded in 4-bit (QLoRA)
- [ ] LoRA adapters added to attention + FFN layers
- [ ] Training data loaded from JSONL
- [ ] Chat template applied correctly
- [ ] Training completed (3 epochs)
- [ ] LoRA adapter saved
- [ ] Exported to GGUF (q4_k_m)
- [ ] Imported into Ollama
- [ ] Test conversation works

---

## 💡 KEY TAKEAWAY

**Fine-tuning with Unsloth is straightforward: load model (4-bit) → add LoRA → train → export to GGUF → import to Ollama. The entire process takes ~30 minutes on a free Colab T4. The key settings: LoRA rank=16, learning rate=2e-4, 3 epochs, batch size 8 (effective). Export to GGUF with q4_k_m quantization for the best quality/size ratio when running in Ollama.**

---

## ❓ SELF-CHECK QUESTIONS

1. Why do we target attention AND FFN layers with LoRA?
2. What does `gradient_accumulation_steps=4` do?
3. Why use `adamw_8bit` instead of regular AdamW?
4. What's the difference between saving LoRA adapter vs. GGUF?
5. How would you know if the model is overfitting?

---

**Next → [Day 64: Evaluation + Iteration](day-64.md)**
