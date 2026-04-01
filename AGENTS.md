# AGENTS.md - Tool Optimizer MCP

## Project Overview

**tool-optimizer-mcp** is an MCP (Model Context Protocol) server for managing, optimizing, and iterating MCP tools. It supports tool search, comparison, upgrade, health checking, and diagnostics.

- **Location**: `tool-optimizer-mcp/`
- **Language**: TypeScript (ESM)
- **Runtime**: Node.js >= 18.0.0
- **Test Framework**: Vitest

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

# Lint (ESLint + Prettier)
npm run lint

# Auto-fix lint issues
npm run lint:fix

# Format code (Prettier)
npm run format

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run a single test file
npx vitest run tests/services/config.test.ts

# Run tests matching a pattern
npx vitest run --grep "getAllTools"
```

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
- **Group imports**: External packages first, then internal modules:
  ```typescript
  import axios from "axios";
  import type { ToolCandidate } from "../types/index.js";
  ```
- **Use `import type`** for type-only imports (enforced by ESLint)

### Naming Conventions
| Element | Convention | Example |
|---------|------------|---------|
| Interfaces | PascalCase | `InstalledTool`, `ToolCandidate` |
| Types | PascalCase | `SearchFilter`, `EvaluationReport` |
| Classes | PascalCase | `RegistryService`, `EvaluatorService` |
| Private methods | camelCase | `loadTools()`, `saveArchive()` |
| Variables | camelCase | `currentTool`, `candidateName` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRIES`, `API_TIMEOUT_MS` |

### TypeScript Rules
- **Use `interface`** for object shapes (enforced by ESLint)
- **Use `import type`** for type-only imports (enforced by ESLint)
- **Use `z.object()`** for MCP tool input schemas (Zod validation)
- **Use `unknown`** instead of `any` when type is uncertain
- **No `any`**: ESLint warns on `any` type
- **No non-null assertion**: ESLint warns on `!` operator

### ESLint Rules (.eslintrc.js)
- `@typescript-eslint/consistent-type-imports`: Error - prefer `import type`
- `@typescript-eslint/consistent-type-definitions`: Error - use `interface`
- `@typescript-eslint/no-unused-vars`: Warn (ignore `_` prefix)
- `@typescript-eslint/no-explicit-any`: Warn
- `@typescript-eslint/no-non-null-assertion`: Warn
- `no-console`: Warn (allow `warn`, `error`)

### Prettier Formatting (.prettierrc)
- **Semi**: `true`
- **Single quote**: `true`
- **Tab width**: `2`
- **Trailing comma**: `es5`
- **Print width**: `100`
- **Bracket spacing**: `true`
- **Arrow parens**: `always`
- **End of line**: `lf`

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

### Class Patterns (Singleton Export)
```typescript
export class RegistryService {
  private cache: Map<string, Data> = new Map();
  private readonly CACHE_TTL: number;

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
export const registryService = new RegistryService();
```

### Logger Service Pattern
Use the logger service instead of `console.log`:
```typescript
import { loggerService, LogCategory } from "./services/logger.js";

// Info log
loggerService.info(LogCategory.SEARCH, `Search completed`, {
  context: { query, resultCount },
  duration: Date.now() - startTime,
  success: true,
});

// Error log
loggerService.error(LogCategory.SEARCH, `Search failed`, {
  error: error as Error,
  duration: Date.now() - startTime,
  success: false,
});
```

### MCP Tool Registration
```typescript
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerSearchTools(server: McpServer): void {
  server.registerTool(
    "tool_search",
    {
      description: "Search MCP tools in registry",
      inputSchema: z.object({
        query: z.string().describe("Search query"),
        limit: z.number().optional().default(10).describe("Result limit"),
      }),
    },
    async ({ query, limit = 10 }) => {
      try {
        const result = await doSearch(query, limit);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              error: "search_failed",
              message: error instanceof Error ? error.message : String(error),
            }),
          }],
        };
      }
    }
  );
}
```

---

## Project Structure

```
tool-optimizer-mcp/
├── src/
│   ├── index.ts              # Main entry, MCP server setup
│   ├── types/
│   │   └── index.ts         # All TypeScript interfaces and types
│   ├── tools/
│   │   ├── health.ts        # Health check tools (tool_list, tool_health)
│   │   ├── search.ts        # Search tools (tool_search, tool_find_better)
│   │   ├── compare.ts       # Comparison tools (tool_compare)
│   │   ├── upgrade.ts       # Upgrade/install tools (tool_install, tool_upgrade)
│   │   ├── diagnose.ts      # Diagnostic tools (tool_diagnose, tool_diagnose_auto)
│   │   └── logs.ts          # Log query tools
│   ├── services/
│   │   ├── registry.ts      # MCP Registry API client (GitHub fallback)
│   │   ├── evaluator.ts     # Tool evaluation logic
│   │   ├── config.ts        # Config file management
│   │   └── logger.ts        # Structured logging service
│   └── utils/
│       ├── constants.ts      # Application constants
│       ├── error-utils.ts    # Error handling utilities
│       └── package-validator.ts
├── tests/                   # Vitest test files
│   ├── services/
│   └── utils/
├── vitest.config.ts         # Vitest configuration
├── tsconfig.json
├── .eslintrc.js
├── .prettierrc
└── package.json
```

---

## Dependencies

- `@modelcontextprotocol/sdk` - MCP server SDK
- `axios` - HTTP client for registry API
- `zod` - Schema validation for tool inputs

---

## Test Conventions

```typescript
import { describe, it, expect } from "vitest";
import { configService } from "../../src/services/config.js";

describe("ConfigService", () => {
  describe("getAllTools", () => {
    it("should return an array", () => {
      const result = configService.getAllTools();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
```

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
