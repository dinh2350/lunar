# Day 39 — Popular MCP Servers + Ecosystem

> 🎯 **DAY GOAL:** Explore the MCP ecosystem — connect Lunar to GitHub, web browsing, databases, and more

---

## 📚 CONCEPT 1: The MCP Server Ecosystem

### WHAT — Available MCP Servers

```
OFFICIAL (by Anthropic/community):
  ┌────────────────────┬──────────────────────────────────┐
  │ Server             │ What it does                     │
  ├────────────────────┼──────────────────────────────────┤
  │ filesystem         │ Read/write local files           │
  │ github             │ Issues, PRs, repos, code search  │
  │ gitlab             │ Same for GitLab                  │
  │ slack              │ Send/read messages, channels     │
  │ google-drive       │ Read/search Google Docs          │
  │ postgres           │ Query PostgreSQL databases       │
  │ sqlite             │ Query SQLite databases           │
  │ brave-search       │ Web search via Brave API         │
  │ puppeteer          │ Browse web pages, take snapshots │
  │ memory             │ Key-value memory storage         │
  │ fetch              │ HTTP requests (GET, POST, etc.)  │
  │ time               │ Current time, timezone info      │
  │ everart            │ Generate images                  │
  │ sequential-thinking│ Step-by-step reasoning           │
  └────────────────────┴──────────────────────────────────┘
```

### WHY — Why Not Build Everything Custom?

```
Custom tools (what you did in Days 6-9):
  ✅ Full control
  ✅ Optimized for your use case
  ❌ You maintain everything
  ❌ Only works in Lunar

MCP servers (ecosystem):
  ✅ Pre-built, tested, maintained by community
  ✅ Works in Lunar, Claude, Copilot, Cursor
  ✅ Standard protocol = easy to swap
  ❌ Less control over implementation
  ❌ May not fit your exact needs

STRATEGY: Build custom for core features, use MCP for integrations
```

---

## 🔨 HANDS-ON: Connect 3 Popular MCP Servers

### Server 1: GitHub MCP (20 minutes)

```bash
# Create GitHub Personal Access Token:
# https://github.com/settings/tokens → Generate new token (classic)
# Scopes: repo, read:user

# Update mcp-config.json:
```

```json
{
  "servers": [
    {
      "name": "github",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_TOKEN": "ghp_your_token_here" },
      "enabled": true
    }
  ]
}
```

Test:
```
You: What are the open issues on my lunar repo?
🔧 mcp_github_search_issues({"query": "repo:youruser/lunar is:open"})
📎 Found 3 open issues:
  #12: Add Discord support
  #8: Memory search is slow
  #5: Add TypeScript strict mode

You: Create an issue for adding WebSocket reconnection
🔧 mcp_github_create_issue({
  "repo": "youruser/lunar",
  "title": "Add WebSocket reconnection logic",
  "body": "The WebChat connector should reconnect automatically..."
})
✅ Created issue #13
```

### Server 2: Web Fetch MCP (15 minutes)

```json
{
  "name": "fetch",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-fetch"],
  "enabled": true
}
```

Test:
```
You: What's on the Hacker News front page?
🔧 mcp_fetch_fetch({"url": "https://news.ycombinator.com", "maxLength": 5000})
📎 [Fetched content...]
Lunar: Here are the top stories on Hacker News:
  1. "New LLM benchmark shows..." (342 points)
  2. "Docker alternative written in Rust" (256 points)
  ...
```

### Server 3: SQLite MCP (15 minutes)

```json
{
  "name": "sqlite",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-sqlite", "--db-path", "/path/to/vectors.db"],
  "enabled": true
}
```

Test:
```
You: How many chunks are in the vector database?
🔧 mcp_sqlite_query({"sql": "SELECT COUNT(*) as count FROM chunks"})
📎 [{"count": 247}]
Lunar: There are 247 chunks in the vector database.

You: Show me the most recent 5 chunks
🔧 mcp_sqlite_query({"sql": "SELECT file_path, substr(content, 1, 100) FROM chunks ORDER BY rowid DESC LIMIT 5"})
📎 [results...]
```

### Full MCP Config (10 minutes)

Create complete `mcp-config.json`:

```json
{
  "servers": [
    {
      "name": "filesystem",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "${LUNAR_WORKSPACE}"],
      "enabled": true
    },
    {
      "name": "github",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_TOKEN": "${GITHUB_TOKEN}" },
      "enabled": false,
      "comment": "Set GITHUB_TOKEN in .env to enable"
    },
    {
      "name": "fetch",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-fetch"],
      "enabled": true
    },
    {
      "name": "sqlite",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sqlite", "--db-path", "${LUNAR_DATA}/vectors.db"],
      "enabled": false,
      "comment": "Enable for direct DB inspection"
    }
  ]
}
```

---

## 📚 CONCEPT 2: MCP Security Considerations

### Tool Approval for MCP

```
MCP tools have the same risk as custom tools!

HIGH RISK (need approval):
  → mcp_github_create_issue    — writes to GitHub
  → mcp_filesystem_write_file  — writes to disk
  → mcp_sqlite_query           — could DROP TABLE!
  → mcp_slack_send_message     — sends on your behalf

LOW RISK (auto-approve):
  → mcp_github_search_issues   — read-only
  → mcp_fetch_fetch            — read-only
  → mcp_filesystem_read_file   — read-only

APPLY SAME APPROVAL TIERS (Day 9):
  auto:  read-only MCP tools
  ask:   write MCP tools
  deny:  destructive MCP tools (DROP, DELETE)
```

---

## ✅ CHECKLIST

- [ ] GitHub MCP server connected (if token available)
- [ ] Web fetch MCP server working
- [ ] Understand MCP security considerations
- [ ] mcp-config.json has servers with enable/disable flags
- [ ] Tool approval tiers apply to MCP tools too
- [ ] Can add/remove MCP servers without code changes

---

## 💡 KEY TAKEAWAY

**The MCP ecosystem gives you instant integrations: GitHub for code, fetch for web, SQLite for databases. Enable what you need via config. Apply the same security tiers (auto/ask/deny) to MCP tools as built-in tools. Your agent goes from isolated to connected in minutes.**

---

**Next → [Day 40: MCP Advanced — HTTP Transport + Multi-Agent](day-40.md)**
