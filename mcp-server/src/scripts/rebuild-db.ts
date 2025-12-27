#!/usr/bin/env node
import Database from 'better-sqlite3';
import { N8nNodeLoader } from '../loaders/node-loader.js';
import * as path from 'path';
import * as fs from 'fs';

// Get n8n version from environment or use default
const N8N_VERSION = process.env.N8N_VERSION || 'n8n@2.0.3';

async function rebuild() {
  console.log('🔄 Rebuilding n8n node database for mcp-server...\n');
  console.log(`📌 Target n8n version: ${N8N_VERSION}\n`);
  
  const dbPath = path.join(process.cwd(), 'data/nodes.db');
  const dbDir = path.dirname(dbPath);
  
  // Ensure data directory exists
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  // Create database
  const db = new Database(dbPath);
  
  // Create schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS nodes (
      node_type TEXT PRIMARY KEY,
      package_name TEXT,
      display_name TEXT,
      description TEXT,
      category TEXT,
      documentation TEXT,
      properties_schema TEXT,
      operations TEXT,
      credentials_required TEXT,
      outputs TEXT,
      output_names TEXT,
      development_style TEXT,
      is_ai_tool INTEGER DEFAULT 0,
      is_trigger INTEGER DEFAULT 0,
      is_webhook INTEGER DEFAULT 0,
      is_versioned INTEGER DEFAULT 0,
      version TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_tool_variant INTEGER DEFAULT 0,
      has_tool_variant INTEGER DEFAULT 0,
      base_node_type TEXT,
      tool_variant_of TEXT
    );
    
    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
  
  // Clear existing data
  db.exec('DELETE FROM nodes');
  db.exec('DELETE FROM metadata');
  console.log('🗑️  Cleared existing data\n');
  
  // Load nodes from local installation
  console.log('📦 Loading nodes from local n8n installation...');
  const loader = new N8nNodeLoader();
  const nodes = await loader.loadAllNodes();
  console.log(`\n📦 Loaded ${nodes.length} nodes total\n`);
  
  // Fetch documentation from GitHub for the specified version
  console.log(`📖 Fetching documentation from GitHub (${N8N_VERSION})...\n`);
  const docsMap = await fetchDocumentationFromGitHub(N8N_VERSION);
  console.log(`📖 Fetched documentation for ${Object.keys(docsMap).length} nodes\n`);
  
  // Insert nodes with full data
  const insert = db.prepare(`
    INSERT OR REPLACE INTO nodes (
      node_type, package_name, display_name, description, category,
      documentation, properties_schema, operations, credentials_required,
      is_versioned, version, development_style, is_trigger, is_webhook
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  let successful = 0;
  let docsExtracted = 0;
  
  for (const node of nodes) {
    try {
      const nodeClass = node.NodeClass;
      const description = getNodeDescription(nodeClass);
      
      const nodeType = extractNodeType(description, node.packageName);
      const displayName = description.displayName || description.name || node.nodeName;
      const desc = description.description || '';
      const category = description.group?.[0] || 'misc';
      const isVersioned = isVersionedNode(nodeClass);
      const version = extractVersion(nodeClass);
      const style = description.routing ? 'declarative' : 'programmatic';
      
      // Extract documentation from node description or GitHub
      const documentation = extractDocumentation(description, nodeType, docsMap);
      if (documentation) docsExtracted++;
      
      // Extract properties schema
      const properties = description.properties ? JSON.stringify(description.properties) : null;
      
      // Extract operations if available
      const operations = extractOperations(description);
      
      // Extract credentials
      const credentials = description.credentials ? JSON.stringify(description.credentials) : null;
      
      // Detect triggers and webhooks
      const isTrigger = description.polling || description.trigger || category === 'trigger' ? 1 : 0;
      const isWebhook = description.webhook || nodeType.includes('webhook') ? 1 : 0;
      
      insert.run(
        nodeType,
        node.packageName,
        displayName,
        desc,
        category,
        documentation,
        properties,
        operations,
        credentials,
        isVersioned ? 1 : 0,
        version,
        style,
        isTrigger,
        isWebhook
      );
      
      successful++;
      if (successful % 100 === 0) {
        console.log(`  Processed ${successful} nodes...`);
      }
    } catch (error) {
      console.error(`  ✗ Failed to parse ${node.nodeName}:`, (error as Error).message);
    }
  }
  
  // Extract version number from tag (e.g., "n8n@2.0.3" -> "2.0.3")
  const versionNumber = N8N_VERSION.replace(/^n8n@/, '');
  
  // Store version metadata
  db.prepare('INSERT INTO metadata (key, value) VALUES (?, ?)').run('n8n_version', versionNumber);
  db.prepare('INSERT INTO metadata (key, value) VALUES (?, ?)').run('rebuilt_at', new Date().toISOString());
  db.prepare('INSERT INTO metadata (key, value) VALUES (?, ?)').run('source', 'local+github');
  db.prepare('INSERT INTO metadata (key, value) VALUES (?, ?)').run('docs_extracted', docsExtracted.toString());
  
  console.log(`\n✅ Successfully processed ${successful}/${nodes.length} nodes`);
  console.log(`📖 Extracted documentation for ${docsExtracted} nodes`);
  console.log(`📊 Database saved to: ${dbPath}`);
  console.log(`📌 Version: ${versionNumber}\n`);
  
  db.close();
}

function getNodeDescription(nodeClass: any): any {
  try {
    if (nodeClass.nodeVersions || typeof nodeClass.getNodeType === 'function') {
      const instance = new nodeClass();
      return instance.description || instance.baseDescription || {};
    }
    
    if (typeof nodeClass === 'function') {
      const instance = new nodeClass();
      return instance.description || {};
    }
    
    return nodeClass.description || {};
  } catch {
    return {};
  }
}

function extractNodeType(description: any, packageName: string): string {
  const name = description.name;
  if (!name) return 'unknown';
  if (name.includes('.')) return name;
  
  const packagePrefix = packageName.replace('@n8n/', '').replace('n8n-', '');
  return `${packagePrefix}.${name}`;
}

function isVersionedNode(nodeClass: any): boolean {
  try {
    // Check class level first
    if (nodeClass.nodeVersions || typeof nodeClass.getNodeType === 'function') {
      return true;
    }
    // Check instance level (for VersionedNodeType)
    const instance = new nodeClass();
    return !!(instance.nodeVersions || instance.getNodeType);
  } catch {
    return false;
  }
}

function extractVersion(nodeClass: any): string {
  try {
    const instance = new nodeClass();
    
    // Check for instance.nodeVersions (VersionedNodeType pattern)
    if (instance.nodeVersions) {
      const versions = Object.keys(instance.nodeVersions).map(Number).sort((a, b) => b - a);
      return JSON.stringify(versions); // Store as JSON array
    }
    
    // Check for array version
    const desc = instance.description || instance.baseDescription;
    if (Array.isArray(desc?.version)) {
      return JSON.stringify(desc.version.sort((a: number, b: number) => b - a));
    }
    
    // Single version
    return desc?.version?.toString() || '1';
  } catch {
    return '1';
  }
}

function extractOperations(description: any): string | null {
  if (!description.properties) return null;
  
  // Look for operation/resource fields
  const operationField = description.properties.find((p: any) => 
    p.name === 'operation' || p.name === 'resource'
  );
  
  if (!operationField?.options) return null;
  
  return JSON.stringify(operationField.options);
}

/**
 * Extract documentation from node description or external sources
 */
function extractDocumentation(description: any, nodeType: string, githubDocs: Record<string, string>): string | null {
  // Priority 1: GitHub documentation (if available)
  if (githubDocs[nodeType]) {
    return githubDocs[nodeType];
  }
  
  // Priority 2: Build documentation from node description fields
  const docParts: string[] = [];
  
  // Add main description
  if (description.description) {
    docParts.push(`# ${description.displayName || description.name}\n\n${description.description}\n`);
  }
  
  // Add subtitle if available
  if (description.subtitle) {
    docParts.push(`## ${description.subtitle}\n`);
  }
  
  // Add properties documentation
  if (description.properties && Array.isArray(description.properties)) {
    const propertyDocs = description.properties
      .filter((p: any) => p.description)
      .map((p: any) => `**${p.displayName || p.name}**: ${p.description}`)
      .join('\n');
    
    if (propertyDocs) {
      docParts.push(`\n## Parameters\n\n${propertyDocs}\n`);
    }
  }
  
  // Add codex data if available
  if (description.codex) {
    const codexDoc = buildCodexDocumentation(description.codex);
    if (codexDoc) {
      docParts.push(codexDoc);
    }
  }
  
  // Add usage hints
  if (description.hints) {
    docParts.push(`\n## Hints\n\n${description.hints}\n`);
  }
  
  return docParts.length > 0 ? docParts.join('\n') : null;
}

/**
 * Build documentation from codex data
 */
function buildCodexDocumentation(codex: any): string | null {
  if (!codex) return null;
  
  const parts: string[] = [];
  
  if (codex.categories) {
    parts.push(`\n## Categories\n\n${codex.categories.join(', ')}`);
  }
  
  if (codex.subcategories) {
    parts.push(`\n## Use Cases\n\n${Object.entries(codex.subcategories).map(([k, v]: any) => `- ${k}: ${v}`).join('\n')}`);
  }
  
  if (codex.resources && Array.isArray(codex.resources)) {
    parts.push(`\n## Resources\n\n${codex.resources.map((r: any) => `- [${r.label}](${r.url})`).join('\n')}`);
  }
  
  if (codex.alias && codex.alias.length > 0) {
    parts.push(`\n## Also known as\n\n${codex.alias.join(', ')}`);
  }
  
  return parts.length > 0 ? parts.join('\n') : null;
}

/**
 * Fetch documentation from n8n GitHub repository
 */
async function fetchDocumentationFromGitHub(versionTag: string): Promise<Record<string, string>> {
  const docsMap: Record<string, string> = {};
  
  try {
    // GitHub raw URL for the specific version
    const baseUrl = `https://raw.githubusercontent.com/n8n-io/n8n/${versionTag}`;
    
    // Common documentation paths in n8n repository
    const docPaths = [
      '/packages/nodes-base/nodes',
      '/packages/@n8n/n8n-nodes-langchain/nodes'
    ];
    
    console.log('  📖 Fetching documentation from n8n repository...');
    
    // For now, we'll fetch README files for major nodes
    // A more comprehensive approach would parse all .md files
    const popularNodes = [
      { path: 'HttpRequest', type: 'nodes-base.httpRequest' },
      { path: 'Webhook', type: 'nodes-base.webhook' },
      { path: 'Code', type: 'nodes-base.code' },
      { path: 'If', type: 'nodes-base.if' },
      { path: 'Switch', type: 'nodes-base.switch' },
      { path: 'Merge', type: 'nodes-base.merge' },
      { path: 'Set', type: 'nodes-base.set' },
      { path: 'Gmail', type: 'nodes-base.gmail' },
      { path: 'Slack', type: 'nodes-base.slack' },
      { path: 'GoogleSheets', type: 'nodes-base.googleSheets' },
      { path: 'Postgres', type: 'nodes-base.postgres' },
      { path: 'MySQL', type: 'nodes-base.mySql' },
      { path: 'MongoDB', type: 'nodes-base.mongoDb' }
    ];
    
    // Fetch docs for popular nodes
    for (const node of popularNodes) {
      try {
        const readmePath = `${baseUrl}/packages/nodes-base/nodes/${node.path}/README.md`;
        const response = await fetch(readmePath);
        
        if (response.ok) {
          const content = await response.text();
          docsMap[node.type] = content;
          console.log(`  ✓ ${node.type}`);
        }
      } catch (err) {
        // Silently skip nodes without docs
      }
    }
    
    // Fetch AI Agent documentation for langchain nodes
    try {
      const agentDocPath = `${baseUrl}/packages/@n8n/n8n-nodes-langchain/nodes/agent/Agent/README.md`;
      const response = await fetch(agentDocPath);
      
      if (response.ok) {
        const content = await response.text();
        docsMap['nodes-langchain.agent'] = content;
        console.log('  ✓ nodes-langchain.agent');
      } else {
        // Try alternate path
        const altPath = `${baseUrl}/packages/@n8n/n8n-nodes-langchain/README.md`;
        const altResponse = await fetch(altPath);
        if (altResponse.ok) {
          const content = await altResponse.text();
          docsMap['nodes-langchain.agent'] = `# AI Agent\n\n${content}`;
          console.log('  ✓ nodes-langchain.agent (from package README)');
        }
      }
    } catch (err) {
      console.log('  ⚠ Could not fetch AI Agent documentation');
    }
    
  } catch (error) {
    console.error('  ⚠ Warning: Could not fetch documentation from GitHub:', (error as Error).message);
    console.log('  ℹ️  Continuing without GitHub documentation...\n');
  }
  
  return docsMap;
}

// Run rebuild
rebuild().catch((error) => {
  console.error('❌ Rebuild failed:', error);
  process.exit(1);
});
