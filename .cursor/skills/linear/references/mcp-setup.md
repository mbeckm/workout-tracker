# Linear MCP setup for ScratchWorkout

## Cursor configuration

Add Linear MCP in Cursor Settings or via `.cursor/mcp.json` at the project root:

```json
{
  "mcpServers": {
    "linear": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://mcp.linear.app/mcp"]
    }
  }
}
```

## Setup steps

1. Add the config above to `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global)
2. Open Cursor Settings → **MCP**
3. Enable the Linear server
4. Authenticate when prompted with your Linear account
5. Verify tools appear in Agent chat via `@` → Tools

Official docs: https://linear.app/integrations/cursor-mcp

## Verify connection

In Agent chat, ask the agent to list Linear MCP tools using `mcp_get_tools` with server `"Linear"`.

Expected capabilities include issue CRUD, search, comments, teams, and projects — exact tool names depend on the MCP version.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `needsAuth` status | Authenticate in MCP settings |
| `Not connected` / SSE error | Toggle Linear MCP off and on; restart Cursor if needed |
| Tools missing after idle | Re-enable server — known OAuth/SSE refresh issue |
| Wrong team/project | Run team/project list tools first to confirm IDs |

## Usage tips

- Search before creating to avoid duplicate issues
- Include Figma links in issue descriptions for UI tasks
- Reference `PRODUCT.md` and `DESIGN.md` in technical notes
- Link PRs via comments rather than relying on auto branch integration
