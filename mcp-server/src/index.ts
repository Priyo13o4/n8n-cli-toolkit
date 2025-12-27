#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as dotenv from 'dotenv';
import { z } from 'zod';
import { N8nNodeService } from './services/node-service.js';
import { N8nWorkflowService } from './services/workflow-service.js';
import { logger } from './utils/logger.js';

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['N8N_API_URL', 'N8N_API_KEY'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  logger.error(`Missing required environment variables: ${missingVars.join(', ')}`);
  process.exit(1);
}

// Initialize services
const nodeService = new N8nNodeService(
  process.env.N8N_MCP_DB_PATH || './data/nodes.db',
  process.env.N8N_MCP_TEMPLATES_DB_PATH || '../n8n-mcp/data/templates.db'
);

const workflowService = new N8nWorkflowService(
  process.env.N8N_API_URL!,
  process.env.N8N_API_KEY!
);

// Create MCP server
const server = new Server(
  {
    name: 'n8n-unified-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool definitions
const tools = [
  // ============================================
  // NODE DOCUMENTATION TOOLS (from n8n-MCP)
  // ============================================
  {
    name: 'search_n8n_nodes',
    description: 'Search for n8n nodes by keyword. Searches across node names, descriptions, and documentation. Returns comprehensive node information including parameters, operations, and examples.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        keyword: {
          type: 'string',
          description: 'Search keyword (e.g., "slack", "database", "webhook")',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 10)',
          default: 10,
        },
      },
      required: ['keyword'],
    },
  },
  {
    name: 'get_node_info',
    description: 'Get detailed information about a specific n8n node including all parameters, operations, credentials, documentation, and usage examples.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        nodeType: {
          type: 'string',
          description: 'The node type (e.g., "nodes-base.slack", "nodes-base.postgres")',
        },
      },
      required: ['nodeType'],
    },
  },
  {
    name: 'list_node_categories',
    description: 'List all available node categories in n8n (e.g., Communication, Database, AI, Transform, etc.)',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_nodes_by_category',
    description: 'Get all nodes in a specific category',
    inputSchema: {
      type: 'object' as const,
      properties: {
        category: {
          type: 'string',
          description: 'Category name (e.g., "Communication", "Database", "AI")',
        },
      },
      required: ['category'],
    },
  },
  {
    name: 'get_ai_nodes',
    description: 'List all AI-capable nodes and AI tool variants available in n8n',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'fetch_node_catalog_from_github',
    description: 'Fetch node catalog directly from n8n GitHub repository. Returns n8n version and lists of available nodes from nodes-base and langchain packages. **IMPORTANT**: Supports fetching from specific n8n version tags (e.g., "n8n@2.0.3") to match your n8n instance version. Use this to verify node availability for your specific n8n version.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        version: {
          type: 'string',
          description: 'The n8n version tag or branch to fetch from (e.g., "n8n@2.0.3", "n8n@2.2.0", or "master"). Defaults to "master" if not specified.',
          default: 'master'
        }
      },
    },
  },
  {
    name: 'get_database_version',
    description: 'Get the n8n version that the current node database was built for. This helps identify version mismatches between your n8n instance and the node documentation database.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_n8n_instance_info',
    description: 'Get information about your running n8n instance including API version and connection status. Use this to determine what version of n8n you are running.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },

  // ============================================
  // WORKFLOW MANAGEMENT TOOLS (from shell script)
  // ============================================
  {
    name: 'list_workflows',
    description: 'List all workflows with essential metadata only (id, name, active status, dates, tags). Returns lightweight summary without nodes/connections. Use get_workflow to retrieve full workflow details.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_workflow',
    description: 'Get complete workflow details including all nodes, connections, and configuration for a specific workflow ID',
    inputSchema: {
      type: 'object' as const,
      properties: {
        workflowId: {
          type: 'string',
          description: 'The workflow ID',
        },
      },
      required: ['workflowId'],
    },
  },
  {
    name: 'get_workflow_by_name',
    description: 'Find and retrieve a workflow by its name',
    inputSchema: {
      type: 'object' as const,
      properties: {
        workflowName: {
          type: 'string',
          description: 'The exact workflow name',
        },
      },
      required: ['workflowName'],
    },
  },
  {
    name: 'toggle_workflow',
    description: 'Activate or deactivate a workflow',
    inputSchema: {
      type: 'object' as const,
      properties: {
        workflowId: {
          type: 'string',
          description: 'The workflow ID',
        },
        active: {
          type: 'boolean',
          description: 'true to activate, false to deactivate',
        },
      },
      required: ['workflowId', 'active'],
    },
  },
  {
    name: 'execute_workflow',
    description: 'Manually execute a workflow',
    inputSchema: {
      type: 'object' as const,
      properties: {
        workflowId: {
          type: 'string',
          description: 'The workflow ID to execute',
        },
      },
      required: ['workflowId'],
    },
  },
  {
    name: 'get_executions',
    description: 'Get recent execution history for a workflow or all workflows',
    inputSchema: {
      type: 'object' as const,
      properties: {
        workflowId: {
          type: 'string',
          description: 'Optional workflow ID to filter executions',
        },
        limit: {
          type: 'number',
          description: 'Number of executions to return (default: 10)',
          default: 10,
        },
      },
    },
  },
  {
    name: 'get_execution_details',
    description: 'Get detailed information about a specific workflow execution',
    inputSchema: {
      type: 'object' as const,
      properties: {
        executionId: {
          type: 'string',
          description: 'The execution ID',
        },
      },
      required: ['executionId'],
    },
  },
  {
    name: 'create_workflow',
    description: 'Create a new workflow in n8n',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'Workflow name',
        },
        nodes: {
          type: 'array',
          description: 'Array of workflow nodes',
          items: {
            type: 'object',
          },
        },
        connections: {
          type: 'object',
          description: 'Node connections configuration',
        },
        settings: {
          type: 'object',
          description: 'Optional workflow settings',
        },
      },
      required: ['name', 'nodes', 'connections'],
    },
  },
  {
    name: 'update_workflow',
    description: 'Update an existing workflow',
    inputSchema: {
      type: 'object' as const,
      properties: {
        workflowId: {
          type: 'string',
          description: 'The workflow ID to update',
        },
        name: {
          type: 'string',
          description: 'Workflow name',
        },
        nodes: {
          type: 'array',
          description: 'Array of workflow nodes',
          items: {
            type: 'object',
          },
        },
        connections: {
          type: 'object',
          description: 'Node connections configuration',
        },
        settings: {
          type: 'object',
          description: 'Optional workflow settings',
        },
      },
      required: ['workflowId', 'name', 'nodes', 'connections'],
    },
  },
  {
    name: 'delete_workflow',
    description: 'Delete a workflow from n8n',
    inputSchema: {
      type: 'object' as const,
      properties: {
        workflowId: {
          type: 'string',
          description: 'The workflow ID to delete',
        },
      },
      required: ['workflowId'],
    },
  },
];

// Register tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // Node documentation tools
    if (name === 'search_n8n_nodes') {
      const result = await nodeService.searchNodes(
        (args as any).keyword,
        (args as any).limit || 10
      );
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    if (name === 'get_node_info') {
      const result = await nodeService.getNodeInfo((args as any).nodeType);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    if (name === 'list_node_categories') {
      const result = await nodeService.getCategories();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    if (name === 'get_nodes_by_category') {
      const result = await nodeService.getNodesByCategory((args as any).category);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    if (name === 'get_ai_nodes') {
      const result = await nodeService.getAINodes();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    if (name === 'fetch_node_catalog_from_github') {
      const version = (args as any).version || 'master';
      const result = await nodeService.fetchNodeCatalogFromGitHub(version);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    if (name === 'get_database_version') {
      const version = nodeService.getDatabaseVersion();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              databaseVersion: version,
              databasePath: process.env.N8N_MCP_DB_PATH || '../n8n-mcp/data/nodes.db',
              note: version 
                ? `Database contains nodes for n8n ${version}` 
                : 'No version metadata found in database. Database may be from an older version of n8n-mcp.'
            }, null, 2),
          },
        ],
      };
    }

    if (name === 'get_n8n_instance_info') {
      const info = await workflowService.getInstanceInfo();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(info, null, 2),
          },
        ],
      };
    }

    // Workflow management tools
    if (name === 'list_workflows') {
      const result = await workflowService.listWorkflows();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    if (name === 'get_workflow') {
      const result = await workflowService.getWorkflow((args as any).workflowId);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    if (name === 'get_workflow_by_name') {
      const result = await workflowService.getWorkflowByName((args as any).workflowName);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    if (name === 'toggle_workflow') {
      const result = await workflowService.toggleWorkflow(
        (args as any).workflowId,
        (args as any).active
      );
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    if (name === 'execute_workflow') {
      const result = await workflowService.executeWorkflow((args as any).workflowId);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    if (name === 'get_executions') {
      const result = await workflowService.getExecutions(
        (args as any).workflowId,
        (args as any).limit || 10
      );
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    if (name === 'get_execution_details') {
      const result = await workflowService.getExecutionDetails((args as any).executionId);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    if (name === 'create_workflow') {
      const result = await workflowService.createWorkflow({
        name: (args as any).name,
        nodes: (args as any).nodes,
        connections: (args as any).connections,
        settings: (args as any).settings,
      });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    if (name === 'update_workflow') {
      const result = await workflowService.updateWorkflow(
        (args as any).workflowId,
        {
          name: (args as any).name,
          nodes: (args as any).nodes,
          connections: (args as any).connections,
          settings: (args as any).settings,
        }
      );
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    if (name === 'delete_workflow') {
      const result = await workflowService.deleteWorkflow((args as any).workflowId);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    logger.error(`Error executing tool ${name}:`, error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error',
          }),
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('n8n Unified MCP server started successfully');
}

main().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});
