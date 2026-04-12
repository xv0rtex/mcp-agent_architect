# hackatin-mcp-agents

MCP server that downloads Hackatin project agents into the current project's `.claude/agents/` directory so Claude Code can load them as subagents.

## Install

```bash
cd mcp-agents
npm install
chmod +x index.js
```

## Register with Claude Code

```bash
claude mcp add hackatin-agents -- node /absolute/path/to/mcp-agents/index.js
```

Optionally set the backend URL (defaults to `http://localhost:8080`):

```bash
claude mcp add hackatin-agents \
  --env HACKATIN_API_BASE=http://localhost:8080 \
  -- node /absolute/path/to/mcp-agents/index.js
```

## Tools

- `list_agents({ projectId })` — lists agents for a project without writing files.
- `download_agents({ projectId, targetDir? })` — writes each agent as `.claude/agents/<slug>.md` in `targetDir` (or the current working directory). Adds YAML frontmatter (`name`, `description`) if missing so Claude Code can register them as subagents.

## Backend endpoint consumed

`GET {HACKATIN_API_BASE}/api/agents/project/{projectId}`
