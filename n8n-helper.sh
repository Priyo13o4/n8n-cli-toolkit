#!/bin/bash
#
# n8n Management Helper Script
# Provides easy access to n8n API operations and comprehensive node catalog
#
# NOTE: n8n Public API Limitations
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# The n8n Public API does not expose a complete node type catalog endpoint.
# This script works around this limitation by:
#
# 1. Analyzing all workflows to extract node usage patterns
# 2. Deriving parameter schemas from actual node configurations
# 3. Building comprehensive catalogs with:
#    - All node types used across workflows
#    - Version information
#    - Parameter schemas (derived from usage)
#    - Credential requirements
#    - Usage statistics and examples
#
# This approach provides deep insights into YOUR n8n instance's node ecosystem,
# though it won't show nodes that haven't been used in any workflow yet.
# For discovering ALL available n8n nodes, you would need to:
# - Access the n8n UI node palette
# - Use n8n's internal REST API (requires authentication)
# - Browse the official n8n documentation
#

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Load environment variables from .env file
if [ -f "$SCRIPT_DIR/.env" ]; then
    # Export variables from .env file
    set -a
    source "$SCRIPT_DIR/.env"
    set +a
    echo -e "${GREEN}✓ Loaded configuration from .env${NC}" >&2
else
    echo -e "${YELLOW}⚠ Warning: .env file not found at $SCRIPT_DIR/.env${NC}" >&2
    echo -e "${YELLOW}  Copy .env.example to .env and configure your settings${NC}" >&2
    echo "" >&2
fi

# Fallback to environment variables if not set in .env
N8N_API_URL="${N8N_API_URL:-}"
N8N_BASE_URL="${N8N_BASE_URL:-}"
N8N_API_KEY="${N8N_API_KEY:-}"
N8N_SESSION_COOKIE="${N8N_SESSION_COOKIE:-}"

# Validate required configuration
if [ -z "$N8N_API_KEY" ]; then
    echo -e "${RED}❌ Error: N8N_API_KEY not set${NC}" >&2
    echo -e "${YELLOW}Please set it in $SCRIPT_DIR/.env${NC}" >&2
    exit 1
fi

if [ -z "$N8N_API_URL" ] || [ -z "$N8N_BASE_URL" ]; then
    echo -e "${RED}❌ Error: N8N_API_URL and N8N_BASE_URL must be set${NC}" >&2
    echo -e "${YELLOW}Please configure them in $SCRIPT_DIR/.env${NC}" >&2
    echo -e "${YELLOW}Example:${NC}" >&2
    echo -e "${YELLOW}  N8N_API_URL=https://your-n8n-instance.com/api/v1${NC}" >&2
    echo -e "${YELLOW}  N8N_BASE_URL=https://your-n8n-instance.com${NC}" >&2
    exit 1
fi

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# API request helper
api_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    
    if [ -z "$data" ]; then
        curl -s -X "$method" \
            -H "X-N8N-API-KEY: $N8N_API_KEY" \
            -H "Content-Type: application/json" \
            "$N8N_API_URL/$endpoint"
    else
        curl -s -X "$method" \
            -H "X-N8N-API-KEY: $N8N_API_KEY" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$N8N_API_URL/$endpoint"
    fi
}

# List all workflows
list_workflows() {
    echo -e "${BLUE}📋 All Workflows:${NC}"
    api_request GET "workflows" | jq -r '.data[] | "\(.id) | \(.name) | Active: \(.active) | Updated: \(.updatedAt)"' | column -t -s '|'
}

# Get specific workflow
get_workflow() {
    local workflow_id=$1
    if [ -z "$workflow_id" ]; then
        echo -e "${RED}Error: Workflow ID required${NC}"
        echo "Usage: $0 get <workflow_id>"
        return 1
    fi
    
    echo -e "${BLUE}📄 Workflow Details:${NC}"
    api_request GET "workflows/$workflow_id" | jq .
}

# Get workflow by name
get_workflow_by_name() {
    local workflow_name=$1
    if [ -z "$workflow_name" ]; then
        echo -e "${RED}Error: Workflow name required${NC}"
        return 1
    fi
    
    local workflow_id=$(api_request GET "workflows" | jq -r ".data[] | select(.name == \"$workflow_name\") | .id")
    
    if [ -z "$workflow_id" ]; then
        echo -e "${RED}Error: Workflow '$workflow_name' not found${NC}"
        return 1
    fi
    
    get_workflow "$workflow_id"
}

# Download workflow to file (clean JSON without metadata)
download_workflow() {
    local workflow_id=$1
    local output_file=$2
    
    if [ -z "$workflow_id" ]; then
        echo -e "${RED}Error: Workflow ID required${NC}"
        echo "Usage: $0 download <workflow_id> [output_file]"
        return 1
    fi
    
    if [ -z "$output_file" ]; then
        output_file="/tmp/workflow_${workflow_id}.json"
    fi
    
    echo -e "${BLUE}📥 Downloading workflow $workflow_id to $output_file${NC}"
    
    api_request GET "workflows/$workflow_id" | jq '{name, nodes, connections, settings}' > "$output_file"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Downloaded to: $output_file${NC}"
        return 0
    else
        echo -e "${RED}❌ Failed to download workflow${NC}"
        return 1
    fi
}

# Activate/Deactivate workflow
toggle_workflow() {
    local workflow_id=$1
    local active=$2
    
    if [ -z "$workflow_id" ] || [ -z "$active" ]; then
        echo -e "${RED}Error: Workflow ID and active status required${NC}"
        echo "Usage: $0 toggle <workflow_id> <true|false>"
        return 1
    fi
    
    echo -e "${YELLOW}🔄 Setting workflow $workflow_id to active=$active${NC}"
    api_request PATCH "workflows/$workflow_id" "{\"active\": $active}" | jq .
}

# Update workflow
update_workflow() {
    local workflow_id=$1
    local json_file=$2
    
    if [ -z "$workflow_id" ] || [ -z "$json_file" ]; then
        echo -e "${RED}Error: Workflow ID and JSON file required${NC}"
        echo "Usage: $0 update <workflow_id> <json_file>"
        return 1
    fi
    
    if [ ! -f "$json_file" ]; then
        echo -e "${RED}Error: File '$json_file' not found${NC}"
        return 1
    fi
    
    echo -e "${YELLOW}🔄 Updating workflow $workflow_id from $json_file${NC}"
    
    # Extract only the required fields for n8n API
    local clean_data=$(cat "$json_file" | jq '{name, nodes, connections, settings}')
    
    curl -s -X PUT \
        -H "X-N8N-API-KEY: $N8N_API_KEY" \
        -H "Content-Type: application/json" \
        -d "$clean_data" \
        "$N8N_API_URL/workflows/$workflow_id" | jq -r 'if .updatedAt then "✅ Successfully updated workflow at: \(.updatedAt)" else "❌ Error: \(.message)" end'
}

# Execute workflow
execute_workflow() {
    local workflow_id=$1
    
    if [ -z "$workflow_id" ]; then
        echo -e "${RED}Error: Workflow ID required${NC}"
        echo "Usage: $0 execute <workflow_id>"
        return 1
    fi
    
    echo -e "${GREEN}▶️  Executing workflow $workflow_id${NC}"
    api_request POST "workflows/$workflow_id/execute" | jq .
}

# Get workflow executions
get_executions() {
    local workflow_id=$1
    local limit=${2:-10}
    
    if [ -z "$workflow_id" ]; then
        echo -e "${BLUE}📊 Recent Executions (all workflows):${NC}"
        api_request GET "executions?limit=$limit" | jq -r '.data[] | "\(.id) | \(.workflowId) | \(.status) | \(.startedAt) | \(.mode)"' | column -t -s '|'
    else
        echo -e "${BLUE}📊 Recent Executions for workflow $workflow_id:${NC}"
        api_request GET "executions?workflowId=$workflow_id&limit=$limit" | jq -r '.data[] | "\(.id) | \(.status) | \(.startedAt) | \(.mode)"' | column -t -s '|'
    fi
}

# Get execution details
get_execution() {
    local execution_id=$1
    
    if [ -z "$execution_id" ]; then
        echo -e "${RED}Error: Execution ID required${NC}"
        echo "Usage: $0 execution <execution_id>"
        return 1
    fi
    
    echo -e "${BLUE}📄 Execution Details:${NC}"
    api_request GET "executions/$execution_id" | jq .
}

# List all available node types from n8n's node catalog
list_node_types() {
    echo -e "${BLUE}🔌 Available n8n Node Types${NC}"
    echo ""
    
    local temp_file="/tmp/node_types.json"
    local use_session_api=false
    
    # Try the /types/nodes.json endpoint first if session cookie is set
    if [ ! -z "$N8N_SESSION_COOKIE" ]; then
        echo -e "${YELLOW}Attempting to fetch complete node catalog from /types/nodes.json...${NC}"
        curl -s -H "Cookie: $N8N_SESSION_COOKIE" "$N8N_BASE_URL/types/nodes.json" > "$temp_file"
        
        # Check if successful
        if [ -s "$temp_file" ] && ! grep -q '"status":"error"' "$temp_file"; then
            use_session_api=true
            echo -e "${GREEN}✅ Successfully fetched complete node catalog!${NC}"
            echo ""
            
            # Display node types from the complete catalog
            cat "$temp_file" | jq -r '
                to_entries | 
                map({
                    name: .key,
                    displayName: .value.displayName,
                    version: .value.version,
                    description: .value.description,
                    group: (.value.codex.categories // [] | join(", "))
                }) |
                sort_by(.name) |
                .[] |
                "\(.name) | \(.displayName) | v\(.version) | \(.group)"
            ' | column -t -s '|' | head -50
            
            echo ""
            echo -e "${GREEN}💡 Total available node types: $(cat "$temp_file" | jq 'keys | length')${NC}"
            echo -e "${YELLOW}(Showing first 50, use 'export-all-nodes' to get complete catalog)${NC}"
        else
            echo -e "${YELLOW}Session authentication failed or not configured.${NC}"
            echo -e "${YELLOW}Falling back to workflow-based analysis...${NC}"
            echo ""
        fi
    fi
    
    # Fallback: Extract from workflows
    if [ "$use_session_api" = false ]; then
        echo -e "${YELLOW}Note: Set N8N_SESSION_COOKIE in the script to access complete node catalog.${NC}"
        echo -e "${YELLOW}Currently showing nodes used in your workflows...${NC}"
        echo ""
        
        api_request GET "workflows" > "$temp_file"
        
        cat "$temp_file" | jq -r '
            [.data[].nodes[]? | {
                type: .type,
                typeVersion: .typeVersion,
                name: .name,
                position: .position,
                parameters: .parameters,
                credentials: .credentials
            }] | 
            group_by(.type) | 
            map({
                nodeType: .[0].type,
                versions: (map(.typeVersion) | unique | sort),
                latestVersion: (map(.typeVersion) | max),
                usageCount: length,
                examples: (map(.name) | unique | .[0:3]),
                hasCredentials: (map(.credentials != null and .credentials != {}) | any),
                commonParameters: (map(.parameters | keys) | add | unique | sort)
            }) | 
            sort_by(.usageCount) | 
            reverse | 
            .[] | 
            "\(.nodeType) | v\(.versions | join(", v")) | Used: \(.usageCount)x | Creds: \(if .hasCredentials then "Yes" else "No" end) | Params: \(.commonParameters | length)"
        ' | column -t -s '|'
        
        echo ""
        echo -e "${GREEN}💡 Total unique node types found: $(cat "$temp_file" | jq '[.data[].nodes[]?.type] | unique | length')${NC}"
        echo -e "${BLUE}💡 Use 'export-nodes' to get complete details including parameters${NC}"
    fi
    
    rm -f "$temp_file"
}

# Get detailed node type information from n8n catalog
get_node_info() {
    local node_type=$1
    
    if [ -z "$node_type" ]; then
        echo -e "${RED}Error: Node type required${NC}"
        echo "Usage: $0 nodeinfo <node_type>"
        echo "Example: $0 nodeinfo n8n-nodes-base.postgres"
        return 1
    fi
    
    echo -e "${BLUE}🔍 Node Type Details: $node_type${NC}"
    echo ""
    
    local temp_file="/tmp/node_info.json"
    
    # Get all workflows and extract examples of this node type
    api_request GET "workflows" > "$temp_file"
    
    echo -e "${YELLOW}Analyzing node usage and configuration...${NC}"
    echo ""
    
    cat "$temp_file" | jq -r --arg type "$node_type" '
        .data[] | 
        select(.nodes[]?.type == $type) | 
        {
            workflowId: .id,
            workflowName: .name,
            nodes: [.nodes[] | select(.type == $type) | {
                name: .name,
                typeVersion: .typeVersion,
                parameters: .parameters,
                credentials: .credentials,
                position: .position
            }]
        }
    ' | jq -s --arg type "$node_type" '
        if length == 0 then
            "❌ Node type not found in any workflows"
        else
            # Aggregate information
            {
                nodeType: $type,
                totalUsage: (map(.nodes | length) | add),
                workflowCount: length,
                versions: (map(.nodes[].typeVersion) | unique | sort),
                allParameters: (map(.nodes[].parameters | keys) | add | unique | sort),
                requiresCredentials: (map(.nodes[].credentials != null and .nodes[].credentials != {}) | any),
                workflows: map({
                    name: .workflowName,
                    id: .workflowId,
                    instances: (.nodes | map({
                        name: .name,
                        version: .typeVersion,
                        parameterKeys: (.parameters | keys),
                        credentialKeys: (.credentials // {} | keys)
                    }))
                })
            } |
            "
📦 Node Type: \(.nodeType)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Usage Statistics:
   • Total instances: \(.totalUsage)
   • Used in \(.workflowCount) workflow(s)
   • Versions: v\(.versions | join(", v"))
   • Requires credentials: \(if .requiresCredentials then "Yes" else "No" end)

🔧 Available Parameters (\(.allParameters | length)):
\(.allParameters | map("   • " + .) | join("\n"))

📋 Workflow Examples:
\(.workflows | map("
   Workflow: \(.name) (ID: \(.id))
   Instances: \(.instances | length)
\(.instances | map("      - \(.name) (v\(.version))
        Parameters: \(.parameterKeys | join(", "))
        Credentials: \(if .credentialKeys | length > 0 then (.credentialKeys | join(", ")) else "None" end)") | join("\n"))
") | join("\n"))
"
        end
    ' -r
    
    rm -f "$temp_file"
}

# Export all node types with complete configurations to a file
export_node_catalog() {
    local output_file=${1:-"n8n_node_catalog.json"}
    
    echo -e "${BLUE}📦 Exporting comprehensive node catalog to $output_file${NC}"
    echo ""
    echo -e "${YELLOW}Note: Extracting from workflows (n8n Public API doesn't expose full node catalog)${NC}"
    echo ""
    
    local temp_workflows="/tmp/workflows.json"
    
    echo -e "${YELLOW}Step 1/2: Fetching all workflows...${NC}"
    api_request GET "workflows" > "$temp_workflows"
    
    echo -e "${YELLOW}Step 2/2: Analyzing nodes and generating catalog...${NC}"
    
    cat "$temp_workflows" | jq --arg timestamp "$(date '+%Y-%m-%d %H:%M:%S')" '
        {
            exportedAt: $timestamp,
            source: "n8n workflows analysis",
            totalWorkflows: (.data | length),
            
            # Comprehensive node catalog
            nodeTypes: (
                [.data[].nodes[]? | {
                    type: .type,
                    typeVersion: .typeVersion,
                    parameters: .parameters,
                    credentials: .credentials,
                    nodeName: .name
                }] |
                group_by(.type) |
                map({
                    nodeType: .[0].type,
                    
                    # Version information
                    versions: (map(.typeVersion) | unique | sort),
                    latestVersion: (map(.typeVersion) | max),
                    
                    # Usage statistics
                    usageCount: length,
                    
                    # Parameter analysis
                    allParameters: (map(.parameters | keys) | add | unique | sort),
                    parameterCount: (map(.parameters | keys) | add | unique | length),
                    
                    # Credential information
                    requiresCredentials: (map(.credentials != null and .credentials != {}) | any),
                    credentialTypes: (map(.credentials // {} | keys) | add | unique | sort),
                    
                    # Example configurations (up to 5 different configs)
                    exampleConfigurations: (
                        map({
                            version: .typeVersion,
                            nodeName: .nodeName,
                            parameters: .parameters,
                            credentials: (.credentials // {})
                        }) |
                        unique_by(.parameters) |
                        .[0:5]
                    ),
                    
                    # Parameter schema (derived from examples)
                    parameterSchema: (
                        [map(.parameters | to_entries[]) | group_by(.key) | .[] |
                        {
                            key: .[0].key,
                            valueType: ([.[].value | type] | unique),
                            exampleValues: ([.[].value] | unique | .[0:3]),
                            frequency: length
                        }] |
                        sort_by(.key)
                    )
                }) |
                sort_by(.usageCount) | reverse
            ),
            
            # Category analysis (by node prefix)
            categories: (
                [.data[].nodes[]?.type] |
                unique |
                map(split(".")[0]) |
                group_by(.) |
                map({
                    category: .[0],
                    count: length
                }) |
                sort_by(.count) | reverse
            ),
            
            # Statistics
            statistics: {
                totalUniqueNodeTypes: ([.data[].nodes[]?.type] | unique | length),
                totalNodeInstances: ([.data[].nodes[]?] | length),
                averageNodesPerWorkflow: (([.data[].nodes | length] | add) / (.data | length)),
                nodesWithCredentials: ([.data[].nodes[]? | select(.credentials != null and .credentials != {})] | unique_by(.type) | length)
            }
        }
    ' > "$output_file"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Exported to: $output_file${NC}"
        echo ""
        echo -e "${YELLOW}Catalog Summary:${NC}"
        cat "$output_file" | jq -r '
            "
📊 N8N Node Catalog
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Exported: \(.exportedAt)
Source: \(.source)

📈 Statistics:
   • Total Workflows Analyzed: \(.totalWorkflows)
   • Unique Node Types: \(.statistics.totalUniqueNodeTypes)
   • Total Node Instances: \(.statistics.totalNodeInstances)
   • Avg Nodes per Workflow: \(.statistics.averageNodesPerWorkflow | floor)
   • Nodes with Credentials: \(.statistics.nodesWithCredentials)

📁 Top Categories:
\(.categories[0:5] | map("   • \(.category): \(.count) types") | join("\n"))

🔥 Most Used Nodes:
\(.nodeTypes[0:10] | map("   • \(.nodeType) - Used \(.usageCount)x (v\(.latestVersion)) - \(.parameterCount) params") | join("\n"))

💾 File: \(. | tojson | length) bytes
"
        '
        
        echo ""
        echo -e "${BLUE}Explore the catalog with jq:${NC}"
        echo "  # Find specific node"
        echo "  jq '.nodeTypes[] | select(.nodeType | contains(\"postgres\"))' $output_file"
        echo ""
        echo "  # See parameter schema for a node"
        echo "  jq '.nodeTypes[] | select(.nodeType == \"n8n-nodes-base.postgres\") | .parameterSchema' $output_file"
        echo ""
        echo "  # List all nodes by category"
        echo "  jq '.categories' $output_file"
        
        rm -f "$temp_workflows"
        return 0
    else
        echo -e "${RED}❌ Failed to export node catalog${NC}"
        rm -f "$temp_workflows"
        return 1
    fi
}

# Search nodes by keyword or category
search_nodes() {
    local search_term=$1
    
    if [ -z "$search_term" ]; then
        echo -e "${RED}Error: Search term required${NC}"
        echo "Usage: $0 search <keyword>"
        echo "Example: $0 search database"
        echo "Example: $0 search postgres"
        return 1
    fi
    
    echo -e "${BLUE}🔍 Searching nodes for: '$search_term'${NC}"
    echo ""
    
    local temp_file="/tmp/search_nodes.json"
    
    echo -e "${YELLOW}Searching through workflows...${NC}"
    api_request GET "workflows" > "$temp_file"
    
    cat "$temp_file" | jq -r --arg term "$search_term" '
        [.data[].nodes[]? | {
            type: .type,
            typeVersion: .typeVersion,
            parameters: .parameters,
            credentials: .credentials
        }] |
        group_by(.type) |
        map({
            nodeType: .[0].type,
            versions: (map(.typeVersion) | unique | sort),
            usageCount: length,
            parameters: (map(.parameters | keys) | add | unique | sort),
            requiresCredentials: (map(.credentials != null and .credentials != {}) | any)
        }) |
        map(select(.nodeType | ascii_downcase | contains($term | ascii_downcase))) |
        if length == 0 then
            "No nodes found matching the search term"
        else
            "Found " + (length | tostring) + " node type(s):\n" +
            (map("
📦 " + .nodeType + "
   Versions: v" + (.versions | map(tostring) | join(", v")) + "
   Used: " + (.usageCount | tostring) + " times
   Parameters (" + (.parameters | length | tostring) + "): " + (.parameters | join(", "))  + "
   Requires Credentials: " + (if .requiresCredentials then "Yes" else "No" end) + "
") | join("\n"))
        end
    ' -r
    
    rm -f "$temp_file"
}

# List all categories
list_categories() {
    echo -e "${BLUE}📁 Node Categories (by prefix)${NC}"
    echo ""
    
    local temp_file="/tmp/categories.json"
    
    echo -e "${YELLOW}Analyzing node types from workflows...${NC}"
    api_request GET "workflows" > "$temp_file"
    
    cat "$temp_file" | jq -r '
        [.data[].nodes[]?.type] |
        unique |
        map(split(".")[0]) |
        group_by(.) |
        map({
            category: .[0],
            count: length
        }) |
        sort_by(.count) | reverse |
        map("
📁 " + .category + "
   Node Types: " + (.count | tostring))
        | join("\n")
    ' -r
    
    echo ""
    echo -e "${YELLOW}To see nodes in a specific category:${NC}"
    echo "  $0 search <category_name>"
    
    rm -f "$temp_file"
}

# Export ALL available node types from n8n (requires session auth)
export_all_nodes() {
    local output_file=${1:-"n8n_all_nodes_catalog.json"}
    
    if [ -z "$N8N_SESSION_COOKIE" ]; then
        echo -e "${RED}❌ Error: N8N_SESSION_COOKIE not set${NC}"
        echo ""
        echo -e "${YELLOW}To export the complete n8n node catalog:${NC}"
        echo "1. Open n8n in your browser and log in"
        echo "2. Open DevTools (F12) > Application/Storage > Cookies"
        echo "3. Find the n8n session cookie (usually 'n8n-auth')"
        echo "4. Copy the full cookie string"
        echo "5. Set it in this script:"
        echo "   N8N_SESSION_COOKIE=\"n8n-auth=your-session-token\""
        echo ""
        echo -e "${BLUE}Alternatively, use 'export-nodes' to export workflow-based catalog${NC}"
        return 1
    fi
    
    echo -e "${BLUE}📦 Exporting complete n8n node catalog to $output_file${NC}"
    echo ""
    
    local temp_all_nodes="/tmp/all_nodes_complete.json"
    local temp_workflows="/tmp/workflows.json"
    
    echo -e "${YELLOW}Step 1/3: Fetching complete node type definitions from n8n...${NC}"
    curl -s -H "Cookie: $N8N_SESSION_COOKIE" "$N8N_BASE_URL/types/nodes.json" > "$temp_all_nodes"
    
    # Check if successful
    if [ ! -s "$temp_all_nodes" ] || grep -q '"status":"error"' "$temp_all_nodes"; then
        echo -e "${RED}❌ Failed to fetch node catalog. Session cookie may be invalid.${NC}"
        rm -f "$temp_all_nodes"
        return 1
    fi
    
    echo -e "${GREEN}✅ Fetched $(jq 'keys | length' "$temp_all_nodes") node types${NC}"
    
    echo -e "${YELLOW}Step 2/3: Fetching workflow usage data...${NC}"
    api_request GET "workflows" > "$temp_workflows"
    
    echo -e "${YELLOW}Step 3/3: Combining data and generating catalog...${NC}"
    
    # Combine complete node catalog with workflow usage
    jq -s --arg timestamp "$(date '+%Y-%m-%d %H:%M:%S')" '
        {
            exportedAt: $timestamp,
            source: "n8n complete node catalog + workflow usage",
            totalAvailableNodes: (.[0] | keys | length),
            totalWorkflows: (.[1].data | length),
            
            # All available nodes with complete definitions
            allNodes: (
                .[0] | to_entries | map({
                    name: .key,
                    displayName: .value.displayName,
                    description: .value.description,
                    version: .value.version,
                    defaults: .value.defaults,
                    inputs: .value.inputs,
                    outputs: .value.outputs,
                    properties: .value.properties,
                    credentials: .value.credentials,
                    webhooks: .value.webhooks,
                    polling: .value.polling,
                    group: .value.group,
                    subtitle: .value.subtitle,
                    categories: (.value.codex.categories // []),
                    subcategories: (.value.codex.subcategories // {}),
                    resources: (.value.codex.resources // {})
                }) | sort_by(.name)
            ),
            
            # Usage statistics from workflows
            usageStats: (
                [.[1].data[].nodes[]? | {
                    type: .type,
                    typeVersion: .typeVersion,
                    parameters: .parameters,
                    credentials: .credentials
                }] |
                group_by(.type) |
                map({
                    nodeType: .[0].type,
                    usageCount: length,
                    versions: (map(.typeVersion) | unique | sort),
                    commonParameters: (map(.parameters | keys) | add | unique | sort),
                    requiresCredentials: (map(.credentials != null and .credentials != {}) | any),
                    exampleConfigurations: (
                        map({
                            version: .typeVersion,
                            parameters: .parameters,
                            credentials: .credentials
                        }) | unique | .[0:5]
                    )
                }) | sort_by(.usageCount) | reverse
            ),
            
            # Categories breakdown
            categories: (
                .[0] | to_entries | 
                map(.value.codex.categories // ["Uncategorized"] | .[]) |
                group_by(.) |
                map({
                    category: .[0],
                    count: length
                }) |
                sort_by(.count) | reverse
            ),
            
            # Statistics
            statistics: {
                totalAvailableNodes: (.[0] | keys | length),
                totalUsedNodes: ([.[1].data[].nodes[]?.type] | unique | length),
                totalWorkflows: (.[1].data | length),
                totalNodeInstances: ([.[1].data[].nodes[]?] | length),
                unusedNodesCount: ((.[0] | keys | length) as $total | ([.[1].data[].nodes[]?.type] | unique | length) as $used | ($total - $used)),
                categoriesCount: (.[0] | [to_entries[].value.codex.categories // ["Uncategorized"] | .[]] | unique | length)
            }
        }
    ' "$temp_all_nodes" "$temp_workflows" > "$output_file"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Exported to: $output_file${NC}"
        echo ""
        echo -e "${YELLOW}Complete Catalog Summary:${NC}"
        cat "$output_file" | jq -r '
            "
📊 Complete N8N Node Catalog
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Exported: \(.exportedAt)
Source: \(.source)

📈 Statistics:
   • Total Available Nodes: \(.statistics.totalAvailableNodes)
   • Nodes Used in Workflows: \(.statistics.totalUsedNodes)
   • Unused Nodes: \(.statistics.unusedNodesCount)
   • Total Workflows: \(.statistics.totalWorkflows)
   • Total Node Instances: \(.statistics.totalNodeInstances)
   • Categories: \(.statistics.categoriesCount)

📁 Top Categories:
\(.categories[0:5] | map("   • \(.category): \(.count) nodes") | join("\n"))

🔥 Most Used Nodes:
\(.usageStats[0:10] | map("   • \(.nodeType) - Used \(.usageCount)x") | join("\n"))

💾 File: \(. | tojson | length) bytes
"
        '
        
        echo ""
        echo -e "${BLUE}Explore with jq:${NC}"
        echo "  # Find unused nodes"
        echo "  jq '.allNodes[] | select(.name as \$n | [\$WORKFLOW.usageStats[].nodeType] | contains([\$n]) | not)' $output_file"
        echo ""
        echo "  # Get complete definition for a node"
        echo "  jq '.allNodes[] | select(.name == \"n8n-nodes-base.postgres\")' $output_file"
        echo ""
        echo "  # List nodes by category"
        echo "  jq '.allNodes[] | select(.categories | contains([\"Database\"]))' $output_file"
        
        rm -f "$temp_all_nodes" "$temp_workflows"
        return 0
    else
        echo -e "${RED}❌ Failed to export catalog${NC}"
        rm -f "$temp_all_nodes" "$temp_workflows"
        return 1
    fi
}

# Show help
show_help() {
    echo -e "${GREEN}n8n Management Helper${NC}"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  ${BLUE}Workflow Management:${NC}"
    echo "  list                          - List all workflows"
    echo "  get <workflow_id>             - Get workflow by ID"
    echo "  getname <workflow_name>       - Get workflow by name"
    echo "  download <workflow_id> [file] - Download workflow to file (clean JSON)"
    echo "  toggle <workflow_id> <bool>   - Activate/deactivate workflow"
    echo "  update <workflow_id> <file>   - Update workflow from JSON file"
    echo "  execute <workflow_id>         - Execute workflow manually"
    echo "  executions [workflow_id] [n]  - List recent executions"
    echo "  execution <execution_id>      - Get execution details"
    echo ""
    echo "  ${BLUE}Node Type Discovery & Analysis:${NC}"
    echo "  nodes                         - List node types (all if session auth, else from workflows)"
    echo "  nodeinfo <node_type>          - Get detailed usage & parameter info for a node"
    echo "  search <keyword>              - Search nodes by name or category"
    echo "  categories                    - List all node categories (by prefix)"
    echo "  export-nodes [file]           - Export workflow-based catalog with schemas"
    echo "  export-all-nodes [file]       - Export COMPLETE n8n node catalog (requires session)"
    echo "                                  Includes ALL available nodes with full definitions"
    echo ""
    echo "  ${YELLOW}Session Auth Setup (for complete catalog):${NC}"
    echo "  1. Login to n8n in browser"
    echo "  2. DevTools > Application > Cookies > copy n8n-auth value"
    echo "  3. Set N8N_SESSION_COOKIE in .env file"
    echo ""
    echo "Examples:"
    echo "  $0 list"
    echo "  $0 get <workflow_id>"
    echo "  $0 getname 'My Workflow'"
    echo "  $0 download <workflow_id> workflow.json"
    echo "  $0 toggle <workflow_id> true"
    echo "  $0 update <workflow_id> workflow.json"
    echo "  $0 execute <workflow_id>"
    echo "  $0 executions <workflow_id> 20"
    echo "  $0 nodes"
    echo "  $0 search postgres"
    echo "  $0 categories"
    echo "  $0 nodeinfo n8n-nodes-base.postgres"
    echo "  $0 export-nodes node_catalog.json"
    echo "  $0 export-all-nodes complete_catalog.json"
}

# Main
case "${1:-help}" in
    list)
        list_workflows
        ;;
    get)
        get_workflow "$2"
        ;;
    getname)
        get_workflow_by_name "$2"
        ;;
    download)
        download_workflow "$2" "$3"
        ;;
    toggle)
        toggle_workflow "$2" "$3"
        ;;
    update)
        update_workflow "$2" "$3"
        ;;
    execute)
        execute_workflow "$2"
        ;;
    executions)
        get_executions "$2" "$3"
        ;;
    execution)
        get_execution "$2"
        ;;
    nodes)
        list_node_types
        ;;
    nodeinfo)
        get_node_info "$2"
        ;;
    search)
        search_nodes "$2"
        ;;
    categories)
        list_categories
        ;;
    export-nodes)
        export_node_catalog "$2"
        ;;
    export-all-nodes)
        export_all_nodes "$2"
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac
