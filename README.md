# n8n Unified MCP Server

> **Independent Model Context Protocol (MCP) server** for n8n workflow management and node documentation

An all-in-one MCP server that provides AI assistants (Claude, Copilot, Cursor) with complete access to your n8n instance workflows and a comprehensive 540-node catalog with full documentation.

## ✨ Features

- **540 Nodes with Full Documentation** - Complete node catalog extracted from your local n8n installation
- **Version-Matched Database** - Database automatically matches your n8n instance version
- **Workflow Management** - Create, update, delete, and execute workflows via MCP
- **AI Assistant Integration** - Works with Claude, GitHub Copilot, and Cursor
- **Completely Independent** - No external dependencies or other projects required
- **Comprehensive Documentation** - Every node includes description, categories, parameters, and usage hints

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- npm or yarn
- n8n instance (2.0.0+) with API access
- AI assistant (Claude, Copilot, Cursor)

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/n8n-cli-toolkit.git
cd n8n-cli-toolkit/mcp-server

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

### Configuration

Edit `.env` with your settings:

```bash
# Required: Your n8n instance API URL
N8N_API_URL=https://your-n8n-instance.com/api/v1

# Required: Your n8n base URL
N8N_BASE_URL=https://your-n8n-instance.com

# Required: Your n8n API key (from Settings > API)
N8N_API_KEY=your_api_key_here

# Required: Your n8n version (e.g., n8n@2.0.3)
# This ensures the node database matches your instance
N8N_VERSION=n8n@2.0.3
```

### Build Node Database

```bash
# First time: Extract 540 nodes with documentation (~1-2 minutes)
npm run rebuild-db

# Rebuilding for different n8n versions
N8N_VERSION=n8n@2.1.0 npm run rebuild-db
```

### Start Server

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## 📚 Available Tools

### Node Documentation (540 nodes)

- **search_n8n_nodes** - Search nodes by keyword (lightweight search, excludes heavy data to save tokens)
- **get_node_info** - Get complete node details with documentation, parameters, operations
- **list_node_categories** - Get all available node categories
- **get_nodes_by_category** - Get all nodes in a specific category
- **get_ai_nodes** - Get list of AI-capable nodes
- **get_database_version** - Check which n8n version your database is built for
- **fetch_node_catalog_from_github** - Fetch node catalog from any n8n GitHub version tag

### Workflow Management

- **list_workflows** - List all workflows with status and metadata
- **get_workflow** - Get complete workflow definition by ID
- **get_workflow_by_name** - Get workflow by name
- **create_workflow** - Deploy new workflows
- **update_workflow** - Modify existing workflows
- **delete_workflow** - Remove workflows
- **toggle_workflow** - Activate/deactivate workflows
- **execute_workflow** - Manually execute workflows
- **get_executions** - Get workflow execution history
- **get_execution_details** - Get detailed execution information

## 🔗 Integration with AI Assistants

### VS Code + GitHub Copilot

Add to `.vscode/settings.json`:

```json
{
  "mcp.servers": {
    "n8n-unified": {
      "command": "node",
      "args": ["${workspaceFolder}/mcp-server/dist/index.js"],
      "env": {
        "N8N_API_URL": "https://your-n8n-instance.com/api/v1",
        "N8N_API_KEY": "your-api-key",
        "MCP_MODE": "stdio",
        "LOG_LEVEL": "error"
      }
    }
  }
}
```

### Claude Desktop (macOS)

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "n8n-unified": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/index.js"],
      "env": {
        "N8N_API_URL": "https://your-n8n-instance.com/api/v1",
        "N8N_API_KEY": "your-api-key",
        "MCP_MODE": "stdio"
      }
    }
  }
}
```

## 🔧 Development

### Build

```bash
npm run build
```

### Development Mode with Hot Reload

```bash
npm run dev
```

### Rebuild Node Database

```bash
npm run rebuild-db
```

### Run Tests

```bash
npm test
```

## 📊 Project Statistics

- **Supported Nodes:** 540 (from n8n-nodes-base and @n8n/n8n-nodes-langchain)
- **Nodes with Documentation:** 539/540
- **Node Categories:** 20+
- **AI-Capable Nodes:** 80+
- **Database Size:** ~5-10MB (SQLite)

## 🛠️ Architecture

The mcp-server consists of:

1. **Node Service** - Manages 540-node SQLite database with documentation
   - Searches nodes by keyword
   - Extracts metadata and documentation
   - Handles version tracking

2. **Workflow Service** - Handles n8n API interactions
   - CRUD operations on workflows
   - Execution management
   - Version and state tracking

3. **MCP Handler** - Routes requests to appropriate services
   - Tool registration
   - Parameter validation
   - Response formatting

4. **Node Loader** - Dynamically loads n8n nodes
   - Extracts node metadata
   - Builds documentation from descriptions
   - Tracks node versions

## 🔐 Security

- **No Stored Credentials** - API keys only used at runtime
- **Local Database** - All node data stays on your machine
- **No External Calls** - Node documentation doesn't require GitHub access
- **API Key Protection** - Never commit `.env` files with credentials
- **Environment-Based Config** - All sensitive data via environment variables

## 📋 Requirements

- **Node.js:** 18.0.0 or higher
- **npm:** 9.0.0 or higher
- **n8n Instance:** 2.0.0 or higher
- **RAM:** Minimum 512MB (recommended 1GB+)
- **Storage:** ~50MB for database and dependencies

## 🤝 Contributing

Contributions welcome! Please feel free to submit issues or pull requests.

## 📝 License

MIT License - see [LICENSE](LICENSE) for details

## 📖 Detailed Documentation

For more information, see [mcp-server/README.md](mcp-server/README.md)

## 🆘 Troubleshooting

### "Database version mismatch"

```bash
# Rebuild for your n8n version
N8N_VERSION=n8n@YOUR_VERSION npm run rebuild-db
```

### "API Key not working"

1. Open n8n instance in browser
2. Go to Settings → API
3. Create or retrieve your API key
4. Update `.env`

### "Nodes not found"

```bash
# Ensure database was built
npm run rebuild-db
```

## 📞 Support

- Check [mcp-server/README.md](mcp-server/README.md) for detailed documentation
- Review [GitHub Issues](https://github.com/yourusername/n8n-cli-toolkit/issues)
- Consult [n8n Documentation](https://docs.n8n.io/)

## 📚 Resources

- [n8n Documentation](https://docs.n8n.io/)
- [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)
- [MCP SDK for TypeScript](https://github.com/modelcontextprotocol/typescript-sdk)

---

**Made with ❤️ for n8n automation enthusiasts**
