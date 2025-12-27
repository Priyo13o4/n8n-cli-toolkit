import { logger } from '../utils/logger.js';

export interface WorkflowData {
  name: string;
  nodes: any[];
  connections: any;
  settings?: any;
}

export class N8nWorkflowService {
  private apiUrl: string;
  private apiKey: string;

  constructor(apiUrl: string, apiKey: string) {
    this.apiUrl = apiUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = apiKey;
  }

  private async request(method: string, endpoint: string, data?: any) {
    const url = `${this.apiUrl}/${endpoint}`;
    
    const options: RequestInit = {
      method,
      headers: {
        'X-N8N-API-KEY': this.apiKey,
        'Content-Type': 'application/json',
      },
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    logger.info(`${method} ${url}`);
    
    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`HTTP ${response.status}: ${error}`);
      }

      return await response.json();
    } catch (error) {
      logger.error(`API request failed: ${error}`);
      throw error;
    }
  }

  /**
   * Get n8n instance version and metadata
   * This helps ensure database compatibility with the running n8n instance
   */
  async getInstanceInfo() {
    try {
      // Try fetching from /api/v1/healthz or root API to get version info
      // Different n8n versions expose this differently
      
      // Method 1: Try the healthz endpoint (newer versions)
      try {
        const health: any = await this.request('GET', 'healthz');
        if (health && health.status === 'ok') {
          logger.info('Instance is healthy');
        }
      } catch (e) {
        // Ignore - healthz might not be available
      }

      // Method 2: Get a workflow to infer version from response structure
      const workflows: any = await this.request('GET', 'workflows?limit=1');
      
      // Determine version based on API response structure
      const isPaginated = workflows.data && Array.isArray(workflows.data);
      const apiVersion = isPaginated ? '>=1.0' : '<1.0';

      // Try to get more specific version info
      // Note: n8n doesn't expose version in API directly for security
      // We can only infer from API structure or workflow nodes

      return {
        apiVersion,
        isPaginated,
        apiUrl: this.apiUrl,
        note: 'n8n does not expose exact version via API. Use workflow nodes to determine version.',
        suggestion: 'Create a workflow with AI Agent node to check available typeVersion'
      };
    } catch (error) {
      logger.error('Failed to get instance info:', error);
      throw new Error(`Could not connect to n8n instance: ${error}`);
    }
  }

  async listWorkflows() {
    // Fetch all workflows by handling pagination
    let allWorkflows: any[] = [];
    let cursor: string | null = null;
    let hasMore = true;

    while (hasMore) {
      const params = new URLSearchParams();
      params.append('limit', '100'); // Fetch 100 at a time
      if (cursor) {
        params.append('cursor', cursor);
      }

      const response: any = await this.request('GET', `workflows?${params.toString()}`);
      
      // Handle both array response (older n8n) and paginated response (newer n8n)
      if (Array.isArray(response)) {
        allWorkflows = response;
        hasMore = false;
      } else if (response.data && Array.isArray(response.data)) {
        allWorkflows = allWorkflows.concat(response.data);
        cursor = response.nextCursor || null;
        hasMore = !!response.nextCursor;
      } else {
        // Fallback - assume response is the data
        allWorkflows = response;
        hasMore = false;
      }
    }

    logger.info(`Fetched ${allWorkflows.length} workflows total`);
    
    // Filter workflows to return only essential metadata (not full node/connection data)
    const minimalWorkflows = allWorkflows.map(wf => ({
      id: wf.id,
      name: wf.name,
      active: wf.active,
      createdAt: wf.createdAt,
      updatedAt: wf.updatedAt,
      versionId: wf.versionId,
      tags: wf.tags,
      triggerCount: wf.triggerCount,
      isArchived: wf.isArchived
    }));
    
    // Return in the same format as n8n API
    return {
      data: minimalWorkflows,
      nextCursor: null
    };
  }

  async getWorkflow(workflowId: string) {
    return this.request('GET', `workflows/${workflowId}`);
  }

  async getWorkflowByName(workflowName: string) {
    const workflows: any = await this.listWorkflows();
    const workflow = workflows.data.find((w: any) => w.name === workflowName);
    
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowName}`);
    }

    return this.getWorkflow(workflow.id);
  }

  async createWorkflow(workflow: WorkflowData) {
    return this.request('POST', 'workflows', workflow);
  }

  async updateWorkflow(workflowId: string, workflow: WorkflowData) {
    return this.request('PUT', `workflows/${workflowId}`, workflow);
  }

  async deleteWorkflow(workflowId: string) {
    return this.request('DELETE', `workflows/${workflowId}`);
  }

  async toggleWorkflow(workflowId: string, active: boolean) {
    return this.request('PATCH', `workflows/${workflowId}`, { active });
  }

  async executeWorkflow(workflowId: string) {
    return this.request('POST', `workflows/${workflowId}/execute`);
  }

  async getExecutions(workflowId?: string, limit: number = 10) {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (workflowId) {
      params.append('workflowId', workflowId);
    }
    return this.request('GET', `executions?${params.toString()}`);
  }

  async getExecutionDetails(executionId: string) {
    return this.request('GET', `executions/${executionId}`);
  }
}
