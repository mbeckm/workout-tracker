# Figma MCP setup for ScratchWorkout

## Cursor configuration

Figma MCP is typically enabled globally in Cursor:

1. Open Cursor Settings (`Ctrl/Cmd + Shift + J`)
2. Go to **MCP**
3. Enable the **Figma** server and authenticate when prompted

Project-level overrides can go in `.cursor/mcp.json` at the repo root if your team uses a shared config.

## Verify connection

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

| Symptom | Fix |
|---------|-----|
| Server status "error" | Toggle Figma MCP off/on; restart Cursor |
| Empty or truncated design context | Use `get_metadata`, then fetch child nodes individually |
| Auth failure | Re-authenticate in MCP settings |
| Wrong frame returned | Ensure the copied link points to the exact node, not the file root |

## Related docs

- Scratch design spec: `DESIGN.md`
- Figma file: https://www.figma.com/design/NRr5uUZX4oAK3enRLXZi7j/Scratch
