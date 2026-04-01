/**
 * 日志查询 MCP 工具
 * 查询系统运行日志，用于问题排查和迭代升级
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { loggerService, LogLevel } from "../services/logger.js";

/**
 * 级别名称到枚举的映射
 */
const levelMap: Record<string, LogLevel> = {
  debug: LogLevel.DEBUG,
  info: LogLevel.INFO,
  warn: LogLevel.WARN,
  error: LogLevel.ERROR,
};

export function registerLogTools(server: McpServer): void {
  /**
   * tool_log_stats - 获取日志统计
   */
  server.registerTool(
    "tool_log_stats",
    {
      description: "获取日志统计信息，包括错误计数、警告计数等",
      inputSchema: z.object({}),
    },
    () => {
      try {
        const stats = loggerService.getStats();

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  summary: {
                    total: stats.total,
                    errors: stats.errorCount,
                    warnings: stats.warnCount,
                    info: stats.infoCount,
                  },
                  byCategory: stats.byCategory,
                  recentErrorsCount: stats.recentErrors.length,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "获取日志统计失败",
                message: error instanceof Error ? error.message : String(error),
              }),
            },
          ],
        };
      }
    }
  );

  /**
   * tool_log_recent - 获取最近的日志
   */
  server.registerTool(
    "tool_log_recent",
    {
      description: "获取最近的日志条目",
      inputSchema: z.object({
        limit: z.number().optional().default(50).describe("返回条数 (默认 50)"),
        level: z
          .enum(["debug", "info", "warn", "error"])
          .optional()
          .describe("过滤级别"),
      }),
    },
    ({ limit, level }) => {
      try {
        const levelEnum = level ? levelMap[level] : undefined;
        const logs = loggerService.getRecentLogs(limit, levelEnum);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  count: logs.length,
                  logs: logs.map((log) => ({
                    id: log.id,
                    timestamp: log.timestamp,
                    level: log.levelName,
                    category: log.category,
                    message: log.message,
                    toolName: log.toolName,
                    success: log.success,
                    duration: log.duration,
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "获取日志失败",
                message: error instanceof Error ? error.message : String(error),
              }),
            },
          ],
        };
      }
    }
  );

  /**
   * tool_log_errors - 获取错误日志
   */
  server.registerTool(
    "tool_log_errors",
    {
      description: "获取最近的错误日志",
      inputSchema: z.object({
        limit: z.number().optional().default(20).describe("返回条数 (默认 20)"),
      }),
    },
    ({ limit }) => {
      try {
        const errors = loggerService.getErrorLogs(limit);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  count: errors.length,
                  errors: errors.map((log) => ({
                    id: log.id,
                    timestamp: log.timestamp,
                    category: log.category,
                    message: log.message,
                    toolName: log.toolName,
                    error: log.error,
                    context: log.context,
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "获取错误日志失败",
                message: error instanceof Error ? error.message : String(error),
              }),
            },
          ],
        };
      }
    }
  );

  /**
   * tool_log_tool - 获取指定工具的日志
   */
  server.registerTool(
    "tool_log_tool",
    {
      description: "获取与指定工具相关的日志",
      inputSchema: z.object({
        toolName: z.string().describe("工具名称"),
        limit: z.number().optional().default(30).describe("返回条数 (默认 30)"),
      }),
    },
    ({ toolName, limit }) => {
      try {
        const logs = loggerService.getToolLogs(toolName, limit);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  toolName,
                  count: logs.length,
                  logs: logs.map((log) => ({
                    id: log.id,
                    timestamp: log.timestamp,
                    level: log.levelName,
                    message: log.message,
                    success: log.success,
                    duration: log.duration,
                    error: log.error,
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "获取工具日志失败",
                message: error instanceof Error ? error.message : String(error),
              }),
            },
          ],
        };
      }
    }
  );

  /**
   * tool_log_search - 搜索日志
   */
  server.registerTool(
    "tool_log_search",
    {
      description: "搜索日志内容",
      inputSchema: z.object({
        keyword: z.string().describe("搜索关键词"),
        limit: z.number().optional().default(50).describe("返回条数 (默认 50)"),
      }),
    },
    ({ keyword, limit }) => {
      try {
        const logs = loggerService.searchLogs(keyword, limit);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  keyword,
                  count: logs.length,
                  logs: logs.map((log) => ({
                    id: log.id,
                    timestamp: log.timestamp,
                    level: log.levelName,
                    category: log.category,
                    message: log.message,
                    toolName: log.toolName,
                    error: log.error,
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "搜索日志失败",
                message: error instanceof Error ? error.message : String(error),
              }),
            },
          ],
        };
      }
    }
  );

  /**
   * tool_log_info - 获取日志系统信息
   */
  server.registerTool(
    "tool_log_info",
    {
      description: "获取日志系统信息，包括日志文件路径、目录等",
      inputSchema: z.object({}),
    },
    () => {
      try {
        const stats = loggerService.getStats();

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  logFile: loggerService.getLogFilePath(),
                  logDir: loggerService.getLogDir(),
                  stats: {
                    total: stats.total,
                    errors: stats.errorCount,
                    warnings: stats.warnCount,
                    info: stats.infoCount,
                  },
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "获取日志信息失败",
                message: error instanceof Error ? error.message : String(error),
              }),
            },
          ],
        };
      }
    }
  );
}
