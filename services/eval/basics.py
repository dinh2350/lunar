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
    "model": "qwen2.5:3b",
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
