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
