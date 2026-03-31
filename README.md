# Tool Optimizer MCP Server

A Model Context Protocol (MCP) server for managing, optimizing, and iterating MCP tools. Supports tool search, comparison, upgrade, health checking, and more.

[中文](./README_zh.md) | [English](./README.md)

---

## Features

- 🔍 **Tool Search** - Search for better alternative tools in MCP Registry
- ⚖️ **Tool Comparison** - Generate detailed evaluation reports comparing efficiency, reliability, and features
- 🚀 **Smart Upgrade** - Install new tool → Test → Automatically uninstall old tool
- 💾 **Configuration Management** - Auto-manage configurations for OpenCode and other MCP clients
- 📊 **Performance Monitoring** - Track success rates, execution times, and other metrics
- 📝 **Logging System** - Structured logging for debugging and iteration improvements
- 🔒 **Security First** - Package name validation, command injection prevention

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    MCP Client                            │
│  (OpenCode / Claude Desktop / other MCP clients)         │
└─────────────────────┬───────────────────────────────────┘
                      │ stdio
                      ▼
┌─────────────────────────────────────────────────────────┐
│              Tool Optimizer MCP Server                   │
├─────────────────────────────────────────────────────────┤
│  Tools Layer                                             │
│  ├── Health Tools (list, health check)                  │
│  ├── Search Tools (search, find better)                 │
│  ├── Compare Tools (compare, evaluate upgrade)          │
│  ├── Upgrade Tools (install, upgrade, uninstall)        │
│  └── Log Tools (stats, recent, errors)                 │
├─────────────────────────────────────────────────────────┤
│  Services Layer                                         │
│  ├── ConfigService - Configuration management           │
│  ├── RegistryService - MCP Registry API client          │
│  ├── EvaluatorService - Tool evaluation & scoring       │
│  └── LoggerService - Structured logging                │
├─────────────────────────────────────────────────────────┤
│  Utils Layer                                            │
│  ├── PackageValidator - Security validation              │
│  ├── ErrorUtils - Error handling utilities              │
│  └── Constants - Magic numbers centralized              │
└─────────────────────────────────────────────────────────┘
```

## Workflow

```
Startup Check                 Task Checkpoint
     │                             │
     ▼                             ▼
Evaluate Existing Tools ────────┼──▶ Detect Issues
     │                             │
     ▼                             ▼
Suggest Upgrades ──────────────▶ Assess Tool Problems
     │                             │
     ▼                             ▼
Wait for Confirmation ─────────▶ Search for Alternatives
     │                             │
     ▼                             ▼
Install New Tool ──────────────▶ Confirm Recommendation
     │                             │
     ▼                             ▼
Evaluation Report ◀────────────┘
     │
     ▼
Confirm Better → Uninstall Old Tool
```

## Installation

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn

### Build from Source

```bash
# Clone the repository
git clone https://github.com/lh123aa/tool-optimizer.git
cd tool-optimizer-mcp

# Install dependencies
npm install

# Build
npm run build
```

### Global Installation

```bash
npm install -g tool-optimizer-mcp
```

## Configuration

### OpenCode

Add to `~/.config/opencode/opencode.json`:

```json
{
  "mcpServers": {
    "tool-optimizer": {
      "command": "node",
      "args": ["/path/to/tool-optimizer-mcp/dist/index.js"],
      "env": {}
    }
  }
}
```

### Claude Desktop

Add to `~/AppData/Roaming/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "tool-optimizer": {
      "command": "node",
      "args": ["C:/path/to/tool-optimizer-mcp/dist/index.js"]
    }
  }
}
```

## Available Tools

### Health Tools

| Tool | Description |
|------|-------------|
| `tool_list` | List all installed tools |
| `tool_health` | Check health status of a single tool |
| `tool_health_all` | Check health status of all tools |

### Search Tools

| Tool | Description |
|------|-------------|
| `tool_search` | Search MCP Registry |
| `tool_find_better` | Find better alternatives |
| `tool_categories` | List tool categories |
| `tool_popular` | List popular tools |

### Compare Tools

| Tool | Description |
|------|-------------|
| `tool_compare` | Compare two tools |
| `tool_evaluate_upgrade` | Evaluate upgrade recommendation |

### Upgrade Tools

| Tool | Description |
|------|-------------|
| `tool_install` | Install a new tool |
| `tool_upgrade` | Upgrade (install + test + uninstall old) |
| `tool_uninstall` | Uninstall a tool |
| `tool_rollback` | Rollback to previous version |
| `tool_archive_list` | List archived tools |

### Log Tools

| Tool | Description |
|------|-------------|
| `tool_log_stats` | Get log statistics |
| `tool_log_recent` | Get recent logs |
| `tool_log_errors` | Get error logs |
| `tool_log_tool` | Get logs for specific tool |
| `tool_log_search` | Search logs |
| `tool_log_info` | Get logging system info |

## Usage Examples

### Search for Tools

```javascript
// Search MCP Registry
const results = await tool_search({
  query: "browser automation",
  category: "browser",
  limit: 10
});

// Find better alternatives
const alternatives = await tool_find_better({
  toolName: "chrome-devtools",
  limit: 5
});
```

### Compare and Upgrade

```javascript
// Compare tools
const report = await tool_compare({
  toolName: "chrome-devtools",
  candidateName: "microsoft/playwright-mcp"
});

// Evaluate upgrade
const evaluation = await tool_evaluate_upgrade({
  toolName: "chrome-devtools",
  candidateName: "microsoft/playwright-mcp"
});

// Perform upgrade
const result = await tool_upgrade({
  toolName: "chrome-devtools",
  candidateName: "microsoft/playwright-mcp",
  confirm: true
});
```

### Health Check

```javascript
// List all tools
const tools = await tool_list();

// Check specific tool
const health = await tool_health({
  toolName: "chrome-devtools"
});

// Check all tools
const allHealth = await tool_health_all();
```

## Evaluation Report

```json
{
  "id": "eval_xxx-xxx",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "oldTool": {
    "name": "chrome-devtools",
    "version": "1.0.0"
  },
  "newTool": {
    "name": "microsoft/playwright-mcp",
    "stars": 30039,
    "forks": 5231
  },
  "scores": {
    "efficiency": 85,
    "reliability": 78,
    "features": 82,
    "overall": 82
  },
  "recommendation": "upgrade",
  "reason": "Overall score 82/100, recommended to upgrade"
}
```

## Data Storage

Data is stored in `~/.tool-optimizer-mcp/`:

| File | Description |
|------|-------------|
| `tools.json` | Installed tools list |
| `archive.json` | Archived old tools |
| `metrics.json` | Performance metrics |
| `config.json` | System configuration |
| `logs/` | Structured logs |

## Development

```bash
# Install dependencies
npm install

# Development mode (hot reload)
npm run dev

# Build
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint
npm run lint

# Format code
npm run format

# Clean build
npm run clean
```

## Security

- **Package Validation**: All npm package names are validated before installation
- **Command Injection Prevention**: Uses array-form `spawnSync` parameters
- **Input Sanitization**: Zod schema validation for all tool inputs
- **Secure Logging**: Sensitive data is not logged

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## License

MIT

## Contributing

Contributions are welcome! Please read the [AGENTS.md](./AGENTS.md) for development guidelines.
