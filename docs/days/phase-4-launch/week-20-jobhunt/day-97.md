# Day 97 — AI Engineer Interview Prep

> 🎯 **DAY GOAL:** Prepare for the most common AI Engineer interview questions — system design, LLM knowledge, and coding

---

## 🔨 HANDS-ON

### 1. Common AI Engineer Interview Questions

#### Conceptual Questions

```
Q: What is RAG and when would you use it?
A: RAG = Retrieval-Augmented Generation. You retrieve relevant 
   documents from a knowledge base and inject them into the LLM 
   prompt as context. Use it when:
   - LLM needs access to private/recent data
   - You want to reduce hallucinations
   - Domain knowledge exceeds training data
   
   You built this in Lunar: SQLite + FTS5 + sqlite-vec → hybrid 
   search → inject top-k results into system prompt.

Q: How do you evaluate LLM outputs?
A: Multiple approaches:
   - Automated: LLM-as-judge, regex matching, similarity scores
   - Human: A/B testing, thumbs up/down, Likert scale
   - Metrics: Accuracy, relevance, faithfulness, latency
   
   You built this: eval system with golden test sets, A/B testing, 
   regression detection (Days 46-50).

Q: What is fine-tuning vs prompt engineering?
A: Prompt engineering = change the input to get better output 
   (fast, cheap, flexible). Fine-tuning = change the model weights 
   to specialize behavior (slower, more expensive, permanent).
   
   Use prompt engineering first. Fine-tune only when prompting 
   hits a ceiling and you have good training data.

Q: How do AI agents work?
A: Agent = LLM + Tools + Loop. The LLM decides what to do, 
   calls tools (APIs, search, code), observes results, and 
   decides next action. The loop continues until the task 
   is complete or a limit is hit.
   
   You built this: Tool router with 12+ tools, multi-agent 
   coordinator with 5 specialists (Days 56-60).
```

#### System Design Questions

```
Q: Design a customer support chatbot for an e-commerce company.

Your answer framework:
1. Requirements — channels, volume, languages, SLA
2. Architecture — gateway, agent, tools, knowledge base
3. Knowledge Base — product DB, FAQs, order system (RAG)
4. Agent Design — routing (refund vs. info vs. escalation)
5. Safety — PII filtering, content moderation, guardrails
6. Evaluation — automated testing, human review, metrics
7. Scaling — queue, caching, fallback models
8. Monitoring — latency, error rate, satisfaction score

"This is essentially what I built with Lunar, adapted for 
 e-commerce. Let me walk you through each layer..."
```

#### Coding Questions

```typescript
// Common: Implement a simple RAG pipeline
async function ragQuery(question: string): Promise<string> {
  // 1. Embed the question
  const embedding = await embed(question);
  
  // 2. Search knowledge base
  const docs = await vectorSearch(embedding, { topK: 5 });
  
  // 3. Build prompt with context
  const context = docs.map(d => d.text).join('\n---\n');
  const prompt = `Context:\n${context}\n\nQuestion: ${question}\nAnswer:`;
  
  // 4. Generate response
  return llm.generate(prompt);
}

// Common: Implement token-aware context truncation
function truncateToTokenLimit(messages: string[], limit: number): string[] {
  let total = 0;
  const result: string[] = [];
  
  for (let i = messages.length - 1; i >= 0; i--) {
    const tokens = estimateTokens(messages[i]);
    if (total + tokens > limit) break;
    total += tokens;
    result.unshift(messages[i]);
  }
  
  return result;
}
```

### 2. Behavioral Questions (STAR Method)

```
Q: "Tell me about a challenging technical problem you solved."

Situation: Building memory for Lunar — needed to find relevant 
  past conversations from thousands of messages.
Task: Implement a search system that handles both keyword and 
  semantic queries with low latency.
Action: Combined SQLite FTS5 (BM25) with sqlite-vec (cosine 
  similarity) using Reciprocal Rank Fusion. Benchmarked 
  against standalone approaches.
Result: Hybrid search achieved 93% accuracy at <50ms latency, 
  outperforming either approach alone by 15%.
```

### 3. Questions to Ask Them

```
Good questions for AI Engineer interviews:
- "What LLM providers/models does your stack use?"
- "How do you evaluate model quality in production?"
- "What's the biggest challenge with your current AI system?"
- "How do you handle hallucinations in production?"
- "What does the AI team structure look like?"
- "What's the development cycle for new AI features?"
```

---

## ✅ CHECKLIST

- [ ] Review all conceptual Q&A above
- [ ] Practice system design (draw diagrams, explain tradeoffs)
- [ ] Code RAG pipeline from memory
- [ ] Prepare 3 STAR stories from Lunar project
- [ ] List of questions to ask interviewers
- [ ] Mock interview with a friend (30 min)

---

**Next → [Day 98: Job Search Strategy](day-98.md)**
