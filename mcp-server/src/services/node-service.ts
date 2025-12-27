import Database from 'better-sqlite3';

import path from 'path';
import { logger } from '../utils/logger.js';

export interface NodeInfo {
  node_type: string;
  package_name: string;
  display_name: string;
  description: string;
  category: string;
  is_ai_tool: number;
  is_trigger: number;
  is_webhook: number;
  is_versioned?: number;
  version?: string;
  documentation?: string;
  properties_schema?: string;
  operations?: string;
  credentials_required?: string;
}

export class N8nNodeService {
  private db: any;
  private templatesDb: any;

  constructor(dbPath?: string, templatesDbPath?: string) {
    // Use local database by default, fallback to n8n-mcp
    const resolvedDbPath = dbPath || path.resolve(process.cwd(), './data/nodes.db');
    const resolvedTemplatesDbPath = templatesDbPath || path.resolve(process.cwd(), '../n8n-mcp/data/templates.db');

    logger.info(`Connecting to nodes database: ${resolvedDbPath}`);
    logger.info(`Connecting to templates database: ${resolvedTemplatesDbPath}`);

    try {
      this.db = new Database(resolvedDbPath, { readonly: true });
      
      // Templates DB is optional
      try {
        this.templatesDb = new Database(resolvedTemplatesDbPath, { readonly: true });
      } catch (e) {
        logger.warn('Templates database not found, template features will be unavailable');
      }
      
      logger.info('Successfully connected to databases');
    } catch (error) {
      logger.error('Failed to connect to databases:', error);
      throw new Error(`Database connection failed: ${error}`);
    }
  }

  /**
   * Search nodes by keyword across name, description, and documentation
   * Returns minimal info to save tokens - use getNodeInfo for full details
   */
  searchNodes(keyword: string, limit: number = 10): Array<Omit<NodeInfo, 'documentation' | 'properties_schema' | 'operations' | 'credentials_required'>> {
    const query = `
      SELECT 
        node_type,
        package_name,
        display_name,
        description,
        category,
        is_ai_tool,
        is_trigger,
        is_webhook
      FROM nodes
      WHERE node_type LIKE ? 
         OR display_name LIKE ? 
         OR description LIKE ?
         OR documentation LIKE ?
      LIMIT ?
    `;

    const searchPattern = `%${keyword}%`;
    const results = this.db.prepare(query).all(
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      limit
    );

    logger.info(`Found ${results.length} nodes matching "${keyword}" (minimal info, use get_node_info for full details)`);
    return results;
  }

  /**
   * Get detailed information about a specific node
   */
  getNodeInfo(nodeType: string): NodeInfo | null {
    // Normalize node type (handle both formats)
    const normalizedType = nodeType.replace('n8n-nodes-base.', 'nodes-base.');

    const query = `SELECT * FROM nodes WHERE node_type = ?`;
    const result = this.db.prepare(query).get(normalizedType) as NodeInfo | undefined;

    if (!result) {
      logger.warn(`Node not found: ${nodeType}`);
      return null;
    }

    // Parse JSON fields
    if (result.properties_schema) {
      try {
        (result as any).properties = JSON.parse(result.properties_schema);
      } catch (e) {
        logger.error(`Failed to parse properties_schema for ${nodeType}`);
      }
    }

    if (result.operations) {
      try {
        (result as any).operations_list = JSON.parse(result.operations);
      } catch (e) {
        logger.error(`Failed to parse operations for ${nodeType}`);
      }
    }

    if (result.credentials_required) {
      try {
        (result as any).credentials = JSON.parse(result.credentials_required);
      } catch (e) {
        logger.error(`Failed to parse credentials for ${nodeType}`);
      }
    }

    // Parse version field - could be JSON array of versions
    if (result.version) {
      try {
        const parsed = JSON.parse(result.version);
        (result as any).versions = Array.isArray(parsed) ? parsed : [parseFloat(result.version)];
        (result as any).latest_version = (result as any).versions[0];
      } catch {
        // Not JSON, treat as single version
        (result as any).versions = [parseFloat(result.version)];
        (result as any).latest_version = parseFloat(result.version);
      }
    }

    return result;
  }

  /**
   * Get all available categories
   */
  getCategories(): string[] {
    const query = `SELECT DISTINCT category FROM nodes WHERE category IS NOT NULL ORDER BY category`;
    const results = this.db.prepare(query).all() as { category: string }[];
    return results.map(r => r.category);
  }

  /**
   * Get all nodes in a specific category
   */
  getNodesByCategory(category: string): NodeInfo[] {
    const query = `
      SELECT * FROM nodes 
      WHERE category = ? 
      ORDER BY display_name
    `;
    return this.db.prepare(query).all(category) as NodeInfo[];
  }

  /**
   * Get all AI-capable nodes
   */
  getAINodes(): NodeInfo[] {
    const query = `
      SELECT * FROM nodes 
      WHERE is_ai_tool = 1 OR category = 'AI'
      ORDER BY display_name
    `;
    return this.db.prepare(query).all() as NodeInfo[];
  }

  /**
   * Get node statistics
   */
  getStatistics() {
    const totalNodes = this.db.prepare('SELECT COUNT(*) as count FROM nodes').get() as { count: number };
    const byPackage = this.db.prepare(`
      SELECT package_name, COUNT(*) as count 
      FROM nodes 
      GROUP BY package_name
    `).all() as { package_name: string; count: number }[];
    
    const aiNodes = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM nodes 
      WHERE is_ai_tool = 1
    `).get() as { count: number };

    return {
      totalNodes: totalNodes.count,
      byPackage,
      aiNodes: aiNodes.count,
    };
  }

  /**
   * Fetch node catalog directly from n8n GitHub repository
   * Supports fetching from a specific version tag or branch
   */
  async fetchNodeCatalogFromGitHub(versionOrBranch: string = 'master'): Promise<any> {
    const GITHUB_RAW_URL = `https://raw.githubusercontent.com/n8n-io/n8n/${versionOrBranch}`;
    
    try {
      logger.info(`📡 Fetching node catalog from n8n GitHub (${versionOrBranch})...`);
      
      // Fetch package.json to get n8n version
      const versionResponse = await fetch(`${GITHUB_RAW_URL}/packages/cli/package.json`);
      if (!versionResponse.ok) {
        throw new Error(`Failed to fetch n8n version from ${versionOrBranch}: ${versionResponse.statusText}`);
      }
      const versionData: any = await versionResponse.json();
      const n8nVersion = versionData.version;
      logger.info(`n8n version: ${n8nVersion}`);
      
      // Fetch nodes-base package.json to get list of nodes
      const nodesBaseResponse = await fetch(`${GITHUB_RAW_URL}/packages/nodes-base/package.json`);
      if (!nodesBaseResponse.ok) {
        throw new Error(`Failed to fetch nodes-base package: ${nodesBaseResponse.statusText}`);
      }
      const nodesBaseData: any = await nodesBaseResponse.json();
      
      // Extract node files from package.json n8n configuration
      const nodeFiles = nodesBaseData.n8n?.nodes || [];
      
      logger.info(`Found ${nodeFiles.length} nodes in nodes-base`);
      
      // Fetch langchain nodes
      const langchainResponse = await fetch(`${GITHUB_RAW_URL}/packages/@n8n/n8n-nodes-langchain/package.json`);
      const langchainNodes = [];
      if (langchainResponse.ok) {
        const langchainData: any = await langchainResponse.json();
        langchainNodes.push(...(langchainData.n8n?.nodes || []));
        logger.info(`Found ${langchainNodes.length} langchain nodes`);
      } else {
        logger.warn(`Could not fetch langchain nodes from ${versionOrBranch}`);
      }
      
      return {
        version: n8nVersion,
        fetchedFrom: versionOrBranch,
        nodesBase: nodeFiles,
        langchain: langchainNodes,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Failed to fetch node catalog from GitHub (${versionOrBranch}):`, error);
      throw error;
    }
  }

  /**
   * Get the current n8n database version
   * Checks if a version metadata table exists and returns the stored version
   */
  getDatabaseVersion(): string | null {
    try {
      // Check if metadata table exists
      const tableExists = this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='metadata'
      `).get();

      if (!tableExists) {
        logger.warn('No metadata table found in database');
        return null;
      }

      // Get version from metadata
      const versionRow = this.db.prepare(`
        SELECT value FROM metadata WHERE key = 'n8n_version'
      `).get() as { value: string } | undefined;

      return versionRow?.value || null;
    } catch (error) {
      logger.error('Failed to get database version:', error);
      return null;
    }
  }

  /**
   * Close database connections
   */
  close() {
    this.db.close();
    this.templatesDb.close();
  }
}
