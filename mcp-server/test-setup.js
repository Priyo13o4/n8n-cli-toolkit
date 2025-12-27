#!/usr/bin/env node

/**
 * Test Setup for n8n Unified MCP Server
 * Verifies all components are working correctly
 */

import { existsSync } from 'fs';
import { resolve, join } from 'path';

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(color, symbol, message) {
  console.log(`${color}${symbol} ${message}${colors.reset}`);
}

async function runTests() {
  console.log(`${colors.blue}🧪 Running n8n Unified MCP Tests${colors.reset}\n`);

  let passed = 0;
  let failed = 0;

  // Test 1: Check n8n-MCP database
  try {
    const dbPath = resolve(process.cwd(), '../n8n-mcp/data/nodes.db');
    if (!existsSync(dbPath)) {
      throw new Error('Database not found');
    }
    
    // Try to use better-sqlite3 from n8n-mcp
    const Database = (await import(resolve(process.cwd(), '../n8n-mcp/node_modules/better-sqlite3/lib/index.js'))).default;
    const db = new Database(dbPath, { readonly: true });
    const result = db.prepare('SELECT COUNT(*) as count FROM nodes').get();
    db.close();
    
    log(colors.green, '✅', `Database accessible: ${result.count} nodes found`);
    passed++;
  } catch (error) {
    log(colors.red, '❌', `Database test failed: ${error.message}`);
    failed++;
  }

  // Test 2: Check .env file
  try {
    const envPath = resolve(process.cwd(), '.env');
    if (!existsSync(envPath)) {
      throw new Error('.env file not found');
    }
    log(colors.green, '✅', 'Environment file exists');
    passed++;
  } catch (error) {
    log(colors.red, '❌', `Environment test failed: ${error.message}`);
    failed++;
  }

  // Test 3: Check dependencies
  try {
    await import('@modelcontextprotocol/sdk/server/index.js');
    log(colors.green, '✅', 'MCP SDK available');
    passed++;
  } catch (error) {
    log(colors.red, '❌', `MCP SDK test failed: ${error.message}`);
    failed++;
  }

  // Test 4: Check environment variables
  try {
    const dotenv = await import('dotenv');
    dotenv.config();
    
    const required = ['N8N_API_URL', 'N8N_API_KEY'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing: ${missing.join(', ')}`);
    }
    
    log(colors.green, '✅', 'Environment variables configured');
    passed++;
  } catch (error) {
    log(colors.red, '❌', `Environment variables test failed: ${error.message}`);
    failed++;
  }

  // Test 5: Check compiled output
  try {
    const indexPath = resolve(process.cwd(), 'dist/index.js');
    if (!existsSync(indexPath)) {
      throw new Error('Compiled output not found - run npm run build');
    }
    log(colors.green, '✅', 'MCP server built successfully');
    passed++;
  } catch (error) {
    log(colors.yellow, '⚠️ ', `Build test: ${error.message}`);
    // Don't count as failed - can rebuild
  }

  // Summary
  console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.green}✅ Passed: ${passed}${colors.reset}`);
  if (failed > 0) {
    console.log(`${colors.red}❌ Failed: ${failed}${colors.reset}`);
  }
  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

  if (failed === 0) {
    log(colors.green, '🎉', 'All tests passed! Ready to use.');
    console.log(`\nNext steps:`);
    console.log(`  ${colors.blue}npm start${colors.reset} - Start MCP server`);
    console.log(`  ${colors.blue}../n8n-helper-enhanced.sh stats${colors.reset} - Test shell script\n`);
  } else {
    log(colors.red, '❌', 'Some tests failed. Check the errors above.');
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});
