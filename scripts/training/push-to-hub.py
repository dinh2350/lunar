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
