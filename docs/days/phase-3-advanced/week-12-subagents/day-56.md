# Day 56 — Sub-Agent Architecture

> 🎯 **DAY GOAL:** Learn the sub-agent pattern — how one "coordinator" agent delegates tasks to specialized "worker" agents

---

## 📚 CONCEPT 1: What Are Sub-Agents?

### WHAT — Simple Definition

**Instead of one agent doing everything, you have a COORDINATOR agent that delegates to SPECIALIST agents — each expert at one thing. Like a manager who assigns work to team members.**

```
SINGLE AGENT (current Lunar):
┌──────────────────────┐
│       LUNAR           │
│  Does EVERYTHING:     │
│  - Chat               │
│  - Code review        │
│  - Research           │
│  - File management    │
│  - Memory management  │
│  Result: Jack of all  │
│  trades, master of    │
│  none                 │
└──────────────────────┘

SUB-AGENT ARCHITECTURE:
┌──────────────────────────────────────────────┐
│              COORDINATOR (Lunar)              │
│  "I'll route this to the right specialist"   │
├──────┬──────┬──────┬──────┬────────┤
│      │      │      │      │        │
│  📝  │  🔍  │  💻  │  📊  │  🧠   │
│Writer│Search│Coder │Analyst│Memory │
│Agent │Agent │Agent │Agent  │Agent  │
│      │      │      │      │        │
│Write │Find  │Write │Parse  │Search │
│docs  │info  │code  │data   │recall │
│Edit  │RAG   │Debug │Chart  │Store  │
│Summ. │Web   │Test  │Report │Forget │
└──────┴──────┴──────┴──────┴────────┘
```

### WHY — Specialization = Better Quality

```
PROBLEM WITH ONE AGENT:
  → System prompt is huge (1000+ tokens of instructions)
  → Tools are bloated (20+ tools, most unused per query)
  → Context window wasted on irrelevant capabilities
  → Hard to improve one skill without affecting others

SUB-AGENT BENEFITS:
  ✅ Each agent has focused system prompt
  ✅ Each agent has only relevant tools
  ✅ Smaller context = better performance
  ✅ Can use different models per specialist
  ✅ Can improve one agent without touching others
  ✅ Parallel execution possible
```

### 🔗 NODE.JS ANALOGY

```
// Sub-agents = microservices!

// MONOLITH (one agent):
app.get('/api/*', handleEverything);

// MICROSERVICES (sub-agents):
app.get('/api/users', userService.handle);
app.get('/api/orders', orderService.handle);
app.get('/api/payments', paymentService.handle);
// Each service: own database, own logic, own scaling

// Coordinator = API Gateway
// Sub-agents = Individual microservices
```

---

## 📚 CONCEPT 2: Orchestration Patterns

### Three Main Patterns

```
PATTERN 1: ROUTER (simplest)
─────────────────────────────
Coordinator picks ONE specialist based on the task.

  User: "Write a poem"
  Coordinator → Writer Agent → poem
  
  User: "Debug this code"
  Coordinator → Coder Agent → fix

  Good for: clear, single-task requests


PATTERN 2: PIPELINE (sequential)
─────────────────────────────────
Multiple agents work in sequence, each adding to the result.

  User: "Research and write a blog post about RAG"
  
  Step 1: Search Agent → finds information
  Step 2: Writer Agent → writes blog post using found info
  Step 3: Coder Agent → adds code examples
  
  Good for: multi-step creative tasks


PATTERN 3: PARALLEL + MERGE (advanced)
──────────────────────────────────────
Multiple agents work simultaneously, results are combined.

  User: "Give me a complete analysis of this project"
  
  ┌─ Coder Agent ──── code quality report ─┐
  ├─ Search Agent ─── related resources ───├─→ Merge → Final Report
  └─ Analyst Agent ── metrics analysis  ───┘
  
  Good for: complex tasks with independent parts
```

---

## 🔨 HANDS-ON: Build Sub-Agent System

### Step 1: Agent Interface (10 minutes)

Create `packages/agent/src/sub-agents/types.ts`:

```typescript
export interface SubAgent {
  name: string;
  description: string;
  systemPrompt: string;
  tools: string[];       // Tool names this agent can use
  model?: string;        // Optional: different model per agent
  temperature?: number;
}

export interface TaskResult {
  agentName: string;
  success: boolean;
  output: string;
  toolsUsed: string[];
  tokensUsed: number;
  durationMs: number;
  metadata?: Record<string, unknown>;
}

export interface RoutingDecision {
  pattern: 'router' | 'pipeline' | 'parallel';
  agents: string[];            // Which agents to use
  instructions: string[];      // What to tell each agent
  mergeStrategy?: 'concatenate' | 'summarize' | 'pick_best';
}
```

### Step 2: Define Specialist Agents (15 minutes)

Create `packages/agent/src/sub-agents/specialists.ts`:

```typescript
import type { SubAgent } from './types.js';

export const SPECIALISTS: SubAgent[] = [
  {
    name: 'writer',
    description: 'Expert at writing, editing, and summarizing text',
    systemPrompt: `You are a writing specialist. Your strengths:
- Clear, concise writing
- Adapting tone for different audiences
- Summarizing long content
- Editing and improving text
- Documentation and blog posts

Rules:
- Focus ONLY on writing tasks
- If asked about code, say "Let me pass this to the coding specialist"
- Always structure your output clearly with headings`,
    tools: ['memory_search', 'read_file', 'write_file'],
    temperature: 0.7,
  },
  {
    name: 'coder',
    description: 'Expert at writing, debugging, and reviewing code',
    systemPrompt: `You are a coding specialist for TypeScript/Node.js. Your strengths:
- Writing clean, typed TypeScript code
- Debugging errors
- Code review and refactoring
- Explaining code concepts
- Writing tests

Rules:
- Focus ONLY on code-related tasks
- Always provide typed TypeScript code
- Include error handling
- Explain your code briefly`,
    tools: ['read_file', 'write_file', 'bash_exec', 'memory_search'],
    model: 'qwen2.5-coder:3b',  // Use code-specialized model
    temperature: 0.3,
  },
  {
    name: 'researcher',
    description: 'Expert at finding information from memory and documents',
    systemPrompt: `You are a research specialist. Your strengths:
- Searching through memory and documents
- Finding relevant information
- Cross-referencing sources
- Providing accurate, sourced answers

Rules:
- ALWAYS search memory before answering factual questions
- Cite your sources (which file, which memory)
- Say "I couldn't find information about that" instead of guessing
- Never fabricate information`,
    tools: ['memory_search', 'read_file', 'list_directory'],
    temperature: 0.2,  // Low temperature for accuracy
  },
  {
    name: 'analyst',
    description: 'Expert at data analysis, patterns, and reporting',
    systemPrompt: `You are a data analysis specialist. Your strengths:
- Parsing and analyzing data
- Finding patterns and trends
- Creating structured reports
- Statistical summaries
- Comparing options

Rules:
- Use numbers and data to support analysis
- Present findings in clear tables/lists
- Highlight key insights
- Be objective and precise`,
    tools: ['memory_search', 'read_file', 'bash_exec'],
    temperature: 0.3,
  },
  {
    name: 'memory_manager',
    description: 'Expert at managing long-term memory and context',
    systemPrompt: `You are a memory management specialist. Your strengths:
- Searching and organizing memories
- Writing important information to long-term memory
- Updating outdated information
- Removing irrelevant memories
- Summarizing conversation history

Rules:
- Be precise about what you store (key facts only)
- Categorize memories properly
- Don't store sensitive/PII information
- Confirm what you stored/updated`,
    tools: ['memory_search', 'memory_write', 'memory_delete'],
    temperature: 0.2,
  },
];

export function getSpecialist(name: string): SubAgent | undefined {
  return SPECIALISTS.find(s => s.name === name);
}
```

### Step 3: Coordinator Agent (25 minutes)

Create `packages/agent/src/sub-agents/coordinator.ts`:

```typescript
import type { SubAgent, TaskResult, RoutingDecision } from './types.js';
import { SPECIALISTS, getSpecialist } from './specialists.js';
import { LLMClient } from '../llm-client.js';

export class CoordinatorAgent {
  private llm: LLMClient;

  constructor(llm: LLMClient) {
    this.llm = llm;
  }

  /**
   * Route a user message to the appropriate specialist(s)
   */
  async route(userMessage: string, conversationHistory: any[]): Promise<RoutingDecision> {
    const agentList = SPECIALISTS.map(s => 
      `- ${s.name}: ${s.description}`
    ).join('\n');

    const response = await this.llm.chat({
      model: 'qwen2.5:3b',
      messages: [
        {
          role: 'system',
          content: `You are a task coordinator. Given a user's message, decide which specialist agent(s) should handle it.

Available specialists:
${agentList}

Respond in JSON format:
{
  "pattern": "router" | "pipeline" | "parallel",
  "agents": ["agent_name"],
  "instructions": ["specific instruction for each agent"],
  "mergeStrategy": "concatenate" | "summarize" | "pick_best"
}

Rules:
- Use "router" for simple, single-domain tasks
- Use "pipeline" for multi-step tasks where order matters
- Use "parallel" for tasks with independent parts
- Most requests need just ONE agent (router pattern)
- Only use multiple agents when genuinely needed`,
        },
        ...conversationHistory.slice(-4),
        { role: 'user', content: userMessage },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });

    try {
      const decision = JSON.parse(response.content);
      return {
        pattern: decision.pattern || 'router',
        agents: decision.agents || ['writer'],
        instructions: decision.instructions || [userMessage],
        mergeStrategy: decision.mergeStrategy || 'concatenate',
      };
    } catch {
      // Fallback: route to writer
      return {
        pattern: 'router',
        agents: ['writer'],
        instructions: [userMessage],
      };
    }
  }

  /**
   * Execute the routing decision
   */
  async execute(
    decision: RoutingDecision,
    userMessage: string,
  ): Promise<string> {
    switch (decision.pattern) {
      case 'router':
        return this.executeRouter(decision);
      case 'pipeline':
        return this.executePipeline(decision);
      case 'parallel':
        return this.executeParallel(decision);
    }
  }

  private async executeRouter(decision: RoutingDecision): Promise<string> {
    const agent = getSpecialist(decision.agents[0]);
    if (!agent) return 'No suitable specialist found.';

    const result = await this.runAgent(agent, decision.instructions[0]);
    return result.output;
  }

  private async executePipeline(decision: RoutingDecision): Promise<string> {
    let previousOutput = '';

    for (let i = 0; i < decision.agents.length; i++) {
      const agent = getSpecialist(decision.agents[i]);
      if (!agent) continue;

      const instruction = previousOutput
        ? `${decision.instructions[i]}\n\nPrevious step output:\n${previousOutput}`
        : decision.instructions[i];

      const result = await this.runAgent(agent, instruction);
      previousOutput = result.output;
    }

    return previousOutput;
  }

  private async executeParallel(decision: RoutingDecision): Promise<string> {
    const tasks = decision.agents.map((name, i) => {
      const agent = getSpecialist(name);
      if (!agent) return Promise.resolve({ agentName: name, success: false, output: '' } as TaskResult);
      return this.runAgent(agent, decision.instructions[i]);
    });

    const results = await Promise.all(tasks);

    // Merge results
    switch (decision.mergeStrategy) {
      case 'summarize':
        return this.summarizeResults(results);
      case 'pick_best':
        return results.sort((a, b) => b.output.length - a.output.length)[0]?.output || '';
      default: // concatenate
        return results
          .filter(r => r.success)
          .map(r => `## ${r.agentName}\n${r.output}`)
          .join('\n\n');
    }
  }

  private async runAgent(agent: SubAgent, instruction: string): Promise<TaskResult> {
    const start = Date.now();

    // Run with the agent's specific configuration
    const response = await this.llm.chat({
      model: agent.model || 'qwen2.5:3b',
      messages: [
        { role: 'system', content: agent.systemPrompt },
        { role: 'user', content: instruction },
      ],
      temperature: agent.temperature || 0.7,
      tools: agent.tools,
    });

    return {
      agentName: agent.name,
      success: true,
      output: response.content,
      toolsUsed: response.toolCalls?.map((tc: any) => tc.name) || [],
      tokensUsed: response.usage?.total_tokens || 0,
      durationMs: Date.now() - start,
    };
  }

  private async summarizeResults(results: TaskResult[]): Promise<string> {
    const combined = results
      .filter(r => r.success)
      .map(r => `[${r.agentName}]: ${r.output}`)
      .join('\n\n');

    const summary = await this.llm.chat({
      model: 'qwen2.5:3b',
      messages: [{
        role: 'system',
        content: 'Combine the following specialist reports into a coherent summary.',
      }, {
        role: 'user',
        content: combined,
      }],
      temperature: 0.5,
    });

    return summary.content;
  }
}
```

---

## ✅ CHECKLIST

- [ ] Sub-agent types defined (SubAgent, TaskResult, RoutingDecision)
- [ ] 5 specialist agents configured (writer, coder, researcher, analyst, memory)
- [ ] Coordinator routes to correct specialist
- [ ] Router pattern: single agent delegation
- [ ] Pipeline pattern: sequential multi-agent
- [ ] Parallel pattern: concurrent execution
- [ ] Each agent has focused prompt and tools
- [ ] Merge strategies for combining results

---

## 💡 KEY TAKEAWAY

**Sub-agents are the "microservices of AI" — instead of one monolith agent, specialized agents handle specific tasks. The coordinator decides WHO handles WHAT, using three patterns: Router (pick one), Pipeline (chain many), Parallel (run simultaneously). Each specialist gets a focused prompt, fewer tools, and can even use a different model. This is how production multi-agent systems work at scale.**

---

**Next → [Day 57: Agent Communication Protocol](day-57.md)**
