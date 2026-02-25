from dataclasses import dataclass, field
from typing import Any

@dataclass
class Variant:
    """One side of an A/B test"""
    name: str
    description: str
    config: dict[str, Any]

@dataclass
class ABTest:
    """Definition of an A/B test"""
    id: str
    name: str
    hypothesis: str
    variant_a: Variant
    variant_b: Variant
    test_cases: list[str] = field(default_factory=list)

PROMPT_AB_TEST = ABTest(
    id="prompt-memory-v1",
    name="Memory-aware prompt vs default",
    hypothesis="Adding memory instructions will improve tool usage",
    variant_a=Variant(
        name="default",
        description="Current system prompt",
        config={
            "system_prompt": "You are Lunar, a helpful AI assistant.",
        }
    ),
    variant_b=Variant(
        name="memory-aware",
        description="Prompt that emphasizes memory usage",
        config={
            "system_prompt": (
                "You are Lunar, an AI assistant with persistent memory. "
                "Always search your memory before answering questions about "
                "the user. Use tools proactively to provide accurate information."
            ),
        }
    ),
)

MODEL_AB_TEST = ABTest(
    id="model-qwen-vs-gemma",
    name="Qwen 2.5 7B vs Gemma 2 9B",
    hypothesis="Gemma 2 will be better at conversation but worse at tool usage",
    variant_a=Variant(
        name="qwen2.5:3b",
        description="Default Qwen model",
        config={"model": "qwen2.5:3b"}
    ),
    variant_b=Variant(
        name="gemma2:9b",
        description="Google Gemma 2 model",
        config={"model": "gemma2:9b"}
    ),
)

TEMPERATURE_AB_TEST = ABTest(
    id="temp-low-vs-high",
    name="Temperature 0.3 vs 0.7",
    hypothesis="Lower temperature will improve factual accuracy but hurt creativity",
    variant_a=Variant(
        name="temp-0.3",
        description="Low temperature (more precise)",
        config={"temperature": 0.3}
    ),
    variant_b=Variant(
        name="temp-0.7",
        description="Higher temperature (more creative)",
        config={"temperature": 0.7}
    ),
)
