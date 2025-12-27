# n8n Unified MCP Server

**Completely Independent** Model Context Protocol (MCP) server for n8n workflow management:
- 540 nodes with **full documentation** extracted from local n8n installation
- Automatic version-matched database building
- Complete n8n workflow management via API
- Works with GitHub Copilot, Claude, Cursor

## 🚀 Quick Setup

### 1. Install Dependencies

```bash
cd mcp-server
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:
```bash
N8N_API_URL=https://your-n8n-instance.com/api/v1
N8N_BASE_URL=https://your-n8n-instance.com
N8N_API_KEY=your_api_key_here

# IMPORTANT: Set your n8n version for accurate node information
N8N_VERSION=n8n@2.0.3  # Match your n8n instance version
```

### 3. Build Node Database

```bash
npm run rebuild-db
```

This will:
- Extract 540 nodes from your local n8n installation
- Generate documentation from node descriptions and codex data
- Store everything in `data/nodes.db`
- Match your specified N8N_VERSION
- Takes ~30-60 seconds

**Rebuilding for Different Versions:**
```bash
# For a specific version
N8N_VERSION=n8n@2.0.3 npm run rebuild-db

# Or update .env and run
npm run rebuild-db
```

### 4. Build the Server

```bash
npm run build
```

### 5. Test Locally

```bash
npm start
```

### 6. Configure for VS Code

Add to your `.vscode/settings.json`:

```json
{
  "mcp.servers": {
    "n8n-unified": {
      "command": "node",
      "args": ["${workspaceFolder}/mcp-server/dist/index.js"],
      "env": {
        "N8N_API_URL": "https://your-instance.com/api/v1",
        "N8N_API_KEY": "your-key",
        "MCP_MODE": "stdio",
        "LOG_LEVEL": "error"
      }
    }
  }
}
```

## 📚 Available Tools

### Node Documentation (540 nodes with full docs)
- `search_n8n_nodes` - **Lightweight search** (excludes docs/schemas to save tokens)
- `get_node_info` - **Full node details** with documentation, parameters, operations
- `list_node_categories` - All categories
- `get_nodes_by_category` - Nodes by category
- `get_ai_nodes` - AI-capable nodes
- `fetch_node_catalog_from_github` - **Version-specific GitHub fetch** - verify nodes for ANY n8n version
- `get_database_version` - Check which n8n version your database is built for
- `get_n8n_instance_info` - Get your running n8n instance information

### Workflow Management (Your n8n instance)
- `list_workflows` - All workflows
- `get_workflow` / `get_workflow_by_name` - Retrieve workflows
- `create_workflow` - Deploy new workflows
- `update_workflow` - Modify existing workflows
- `delete_workflow` - Remove workflows
- `toggle_workflow` - Activate/deactivate
- `execute_workflow` - Manual execution
- `get_executions` / `get_execution_details` - Execution history

## 🎯 How It Works

```
┌─────────────────────────────────────────────────┐
│  AI Assistant (Copilot/Claude/Cursor)          │
└────────────────┬────────────────────────────────┘
                 │ MCP Protocol
┌────────────────▼────────────────────────────────┐
│  n8n Unified MCP Server                         │
│                                                  │
│  ┌──────────────┐      ┌──────────────┐        │
│  │ Node Service │      │Workflow Svc  │        │
│  │  (SQLite)    │      │  (n8n API)   │        │
│  └──────┬───────┘      └──────┬───────┘        │
└─────────┼──────────────────────┼────────────────┘
          │                      │
┌─────────▼──────────┐  ┌───────▼─────────────┐
│ n8n-MCP Database   │  │ Your n8n Instance   │
│ 802 nodes          │  │ Workflows & Data    │
│ (from source code) │  │ (via API)           │
└────────────────────┘  └─────────────────────┘
```

## 🤖 Example Conversations

**With GitHub Copilot in VS Code:**

```
You: "Search for database nodes in n8n"
Copilot: *Uses search_n8n_nodes("database")*
→ Shows Postgres, MySQL, MongoDB, etc.

You: "Create a workflow that queries Postgres and sends results to Slack"
Copilot: *Uses get_node_info for both nodes*
         *Uses create_workflow with correct parameters*
→ Workflow created and deployed!

You: "List my active workflows"
Copilot: *Uses list_workflows*
→ Shows all your workflows with status
```

## 🔧 Enhanced Shell Script

We've also created `n8n-helper-enhanced.sh` that uses the n8n-MCP database directly:

```bash
# Now uses n8n-MCP's superior node catalog
./n8n-helper-enhanced.sh nodes        # Shows all 802 nodes
./n8n-helper-enhanced.sh search slack # Search n8n-MCP database
./n8n-helper-enhanced.sh stats        # Show statistics

# Original workflow management still works
./n8n-helper-enhanced.sh list         # List workflows
./n8n-helper-enhanced.sh execute abc123
```

## 📊 Why This Approach is Better

| Feature | Old Method | New Unified Method |
|---------|-----------|-------------------|
| Node Count | ~50 from workflows | **802 from source** |
| Node Details | Limited from API | **Full schemas** |
| Documentation | None | **Complete docs** |
| AI Integration | Manual commands | **Automatic tools** |
| Workflow Mgmt | ✅ Shell only | **✅ Shell + AI** |
| Up-to-date | Manual refresh | **Auto from git** |

## ⚠️ Version Management - IMPORTANT!

The node database may contain information for a different n8n version than you're running. This can cause issues when creating workflows with nodes that don't exist or have different versions in your instance.

### Check Version Compatibility

```bash
# 1. Check what version your database is for
Use MCP tool: get_database_version

# 2. Check your n8n instance version
Use MCP tool: get_n8n_instance_info

# 3. Fetch nodes for YOUR specific n8n version
Use MCP tool: fetch_node_catalog_from_github
  with version: "n8n@2.0.3" (replace with your version)
```

### Example Version Mismatch

```
Database: n8n 2.2.0 (545 nodes-base, langchain support)
Your Instance: n8n 2.0.3 (488 nodes-base, NO langchain)

Problem: AI Agent v3.1 doesn't exist in 2.0.3!
Solution: Fetch catalog for n8n@2.0.3 to see available nodes
```

### Available in Different Versions

- **n8n 2.0.3**: 488 nodes, NO @n8n/n8n-nodes-langchain package
- **n8n 2.2.0**: 545 nodes, langchain package with AI Agent v3.1

**Always verify node availability for YOUR version before creating workflows!**

## 🛠️ Development

```bash
# Development with auto-reload
npm run dev

# Build for production
npm run build

# Test the MCP server
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | npm start
```

## 📝 Notes

- The MCP server runs in stdio mode for AI assistants
- All logging goes to stderr to avoid interfering with MCP protocol
- Node database is read-only (safe to use concurrently)
- Workflow API requires valid n8n instance and API key

## 🤝 Contributing

This combines the best of both worlds:
- n8n-MCP's comprehensive node extraction
- Your practical workflow management

Both can evolve independently while working together seamlessly!
