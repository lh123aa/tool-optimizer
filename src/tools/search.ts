/**
 * 工具搜索 MCP 工具
 * 在 MCP Registry 中搜索更好的替代工具
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { registryService } from "../services/registry.js";
import { configService } from "../services/config.js";
import { loggerService, LogCategory } from "../services/logger.js";

export function registerSearchTools(server: McpServer): void {
  /**
   * tool_search - 搜索 MCP 工具
   */
  server.registerTool(
    "tool_search",
    {
      description: "在 MCP Registry 中搜索工具",
      inputSchema: z.object({
        query: z.string().describe("搜索关键词 (如 'browser', 'filesystem', 'git')"),
        category: z.string().optional().describe("工具分类 (可选)"),
        limit: z.number().optional().default(10).describe("返回结果数量限制 (默认 10)"),
      }),
    },
    async ({ query, category, limit = 10 }) => {
      const startTime = Date.now();
      loggerService.info(LogCategory.SEARCH, `搜索工具: ${query}`, {
        context: { query, category, limit },
      });

      try {
        const candidates = await registryService.search(
          {
            query,
            category,
            sortBy: "stars",
          },
          limit
        );

        loggerService.info(LogCategory.SEARCH, `搜索完成: ${query}`, {
          context: { resultCount: candidates.length },
          duration: Date.now() - startTime,
          success: true,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  query,
                  count: candidates.length,
                  results: candidates.map((c) => ({
                    name: c.name,
                    description: c.description,
                    stars: c.stars,
                    forks: c.forks,
                    language: c.language,
                    categories: c.categories,
                    tools: c.tools,
                    repository: c.repository,
                    npmPackage: c.npmPackage,
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        loggerService.error(LogCategory.SEARCH, `搜索失败: ${query}`, {
          error: error as Error,
          context: { query, category },
          duration: Date.now() - startTime,
          success: false,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "搜索失败",
                message: error instanceof Error ? error.message : String(error),
              }),
            },
          ],
        };
      }
    }
  );

  /**
   * tool_find_better - 查找当前工具的更好替代
   */
  server.registerTool(
    "tool_find_better",
    {
      description: "查找当前已安装工具的更好替代选项",
      inputSchema: z.object({
        toolName: z.string().describe("当前工具名称"),
        limit: z.number().optional().default(5).describe("返回结果数量限制 (默认 5)"),
      }),
    },
    async ({ toolName, limit = 5 }) => {
      const startTime = Date.now();
      loggerService.info(LogCategory.SEARCH, `查找更好替代工具: ${toolName}`, { toolName });

      try {
        const currentTool = configService.getTool(toolName);

        // 从工具名提取关键词
        const keywords = toolName
          .toLowerCase()
          .replace(/[-_]/g, " ")
          .split(" ")
          .filter((w: string) => w.length > 2);

        // 搜索替代工具
        const candidates = await registryService.search(
          { query: keywords.join(" "), sortBy: "stars" },
          limit + 1 // 多取一个排除自己
        );

        // 排除当前工具
        const betterCandidates = candidates
          .filter((c) => c.name.toLowerCase() !== toolName.toLowerCase())
          .slice(0, limit);

        loggerService.info(LogCategory.SEARCH, `查找完成: ${toolName}`, {
          toolName,
          context: { alternativesCount: betterCandidates.length },
          duration: Date.now() - startTime,
          success: true,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  currentTool: currentTool
                    ? {
                        name: currentTool.name,
                        version: currentTool.version,
                        performance: currentTool.performance,
                      }
                    : null,
                  alternatives: betterCandidates.map((c) => ({
                    name: c.name,
                    fullName: c.fullName,
                    description: c.description,
                    stars: c.stars,
                    forks: c.forks,
                    advantage: c.stars > (currentTool ? 100 : 0)
                      ? "社区更活跃"
                      : "stars 相近",
                    repository: c.repository,
                    npmPackage: c.npmPackage,
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        loggerService.error(LogCategory.SEARCH, `查找替代工具失败: ${toolName}`, {
          toolName,
          error: error as Error,
          duration: Date.now() - startTime,
          success: false,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "搜索失败",
                message: error instanceof Error ? error.message : String(error),
              }),
            },
          ],
        };
      }
    }
  );

  /**
   * tool_categories - 获取可用工具分类
   */
  server.registerTool(
    "tool_categories",
    {
      description: "获取 MCP Registry 中可用的工具分类",
      inputSchema: z.object({}),
    },
    async () => {
      const startTime = Date.now();
      loggerService.debug(LogCategory.SEARCH, "获取工具分类");

      try {
        const categories = await registryService.getCategories();

        loggerService.info(LogCategory.SEARCH, "获取分类完成", {
          context: { count: categories.length },
          duration: Date.now() - startTime,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  categories,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        loggerService.warn(LogCategory.SEARCH, `获取分类失败，使用备用列表: ${errorMessage}`, {
          error: error as Error,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: `获取分类失败: ${errorMessage}`,
                categories: [
                  "browser",
                  "filesystem",
                  "git",
                  "database",
                  "web",
                  "api",
                  "communication",
                  "development",
                  "ai",
                  "security",
                ],
              }),
            },
          ],
        };
      }
    }
  );

  /**
   * tool_popular - 获取热门 MCP 工具
   */
  server.registerTool(
    "tool_popular",
    {
      description: "获取最受欢迎的 MCP 工具列表",
      inputSchema: z.object({
        limit: z.number().optional().default(10).describe("返回数量 (默认 10)"),
      }),
    },
    async ({ limit = 10 }) => {
      const startTime = Date.now();
      loggerService.debug(LogCategory.SEARCH, `获取热门工具: limit=${limit}`);

      try {
        const popular = await registryService.getPopular(limit);

        loggerService.info(LogCategory.SEARCH, "获取热门工具完成", {
          context: { count: popular.length },
          duration: Date.now() - startTime,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  count: popular.length,
                  tools: popular.map((c) => ({
                    name: c.name,
                    description: c.description,
                    stars: c.stars,
                    categories: c.categories,
                    npmPackage: c.npmPackage,
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        loggerService.error(LogCategory.SEARCH, "获取热门工具失败", {
          error: error as Error,
          duration: Date.now() - startTime,
          success: false,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "获取热门工具失败",
                message: error instanceof Error ? error.message : String(error),
              }),
            },
          ],
        };
      }
    }
  );
}
