# AGENTS.md - Tool Optimizer MCP

## Project Overview

**tool-optimizer-mcp** is an MCP (Model Context Protocol) server for managing, optimizing, and iterating MCP tools. It supports tool search, comparison, upgrade, and health checking.

- **Location**: `tool-optimizer-mcp/`
- **Language**: TypeScript (ESM)
- **Runtime**: Node.js >= 18.0.0

---

## Build / Lint / Test Commands

```bash
# Install dependencies
npm install

# Build TypeScript to ./dist
npm run build

# Development with hot reload
npm run dev

# Run production server
npm start

# Clean build artifacts
npm run clean
```

**Note**: No ESLint, Prettier, or Jest configured. TypeScript's strict mode is enabled.

---

## Code Style Guidelines

### TypeScript Configuration
- **Strict mode**: Enabled in `tsconfig.json`
- **Module system**: ESM (`"type": "module"`)
- **Target**: ES2022
- **Module resolution**: NodeNext

### Imports
- **Always use `.js` extension** in imports (required for ESM):
  ```typescript
  import { registryService } from "./services/registry.js";
  ```
- **Group imports**: External packages first, then internal modules
  ```typescript
  import axios from "axios";
  import type { ToolCandidate } from "../types/index.js";
  ```

### Naming Conventions
| Element | Convention | Example |
|---------|------------|---------|
| Interfaces | PascalCase | `InstalledTool`, `ToolCandidate` |
| Types | PascalCase | `SearchFilter`, `EvaluationReport` |
| Classes | PascalCase | `RegistryService`, `EvaluatorService` |
| Private methods | camelCase | `loadTools()`, `saveArchive()` |
| Variables | camelCase | `currentTool`, `candidateName` |
| Constants | camelCase | `REGISTRY_API_BASE`, `CACHE_TTL` |

### TypeScript Rules
- **Strict mode enabled**: No implicit any, strict null checks
- **Use `interface`** for object shapes, `type` for unions/primitives
- **Use `z.object()`** for MCP tool input schemas (Zod validation)
- **Use `unknown`** instead of `any` when type is uncertain
- **Use `import type`** for type-only imports

### Error Handling
```typescript
try {
  // operation
} catch (error) {
  // Always check error type
  const message = error instanceof Error ? error.message : String(error);
  // Handle appropriately
}
```

### JSON Serialization
- Use **2-space indentation**:
  ```typescript
  JSON.stringify(data, null, 2)
  ```

### Class Patterns
```typescript
export class ServiceClass {
  private cache: Map<string, Data> = new Map();
  private readonly CONSTANT = 1000;

  constructor() {
    // initialization
  }

  public async method(): Promise<Result> {
    // public method
  }

  private helper(): void {
    // private method
  }
}

// Singleton export
export const serviceInstance = new ServiceClass();
```

### MCP Tool Registration
```typescript
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerTools(server: McpServer): void {
  server.registerTool(
    "tool_name",
    {
      description: "Tool description",
      inputSchema: z.object({
        param: z.string().describe("Description"),
      }),
    },
    async ({ param }) => {
      try {
        // implementation
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ error: "message", message: error instanceof Error ? error.message : String(error) })
          }]
        };
      }
    }
  );
}
```

---

## Project Structure

```
src/
├── index.ts           # Main entry, MCP server setup
├── types/
│   └── index.ts       # All TypeScript interfaces and types
├── tools/
│   ├── health.ts      # Health check tools
│   ├── search.ts      # Search tools
│   ├── compare.ts     # Comparison tools
│   └── upgrade.ts     # Upgrade/install tools
└── services/
    ├── registry.ts    # MCP Registry API client
    ├── evaluator.ts    # Tool evaluation logic
    └── config.ts       # Config file management
```

---

## Dependencies

- `@modelcontextprotocol/sdk` - MCP server SDK
- `axios` - HTTP client for registry API
- `zod` - Schema validation for tool inputs

---

## Comments

- Use **Chinese comments** for business logic (as per project convention)
- Use **JSDoc** for public API documentation:
  ```typescript
  /**
   * Description of function
   * @param paramName - Description
   * @returns Description
   */
  ```
