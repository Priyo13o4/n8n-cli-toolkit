# n8n Helper Toolkit

> A comprehensive bash toolkit for managing n8n workflows, discovering nodes, and exploring the complete n8n node catalog.

## ℹ️ Compatibility

**✅ Designed for Self-Hosted n8n Instances**

This toolkit is built and tested for **self-hosted n8n instances**, including:
- 🐳 Docker deployments (local or remote)
- 🔧 Self-hosted with custom domains (via Cloudflare Tunnel, nginx, etc.)
- 🏠 Local installations with API access

**❌ Not Compatible with:**
- n8n.io cloud service (different API endpoints and authentication)
- Instances without API access enabled
## 🚀 Quick Start

### 1. Setup Configuration

```bash
# Copy the example configuration
cp .env.example .env

# Edit .env with your n8n instance details
nano .env
```

Required configuration in `.env`:
```bash
# Your n8n instance URLs
N8N_API_URL=https://your-n8n-instance.com/api/v1
N8N_BASE_URL=https://your-n8n-instance.com

# API Key (get from n8n Settings > API)
N8N_API_KEY=your_api_key_here

# Session Cookie (optional - for complete node catalog access)
N8N_SESSION_COOKIE="n8n-auth=eyJhbGc..."
```

### 2. Get Your API Key

1. Open your n8n instance
2. Go to **Settings** → **API**
3. Create a new API key
4. Copy it to `N8N_API_KEY` in `.env`

### 3. Get Session Cookie (Optional - for Complete Catalog)

**Why needed?** The n8n Public API doesn't expose all available nodes. To access the complete catalog of 800+ nodes, you need session authentication.

**How to get it:**

1. **Login to n8n** in your browser
2. **Open Developer Tools** (F12 or Right-click → Inspect)
3. **Go to Application tab** (Chrome) or **Storage tab** (Firefox)
4. **Click Cookies** → Select your n8n domain
5. **Find `n8n-auth` cookie** → Copy the entire value
6. **Add to `.env`:**
   ```bash
   N8N_SESSION_COOKIE="n8n-auth=<paste-entire-cookie-value-here>"
   ```

**Browser-Specific Instructions:**

<details>
<summary>Chrome/Edge</summary>

```
DevTools (F12) → Application → Cookies → your-n8n-domain → n8n-auth
Right-click the value → Copy
```
</details>

<details>
<summary>Firefox</summary>

```
DevTools (F12) → Storage → Cookies → your-n8n-domain → n8n-auth
Double-click value to select → Copy
```
</details>

<details>
<summary>Safari</summary>

```
Develop → Show Web Inspector → Storage → Cookies → n8n-auth
Double-click value → Copy
```
</details>

**Security Note:** Session cookies expire (usually 7 days). When you get "Unauthorized" errors, refresh the cookie.

### 4. Run Your First Command

```bash
# Make script executable
chmod +x n8n-helper.sh

# List all your workflows
./n8n-helper.sh list

# See all available nodes (851+ if session auth configured)
./n8n-helper.sh nodes

# Search for specific nodes
./n8n-helper.sh search postgres
```

---

## 📚 Complete Command Reference

### Workflow Management

| Command | Description | Example |
|---------|-------------|---------|
| `list` | List all workflows | `./n8n-helper.sh list` |
| `get <id>` | Get workflow by ID | `./n8n-helper.sh get abc123` |
| `getname <name>` | Get workflow by name | `./n8n-helper.sh getname "My Workflow"` |
| `download <id> [file]` | Download workflow to JSON file | `./n8n-helper.sh download abc123 backup.json` |
| `toggle <id> <bool>` | Activate/deactivate workflow | `./n8n-helper.sh toggle abc123 true` |
| `update <id> <file>` | Update workflow from JSON file | `./n8n-helper.sh update abc123 updated.json` |
| `execute <id>` | Execute workflow manually | `./n8n-helper.sh execute abc123` |
| `executions [id] [n]` | List recent executions | `./n8n-helper.sh executions abc123 20` |
| `execution <exec_id>` | Get execution details | `./n8n-helper.sh execution xyz789` |

### Node Discovery & Analysis

| Command | Description | Example |
|---------|-------------|---------|
| `nodes` | List all node types | `./n8n-helper.sh nodes` |
| `nodeinfo <type>` | Get detailed node info | `./n8n-helper.sh nodeinfo n8n-nodes-base.postgres` |
| `search <keyword>` | Search nodes by name/category | `./n8n-helper.sh search database` |
| `categories` | List all node categories | `./n8n-helper.sh categories` |
| `export-nodes [file]` | Export workflow-based catalog | `./n8n-helper.sh export-nodes my_nodes.json` |
| `export-all-nodes [file]` | Export complete catalog (requires session) | `./n8n-helper.sh export-all-nodes complete.json` |

---

## 💡 Usage Examples

### Managing Workflows

```bash
# List all workflows
./n8n-helper.sh list

# Find a specific workflow by name
./n8n-helper.sh getname "Data Processing Pipeline"

# Download for backup
./n8n-helper.sh download abc123 backup/my-workflow.json

# Activate a workflow
./n8n-helper.sh toggle abc123 true

# Execute manually
./n8n-helper.sh execute abc123

# Check recent executions
./n8n-helper.sh executions abc123 10
```

### Discovering Nodes

```bash
# See all available nodes
./n8n-helper.sh nodes

# Find database-related nodes
./n8n-helper.sh search database

# Get detailed info about a specific node
./n8n-helper.sh nodeinfo n8n-nodes-base.httpRequest

# See all categories
./n8n-helper.sh categories

# Export complete catalog for analysis
./n8n-helper.sh export-all-nodes complete_catalog.json
```

### Analyzing Exported Catalogs

Once you export a catalog, you can analyze it with `jq`:

```bash
# Export complete catalog
./n8n-helper.sh export-all-nodes catalog.json

# See statistics
jq '.statistics' catalog.json

# Find all AI nodes
jq '.allNodes[] | select(.categories | contains(["AI"])) | .displayName' catalog.json

# Find webhook-enabled nodes
jq '.allNodes[] | select(.webhooks != null) | .displayName' catalog.json

# Get top used nodes
jq '.usageStats[0:10]' catalog.json

# Find nodes in specific category
jq '.categories' catalog.json
```

---

## 🤖 Using with GitHub Copilot

This toolkit is designed to work seamlessly with GitHub Copilot in VS Code!

### Basic Usage

1. **Ask Copilot about n8n**
   ```
   @workspace What n8n nodes are available for database operations?
   ```

2. **Generate workflows**
   ```
   @workspace Create an n8n workflow that fetches data from PostgreSQL and sends it via webhook
   ```

3. **Analyze existing workflows**
   ```
   @workspace Show me all the node types used in the "Data Pipeline" workflow
   ```

### Advanced Copilot Integration

**Export catalog first:**
```bash
./n8n-helper.sh export-all-nodes catalog.json
```

**Then ask Copilot:**
```
@workspace Looking at catalog.json, what AI nodes are available?
@workspace Suggest n8n nodes for building a customer notification system
@workspace Which nodes support webhooks according to the catalog?
```

**Workflow development:**
```bash
# Download a workflow
./n8n-helper.sh download abc123 current-workflow.json

# Ask Copilot
@workspace Analyze current-workflow.json and suggest improvements
@workspace Add error handling to this n8n workflow
@workspace What credentials are needed for the nodes in this workflow?
```

### Tips for Better Copilot Responses

1. **Be specific:** "Show me LangChain nodes" vs "Show me AI stuff"
2. **Reference files:** "@workspace Looking at catalog.json..."
3. **Ask for comparisons:** "Compare HTTP Request node vs Webhook node"
4. **Request examples:** "Show me an example configuration for the Postgres node"

---

## 🔧 Converting to MCP Server

### What is MCP?

**MCP (Model Context Protocol)** is a protocol that allows AI assistants to access external tools and data sources. Currently, this is a **bash script** - useful but limited to command-line usage.

### Current State: Bash Script

**Pros:**
- ✅ Easy to use from terminal
- ✅ No dependencies except bash, curl, jq
- ✅ Works immediately
- ✅ Great for manual operations

**Cons:**
- ❌ Not accessible to AI assistants directly
- ❌ No structured tool definitions
- ❌ Can't be used by GitHub Copilot as tools
- ❌ Manual command execution only

### Converting to MCP Server

An **MCP server** would allow GitHub Copilot and other AI assistants to directly call these functions as tools!

**What you'd get:**
- ✅ Copilot can execute n8n operations directly
- ✅ AI can manage workflows autonomously
- ✅ Structured tool definitions with parameters
- ✅ Real-time n8n integration in chat
- ✅ Automatic workflow generation and deployment

### Architecture Comparison

**Current (Bash Script):**
```
You → Terminal → n8n-helper.sh → n8n API → n8n
```

**MCP Server:**
```
You → Copilot → MCP Server → n8n API → n8n
              ↓
         AI can execute
         tools directly
```

### Implementation Steps

#### 1. Choose Technology Stack

**Recommended: TypeScript/Node.js**
```bash
# Initialize project
npm init -y
npm install @modelcontextprotocol/sdk
npm install axios dotenv
```

#### 2. Define MCP Tools

Each bash function becomes an MCP tool:

```typescript
// Example: List workflows tool
{
  name: "list_n8n_workflows",
  description: "List all n8n workflows with status",
  inputSchema: {
    type: "object",
    properties: {}
  }
}

// Example: Search nodes tool
{
  name: "search_n8n_nodes",
  description: "Search for n8n nodes by keyword",
  inputSchema: {
    type: "object",
    properties: {
      keyword: {
        type: "string",
        description: "Search keyword (e.g., 'postgres', 'webhook')"
      }
    },
    required: ["keyword"]
  }
}
```

#### 3. Basic MCP Server Structure

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const N8N_API_URL = process.env.N8N_API_URL;
const N8N_API_KEY = process.env.N8N_API_KEY;

// Create MCP server
const server = new Server(
  {
    name: "n8n-helper-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define tools
server.setRequestHandler("tools/list", async () => {
  return {
    tools: [
      {
        name: "list_workflows",
        description: "List all n8n workflows",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "search_nodes",
        description: "Search n8n nodes by keyword",
        inputSchema: {
          type: "object",
          properties: {
            keyword: { type: "string" },
          },
          required: ["keyword"],
        },
      },
      // Add more tools...
    ],
  };
});

// Handle tool calls
server.setRequestHandler("tools/call", async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "list_workflows") {
    const response = await axios.get(`${N8N_API_URL}/workflows`, {
      headers: { "X-N8N-API-KEY": N8N_API_KEY },
    });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  if (name === "search_nodes") {
    // Implement search logic
    // ...
  }

  throw new Error(`Unknown tool: ${name}`);
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
```

#### 4. Configure in VS Code

Add to your VS Code `settings.json`:

```json
{
  "mcp.servers": {
    "n8n-helper": {
      "command": "node",
      "args": ["/path/to/n8n-helper-mcp/dist/index.js"],
      "env": {
        "N8N_API_URL": "https://your-instance.com/api/v1",
        "N8N_API_KEY": "your-api-key"
      }
    }
  }
}
```

#### 5. Tools to Implement

Convert each bash function to an MCP tool:

| Bash Function | MCP Tool Name | Parameters |
|---------------|---------------|------------|
| `list_workflows()` | `list_n8n_workflows` | none |
| `get_workflow()` | `get_n8n_workflow` | `workflow_id` |
| `search_nodes()` | `search_n8n_nodes` | `keyword` |
| `export_all_nodes()` | `export_n8n_catalog` | `filename` |
| `execute_workflow()` | `execute_n8n_workflow` | `workflow_id` |
| `get_executions()` | `get_n8n_executions` | `workflow_id`, `limit` |

### Example MCP Tool Implementation

```typescript
// Complete example for search_nodes tool
async function searchNodes(keyword: string) {
  // Fetch all workflows
  const workflows = await axios.get(`${N8N_API_URL}/workflows`, {
    headers: { "X-N8N-API-KEY": N8N_API_KEY },
  });

  // Extract nodes
  const nodes = workflows.data.data
    .flatMap((wf: any) => wf.nodes || [])
    .filter((node: any) => 
      node.type.toLowerCase().includes(keyword.toLowerCase()) ||
      node.name.toLowerCase().includes(keyword.toLowerCase())
    );

  // Group by type
  const grouped = nodes.reduce((acc: any, node: any) => {
    if (!acc[node.type]) {
      acc[node.type] = {
        type: node.type,
        count: 0,
        examples: [],
      };
    }
    acc[node.type].count++;
    if (acc[node.type].examples.length < 3) {
      acc[node.type].examples.push(node.name);
    }
    return acc;
  }, {});

  return Object.values(grouped);
}
```

### Benefits of MCP Conversion

**For developers:**
- Ask Copilot to create workflows, it executes directly
- "Deploy this workflow to n8n" → Done automatically
- Real-time workflow management from chat

**For teams:**
- Standardized n8n operations
- AI-assisted workflow development
- Automated testing and deployment

**For automation:**
- AI can manage n8n autonomously
- Self-healing workflows
- Intelligent node selection

### Resources

- **MCP SDK:** https://github.com/modelcontextprotocol/sdk
- **MCP Specification:** https://spec.modelcontextprotocol.io/
- **Example Servers:** https://github.com/modelcontextprotocol/servers
- **VS Code MCP:** https://code.visualstudio.com/docs/copilot/chat/mcp

---

## 📖 Understanding the Output

### Node Catalog Structure

When you run `export-all-nodes`, you get:

```json
{
  "exportedAt": "2025-11-01 12:00:00",
  "source": "n8n complete node catalog + workflow usage",
  "totalAvailableNodes": 851,
  "totalWorkflows": 10,
  
  "statistics": {
    "totalAvailableNodes": 851,
    "totalUsedNodes": 31,
    "unusedNodesCount": 820,
    "categoriesCount": 15
  },
  
  "categories": [
    {
      "category": "AI",
      "nodeCount": 363,
      "nodes": ["ChatGPT", "Claude", "LangChain", ...]
    }
  ],
  
  "allNodes": [
    {
      "name": "n8n-nodes-base.postgres",
      "displayName": "Postgres",
      "description": "Get, add and update data in Postgres",
      "version": 2.6,
      "properties": [...],
      "credentials": [...],
      "categories": ["Data & Storage"]
    }
  ],
  
  "usageStats": [
    {
      "nodeType": "n8n-nodes-base.postgres",
      "usageCount": 5,
      "versions": [2, 2.6],
      "exampleConfigurations": [...]
    }
  ]
}
```

### Workflow Structure

When you run `download`, you get clean workflow JSON:

```json
{
  "name": "My Workflow",
  "nodes": [
    {
      "id": "node-id",
      "type": "n8n-nodes-base.postgres",
      "typeVersion": 2.6,
      "position": [250, 300],
      "parameters": {
        "operation": "executeQuery",
        "query": "SELECT * FROM users"
      },
      "credentials": {
        "postgres": {
          "id": "1",
          "name": "My Postgres"
        }
      }
    }
  ],
  "connections": {...},
  "settings": {...}
}
```

---

## 🔒 Security Best Practices

1. **Never commit `.env`** - It contains sensitive credentials
2. **Rotate API keys** regularly
3. **Session cookies expire** - Refresh when needed (usually 7 days)
4. **Use `.gitignore`** - Already configured to protect secrets
5. **Limit API key permissions** - Create read-only keys if possible

### What's Protected

The `.gitignore` file protects:
- `.env` (your credentials)
- `*catalog.json` (large generated files)
- `.n8n-api-config` (old config format)
- Temporary files

### What's Safe to Share

- `n8n-helper.sh` (the script)
- `.env.example` (template without credentials)
- `workflows/*.json` (exported workflows - review for secrets first!)
- This README

---

## 🐛 Troubleshooting

### "Error: N8N_API_KEY not set"

**Solution:** Create `.env` file from template
```bash
cp .env.example .env
# Edit .env and add your API key
```

### "Error: N8N_API_URL must be set"

**Solution:** Add your n8n instance URL to `.env`
```bash
N8N_API_URL=https://your-n8n-instance.com/api/v1
N8N_BASE_URL=https://your-n8n-instance.com
```

### "Unauthorized" when fetching complete catalog

**Solution:** Refresh session cookie
1. Login to n8n again
2. Get new `n8n-auth` cookie value
3. Update `N8N_SESSION_COOKIE` in `.env`

### "command not found: jq"

**Solution:** Install jq
```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq

# Other: https://jqlang.github.io/jq/download/
```

### Only seeing 31 nodes instead of 851

**Solution:** Configure session authentication (see Quick Start section 3)

### Script not executable

**Solution:**
```bash
chmod +x n8n-helper.sh
```

---

## 📦 What's Included

```
n8n_helper/
├── n8n-helper.sh           # Main script (926 lines)
├── .env.example            # Configuration template
├── .gitignore             # Protects sensitive files
├── README.md              # This file
└── workflows/             # Downloaded workflows (optional)
```

---

## 🎯 Common Workflows

### Backup All Workflows

```bash
#!/bin/bash
# backup-workflows.sh

mkdir -p backups/$(date +%Y-%m-%d)

# Get all workflow IDs
./n8n-helper.sh list | tail -n +2 | awk '{print $1}' | while read id; do
    echo "Backing up $id..."
    ./n8n-helper.sh download "$id" "backups/$(date +%Y-%m-%d)/$id.json"
done

echo "✅ Backup complete!"
```

### Export Everything

```bash
#!/bin/bash
# export-all.sh

echo "Exporting complete node catalog..."
./n8n-helper.sh export-all-nodes exports/complete_catalog_$(date +%Y%m%d).json

echo "Exporting workflow-based catalog..."
./n8n-helper.sh export-nodes exports/workflow_catalog_$(date +%Y%m%d).json

echo "✅ Export complete!"
```

### Monitor Executions

```bash
#!/bin/bash
# monitor.sh

WORKFLOW_ID=$1

while true; do
    clear
    echo "=== Latest Executions for $WORKFLOW_ID ==="
    ./n8n-helper.sh executions "$WORKFLOW_ID" 5
    sleep 10
done
```

---

## 🙏 Credits

Created for the n8n community to make workflow management and node discovery easier!

## 📄 License

MIT License - Feel free to use, modify, and share!

---

## 🚀 Quick Reference Card

```bash
# Setup
cp .env.example .env && nano .env

# Workflows
./n8n-helper.sh list                    # List all
./n8n-helper.sh get <id>               # Get one
./n8n-helper.sh download <id> file.json # Backup
./n8n-helper.sh execute <id>           # Run

# Nodes
./n8n-helper.sh nodes                   # List all (851 with session)
./n8n-helper.sh search <keyword>       # Find specific
./n8n-helper.sh export-all-nodes cat.json # Export catalog

# Analysis
jq '.statistics' catalog.json           # See stats
jq '.categories' catalog.json           # See categories
jq '.allNodes[] | select(.categories | contains(["AI"]))' catalog.json

# Help
./n8n-helper.sh help                    # Full command list
```

---

**Made with ❤️ for the n8n community**
