# Supabase MCP (this repo)

Project: `brmhzbjhpfqmmhatffmi`

## Why HTTP mode fails in Cursor

Cursor’s **Streamable HTTP** transport often fails with:

```
net::ERR_FAILED
auth=unknown
```

before OAuth even starts. This is a **Cursor client issue**, not because you authenticated another Supabase project elsewhere.

Repo-level MCP (`/.cursor/mcp.json`) is still correct — it only applies to this workspace.

## Fix A — `mcp-remote` (try this first)

Current `.cursor/mcp.json` uses **stdio via `mcp-remote`**, which proxies to Supabase and avoids the broken HTTP handshake.

1. **Quit Cursor completely** (Cmd+Q), reopen this project
2. **Settings → Tools & MCP** → find **supabase**
3. Click **Connect** / **Needs login** when it appears
4. Complete browser OAuth for the org that owns this project

## Fix B — Personal Access Token (if Fix A still fails)

1. Create a token: [Supabase Account → Access Tokens](https://supabase.com/dashboard/account/tokens)  
   Name it e.g. `cursor-costingapp-mcp`. Scopes: database access for your org.

2. Copy `.cursor/mcp.pat.example.json` → replace `.cursor/mcp.json` contents with it (paste your PAT into `SUPABASE_ACCESS_TOKEN`).

3. **Do not commit the PAT.** If you use this method, keep tokens only in your local `.cursor/mcp.json`.

4. Restart Cursor.

## Verify

Ask the agent: *“List tables using supabase MCP.”*

Expected tables: `expenses`, `recurring`, `settings`, `categories`, `currency_settings`, `projects`.

## Clear stuck OAuth (optional)

Cmd+Shift+P → **Clear All MCP Tokens** → restart Cursor → connect again.

## Other Supabase MCPs

You may still have older workspace MCPs (`user-supabase-*`). They are independent. This repo uses only `.cursor/mcp.json`.
