# Linear MCP setup for ScratchWorkout

## Cursor IDE (local) — OAuth

In the Cursor desktop app, OAuth works normally:

1. Open Cursor Settings (`Ctrl/Cmd + Shift + J`) → **MCP**
2. Enable the **Linear** server (or use `.cursor/mcp.json` below)
3. Click **Authenticate** and sign in to Linear in the browser

Project-level config (IDE / stdio clients):

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

Official docs: https://linear.app/integrations/cursor-mcp

## Cloud Agents — API key (required)

OAuth does **not** work in Cloud Agents today. The cloud callback URL (`https://www.cursor.com/agents/mcp/oauth/callback`) is not yet registered on Linear's side, so browser auth fails with "Invalid redirect URI."

Use a Linear Personal API Key instead:

### 1. Generate an API key

1. Open Linear → **Settings** → **Account** → **Security & Access**
2. Create a new API key and copy it (starts with `lin_api_`)

### 2. Add the key as a Cloud Agent secret

1. Go to https://cursor.com/dashboard/cloud-agents
2. Open the **Secrets** tab for your team/workspace
3. Add a secret named `LINEAR_API_KEY` with your API key value

### 3. Configure Linear MCP for Cloud Agents

Cloud Agents do **not** support `mcp-remote` or SSE. Use **HTTP** transport via the MCP dropdown at https://cursor.com/agents or Dashboard → Integrations & MCP:

| Field | Value |
|-------|-------|
| Transport | HTTP |
| URL | `https://mcp.linear.app/mcp` |
| Header | `Authorization: Bearer <your LINEAR_API_KEY secret>` |

Cursor encrypts headers at rest and proxies tool calls through the backend — the agent VM never sees the raw token.

### 4. Verify

Start a Cloud Agent run and ask it to list Linear MCP tools. Status should be connected, not `needsAuth`.

## Verify connection (any environment)

In Agent chat, ask the agent to list Linear MCP tools using `mcp_get_tools` with server `"Linear"`.

Expected capabilities include issue CRUD, search, comments, teams, and projects — exact tool names depend on the MCP version.

## Troubleshooting

| Symptom | Environment | Fix |
|---------|-------------|-----|
| `needsAuth` | Cloud Agent | Use API key + HTTP header (see above), not OAuth |
| `Invalid redirect URI` | Cloud Agent / Automations | Known OAuth bug — use API key workaround |
| `needsAuth` | IDE | Authenticate in MCP settings |
| `Not connected` / SSE error | IDE | Toggle Linear MCP off and on; restart Cursor |
| Tools missing after idle | IDE | Re-enable server — known OAuth/SSE refresh issue |
| Wrong team/project | Any | Run team/project list tools first to confirm IDs |

## Usage tips

- Search before creating to avoid duplicate issues
- Include Figma links in issue descriptions for UI tasks
- Reference `PRODUCT.md` and `DESIGN.md` in technical notes
- Link PRs via comments rather than relying on auto branch integration
