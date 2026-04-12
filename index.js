#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";

const API_BASE = process.env.HACKATIN_API_BASE || "http://localhost:8080";

const server = new Server(
  { name: "hackatin-mcp-agents", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "download_agents",
      description:
        "Downloads all agents for a given Hackatin project and writes them as markdown files into the current project's .claude/agents directory, so Claude Code can load them as subagents.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: {
            type: "number",
            description: "Hackatin project ID whose agents should be downloaded.",
          },
          targetDir: {
            type: "string",
            description:
              "Optional absolute path of the project where agents will be written. Defaults to the MCP server's current working directory.",
          },
        },
        required: ["projectId"],
      },
    },
    {
      name: "list_agents",
      description:
        "Lists the agents available for a given Hackatin project without writing any files.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "number" },
        },
        required: ["projectId"],
      },
    },
  ],
}));

function buildFrontmatter(agent) {
  const description = (agent.description || agent.role || "")
    .replace(/\r?\n/g, " ")
    .replace(/"/g, '\\"')
    .trim();
  const name = (agent.name || "agent").trim();
  return `---\nname: ${name}\ndescription: "${description}"\n---\n\n`;
}

async function fetchProjectAgents(projectId) {
  const url = `${API_BASE}/api/agents/project/${projectId}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;

  if (name === "list_agents") {
    const data = await fetchProjectAgents(args.projectId);
    const summary = (data.agents || []).map((a) => ({
      filename: a.filename,
      name: a.name,
      role: a.role,
      stack: a.stack,
    }));
    return {
      content: [
        {
          type: "text",
          text: `Project ${data.projectName} (id=${data.projectId}) has ${data.count} agents:\n${JSON.stringify(summary, null, 2)}`,
        },
      ],
    };
  }

  if (name === "download_agents") {
    const data = await fetchProjectAgents(args.projectId);
    const baseDir = args.targetDir ? resolve(args.targetDir) : process.cwd();
    const agentsDir = join(baseDir, ".claude", "agents");
    await mkdir(agentsDir, { recursive: true });

    const written = [];
    for (const agent of data.agents || []) {
      const filePath = join(agentsDir, agent.filename);
      const body = agent.content || "";
      const alreadyHasFrontmatter = body.startsWith("---");
      const fileContent = alreadyHasFrontmatter ? body : buildFrontmatter(agent) + body;
      await writeFile(filePath, fileContent, "utf8");
      written.push(filePath);
    }

    return {
      content: [
        {
          type: "text",
          text: `Downloaded ${written.length} agents from project "${data.projectName}" into ${agentsDir}:\n${written.map((p) => `- ${p}`).join("\n")}`,
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
