# Lunar API Reference

## Base URL
`http://localhost:3000/api`

## Endpoints

### Chat
**POST** `/api/chat`

Send a message to Lunar.

**Request:**
```json
{
  "message": "Hello!",
  "sessionId": "optional-session-id",
  "images": ["base64-or-url"],
  "audio": "base64-audio"
}
```

**Response:**
```json
{
  "response": "Hi! I'm Lunar...",
  "sessionId": "abc123",
  "toolsUsed": ["search_memory"],
  "tokensUsed": 247
}
```

### Stream Chat
**POST** `/api/chat/stream`

Same as `/chat` but returns Server-Sent Events.

### Memory
- **GET** `/api/memory/search?q=query&limit=10` — Search memories
- **POST** `/api/memory` — Save a memory
- **GET** `/api/memory/:id` — Get specific memory

### Sessions
- **GET** `/api/sessions` — List sessions
- **GET** `/api/sessions/:id` — Get session details

### Metrics
- **GET** `/api/metrics` — All metrics (counters, histograms, gauges)
- **GET** `/api/metrics/health` — Health check

### Eval
- **GET** `/api/eval` — List eval runs
- **GET** `/api/eval/:runId` — Get specific eval run results

### Settings
- **GET** `/api/settings` — Get current settings
- **POST** `/api/settings` — Update settings

### Models
- **GET** `/api/models` — List available LLM models
