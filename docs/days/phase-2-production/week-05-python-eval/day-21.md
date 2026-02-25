# Day 21 — Python Crash Course for Node.js Developers

> 🎯 **DAY GOAL:** Learn Python basics by mapping every concept to Node.js — enough to read AI papers and write evaluation scripts

---

## 📚 CONCEPT 1: Why Python Matters for AI Engineers

### WHAT — Simple Definition

**Python is the lingua franca of AI/ML.** Most AI tools, papers, libraries, and examples are in Python. You don't need to become a Python expert — you need to be **bilingual** (TypeScript + Python).

### WHY — Why Not Just Use TypeScript?

```
AI ecosystem language distribution:
  Python: ~85% (PyTorch, TensorFlow, HuggingFace, LangChain, etc.)
  TypeScript/JS: ~10% (LangChain.js, Vercel AI SDK)
  Other: ~5%

You need Python for:
  ✅ Running evaluation frameworks (DeepEval, RAGAS)
  ✅ Fine-tuning models (HuggingFace, LoRA)
  ✅ Reading research papers (code samples are Python)
  ✅ Using ML libraries (scikit-learn, pandas, numpy)
  ✅ Job interviews (most AI coding tests are Python)
  ✅ Understanding open-source AI projects

You DON'T need Python for:
  ❌ Your Lunar agent (stays TypeScript!)
  ❌ Web API development (Fastify is better)
  ❌ Frontend (obviously)
```

### WHEN — Where Does Python Fit in Lunar?

```
┌────────────────────────────────┐
│  LUNAR (TypeScript)            │  ← Your main codebase
│  Gateway + Agent + Memory      │
└──────────┬─────────────────────┘
           │ HTTP calls
┌──────────▼─────────────────────┐
│  EVAL SERVICE (Python)         │  ← Small Python service
│  FastAPI + DeepEval            │
│  POST /eval/rag                │
│  POST /eval/conversation       │
└────────────────────────────────┘
```

### 🔗 NODE.JS ANALOGY

```
Learning Python as a Node.js dev is like learning SQL:
  - You don't rewrite your app in SQL
  - You use SQL where it's the best tool (databases)
  - You use Python where it's the best tool (ML/AI evaluation)
  - You connect them via APIs
```

---

## 📚 CONCEPT 2: Python ↔ Node.js Translation Table

### The Rosetta Stone

| Concept | Node.js / TypeScript | Python |
|---|---|---|
| **Run file** | `node app.js` / `tsx app.ts` | `python app.py` |
| **REPL** | `node` | `python` |
| **Package manager** | `pnpm` / `npm` | `pip` / `uv` |
| **Lock file** | `pnpm-lock.yaml` | `requirements.txt` / `pyproject.toml` |
| **Virtual env** | not needed (node_modules) | `python -m venv .venv` |
| **Import** | `import x from 'x'` | `import x` or `from x import y` |
| **Variable** | `const x = 5` | `x = 5` (no keyword!) |
| **Type hint** | `let x: number = 5` | `x: int = 5` (optional!) |
| **Function** | `function add(a, b) { return a + b }` | `def add(a, b): return a + b` |
| **Arrow fn** | `const add = (a, b) => a + b` | `add = lambda a, b: a + b` |
| **Array** | `[1, 2, 3]` | `[1, 2, 3]` (called "list") |
| **Object** | `{ name: "Hao" }` | `{"name": "Hao"}` (called "dict") |
| **Template string** | `` `Hello ${name}` `` | `f"Hello {name}"` |
| **For loop** | `for (const x of arr)` | `for x in arr:` |
| **If/else** | `if (x) { } else { }` | `if x:` ... `else:` |
| **Null** | `null` / `undefined` | `None` |
| **Boolean** | `true` / `false` | `True` / `False` |
| **Console** | `console.log(x)` | `print(x)` |
| **Async** | `async function f() { await x }` | `async def f(): await x` |
| **Try/catch** | `try { } catch(e) { }` | `try: ... except Exception as e:` |
| **Class** | `class Foo { constructor() {} }` | `class Foo: def __init__(self):` |
| **Spread** | `[...arr1, ...arr2]` | `[*arr1, *arr2]` |
| **Destructure** | `const { a, b } = obj` | `a, b = obj["a"], obj["b"]` |

---

## 🔨 HANDS-ON: Python Setup + First Scripts

### Step 1: Install Python (10 minutes)

```bash
# macOS — Python 3 is likely already installed
python3 --version
# If not: brew install python@3.12

# Create a Python workspace for Lunar evaluation
mkdir -p ~/Documents/project/lunar/services/eval
cd ~/Documents/project/lunar/services/eval

# Create virtual environment (= node_modules for Python)
python3 -m venv .venv

# Activate virtual environment
source .venv/bin/activate
# Your prompt will now show (.venv)

# Verify
which python    # → .venv/bin/python
which pip       # → .venv/bin/pip
```

**Virtual Environment = node_modules:**
```
Node.js:                          Python:
  pnpm install                      pip install package
  → goes to node_modules/            → goes to .venv/lib/
  package.json                      requirements.txt
  pnpm-lock.yaml                    (lock file varies)
```

### Step 2: Python Basics Script (20 minutes)

Create `services/eval/basics.py`:

```python
# ---- Variables (no const/let/var!) ----
name = "Hao"              # str (like TypeScript string)
age = 25                  # int
height = 1.75             # float
is_dev = True             # bool (capital T!)
skills = ["node", "ts"]   # list (like array)
profile = {"name": name, "age": age}  # dict (like object)

print(f"Hello {name}, you know {len(skills)} languages")
# f-string = template literal

# ---- Functions ----
def greet(name: str, excited: bool = False) -> str:
    """Greets a person. This is a docstring (like JSDoc)."""
    if excited:
        return f"HEY {name.upper()}!!!"
    return f"Hello, {name}"

print(greet("Hao"))            # Hello, Hao
print(greet("Hao", excited=True))  # HEY HAO!!!
# Python uses named arguments a lot!

# ---- Lists (= arrays) ----
numbers = [1, 2, 3, 4, 5]
doubled = [n * 2 for n in numbers]           # List comprehension = .map()
evens = [n for n in numbers if n % 2 == 0]   # = .filter()
total = sum(numbers)                          # = .reduce()

print(f"doubled: {doubled}")   # [2, 4, 6, 8, 10]
print(f"evens: {evens}")       # [2, 4]
print(f"total: {total}")       # 15

# ---- Dicts (= objects) ----
agent = {
    "name": "Lunar",
    "model": "qwen2.5:7b",
    "tools": ["memory_search", "bash"],
}

# Access (like obj.key or obj["key"])
print(agent["name"])         # Lunar
print(agent.get("missing", "default"))  # default (no KeyError!)

# Loop over dict
for key, value in agent.items():
    print(f"  {key}: {value}")

# ---- Error handling ----
try:
    result = 10 / 0
except ZeroDivisionError as e:
    print(f"Error: {e}")
finally:
    print("Always runs (like finally in JS)")

# ---- Classes ----
class Tool:
    def __init__(self, name: str, description: str):
        self.name = name             # this.name = name
        self.description = description

    def to_dict(self) -> dict:
        return {"name": self.name, "description": self.description}

    def __repr__(self) -> str:      # like toString()
        return f"Tool({self.name})"

bash_tool = Tool("bash", "Run shell commands")
print(bash_tool)           # Tool(bash)
print(bash_tool.to_dict()) # {'name': 'bash', 'description': 'Run shell commands'}
```

Run it:
```bash
python basics.py
```

### Step 3: Async Python (15 minutes)

Create `services/eval/async_demo.py`:

```python
import asyncio
import time

# Python async is very similar to Node.js!
# But you need asyncio.run() as the entry point

async def fetch_data(source: str, delay: float) -> dict:
    """Simulates an async API call."""
    print(f"  Fetching {source}...")
    await asyncio.sleep(delay)  # = await new Promise(r => setTimeout(r, delay))
    return {"source": source, "data": f"Result from {source}"}

async def main():
    start = time.time()

    # Sequential (one after another)
    r1 = await fetch_data("memory", 0.5)
    r2 = await fetch_data("search", 0.3)
    print(f"Sequential: {time.time() - start:.2f}s")  # ~0.8s

    # Parallel (like Promise.all)
    start = time.time()
    r1, r2 = await asyncio.gather(
        fetch_data("memory", 0.5),
        fetch_data("search", 0.3),
    )
    print(f"Parallel: {time.time() - start:.2f}s")  # ~0.5s

    print(f"Results: {r1}, {r2}")

# Entry point (like calling main() in Node.js)
asyncio.run(main())
```

```
Node.js equivalent:
  async function main() { ... }
  main()                          ← Node runs async automatically

Python equivalent:
  async def main(): ...
  asyncio.run(main())             ← Must explicitly start event loop
```

---

## ✅ CHECKLIST

- [ ] Python 3.12+ installed
- [ ] Virtual environment created and activated
- [ ] Can run `python basics.py` successfully
- [ ] Understand: variables, functions, lists, dicts, classes
- [ ] Understand: list comprehensions = map/filter
- [ ] Understand: `async def` + `await` + `asyncio.gather` = Promise.all
- [ ] Can translate any Python snippet to TypeScript mentally

---

## 💡 KEY TAKEAWAY

**Python is surprisingly similar to JavaScript once you know the translation table. No semicolons, no braces (whitespace matters!), `True`/`False`/`None` instead of `true`/`false`/`null`. List comprehensions replace `.map()/.filter()`. The biggest difference: virtual environments instead of node_modules.**

---

## ❓ SELF-CHECK QUESTIONS

<details>
<summary>1. What's the Python equivalent of const arr = [1,2,3].map(x => x * 2)?</summary>

`doubled = [x * 2 for x in [1, 2, 3]]` — a list comprehension.
</details>

<details>
<summary>2. Why do you need a virtual environment?</summary>

To isolate package versions per project — same reason Node.js uses node_modules per project instead of installing globally.
</details>

<details>
<summary>3. What's the Python equivalent of Promise.all()?</summary>

`await asyncio.gather(coroutine1, coroutine2, ...)` — runs multiple async functions concurrently.
</details>

---

**Next → [Day 22: FastAPI — Your First Python API](day-22.md)**
