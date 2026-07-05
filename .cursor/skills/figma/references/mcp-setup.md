# Figma MCP setup for ScratchWorkout

## Cursor IDE (local) — supported

Figma MCP works in the **Cursor desktop app** and **CLI**. OAuth authentication happens in the browser when you first connect.

1. Open Cursor Settings (`Ctrl/Cmd + Shift + J`)
2. Go to **MCP**
3. Enable the **Figma** server (install the Figma plugin from the marketplace if needed)
4. Authenticate when prompted with your Figma account

HTTP endpoint: `https://mcp.figma.com/mcp`

## Cloud Agents — not supported yet

Figma MCP is **not available in Cloud Agents** today. Adding Figma in the Automations / Cloud Agent MCP tools tab shows a "Forbidden" badge because Figma only allows approved MCP clients, and the Cloud Agent client is not yet on their allowlist.

**Workaround:** Use Figma MCP from the Cursor IDE / local Cursor app for design-to-code work. Cloud Agents can still implement UI using `DESIGN.md`, `Theme.swift`, and `Components.swift` without live Figma access.

## Verify connection (IDE only)

In Agent chat, ask the agent to list Figma MCP tools. You should see tools such as:

- `get_design_context`
- `get_screenshot`
- `get_metadata`
- `use_figma` (for canvas writes)

If the server shows an error status, toggle it off and on in MCP settings, then retry.

## Link-based usage

The MCP server does not browse Figma URLs. It extracts the node ID from a link you provide.

1. In Figma, select the frame or layer
2. Right-click → **Copy link to selection**
3. Paste the URL in your agent prompt

Example Scratch link:

```
https://www.figma.com/design/NRr5uUZX4oAK3enRLXZi7j/Scratch?node-id=123-456
```

Convert `node-id=123-456` to `nodeId: "123:456"` for MCP tool calls.

## Troubleshooting

| Symptom | Environment | Fix |
|---------|-------------|-----|
| "Forbidden" badge | Cloud Agent | Not supported — use local IDE instead |
| Server status "error" | IDE | Toggle Figma MCP off/on; restart Cursor |
| Empty or truncated design context | IDE | Use `get_metadata`, then fetch child nodes individually |
| Auth failure | IDE | Re-authenticate in MCP settings |
| Wrong frame returned | Any | Ensure the copied link points to the exact node, not the file root |

## Related docs

- Scratch design spec: `DESIGN.md`
- Figma file: https://www.figma.com/design/NRr5uUZX4oAK3enRLXZi7j/Scratch
