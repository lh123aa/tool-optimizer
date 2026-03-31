/**
 * 工具健康检查 MCP 工具
 * 检查已安装工具的状态和性能
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { configService } from "../services/config.js";
import { loggerService, LogCategory } from "../services/logger.js";

export function registerHealthTools(server: McpServer): void {
  /**
   * tool_list - 列出所有已安装的工具
   */
  server.registerTool(
    "tool_list",
    {
      description: "列出所有已安装的 MCP 工具及其状态",
      inputSchema: z.object({}),
    },
    () => {
      const startTime = Date.now();
      loggerService.debug(LogCategory.HEALTH, "查询已安装工具列表");

      const tools = configService.getAllTools();
      const performance = configService.getAllPerformance();

      loggerService.info(LogCategory.HEALTH, `返回 ${tools.length} 个工具`, {
        context: { count: tools.length },
        duration: Date.now() - startTime,
      });

      const toolList = tools.map((tool) => {
        const perf = performance.get(tool.name);
        return {
          name: tool.name,
          command: tool.command,
          args: tool.args,
          type: tool.type,
          enabled: tool.enabled,
          version: tool.version,
          installedAt: tool.installedAt,
          lastUsedAt: tool.lastUsedAt,
          performance: perf
            ? {
                successRate: (perf.successRate * 100).toFixed(1) + "%",
                avgDuration: perf.avgDuration.toFixed(0) + "ms",
                totalCalls: perf.successCount + perf.failureCount,
              }
            : null,
        };
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                count: toolList.length,
                tools: toolList,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  /**
   * tool_health - 检查单个工具的健康状态
   */
  server.registerTool(
    "tool_health",
    {
      description: "检查指定工具的健康状态和性能",
      inputSchema: z.object({
        toolName: z.string().describe("工具名称"),
      }),
    },
    ({ toolName }) => {
      const startTime = Date.now();
      loggerService.debug(LogCategory.HEALTH, `检查工具健康状态: ${toolName}`);

      const tool = configService.getTool(toolName);
      const perf = configService.getPerformance(toolName);

      if (!tool) {
        loggerService.warn(LogCategory.HEALTH, `工具不存在: ${toolName}`, { toolName });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  found: false,
                  message: `未找到工具: ${toolName}`,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      const status = perf
        ? perf.successRate >= 0.9
          ? "healthy"
          : perf.successRate >= 0.7
          ? "degraded"
          : "unhealthy"
        : "unknown";

      loggerService.info(LogCategory.HEALTH, `工具 ${toolName} 状态: ${status}`, {
        toolName,
        context: { status, successRate: perf?.successRate },
        duration: Date.now() - startTime,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                name: tool.name,
                status,
                enabled: tool.enabled,
                performance: perf
                  ? {
                      successRate: (perf.successRate * 100).toFixed(1) + "%",
                      avgDuration: perf.avgDuration.toFixed(0) + "ms",
                      successCount: perf.successCount,
                      failureCount: perf.failureCount,
                      lastMetricsAt: perf.lastMetricsAt,
                    }
                  : null,
                recommendation:
                  status === "unhealthy"
                    ? "建议更换工具"
                    : status === "degraded"
                    ? "考虑升级或更换"
                    : "运行正常",
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  /**
   * tool_health_all - 检查所有工具的健康状态
   */
  server.registerTool(
    "tool_health_all",
    {
      description: "检查所有已安装工具的健康状态摘要",
      inputSchema: z.object({}),
    },
    () => {
      const startTime = Date.now();
      loggerService.debug(LogCategory.HEALTH, "检查所有工具健康状态");

      const tools = configService.getAllTools();
      const summary = {
        total: tools.length,
        healthy: 0,
        degraded: 0,
        unhealthy: 0,
        unknown: 0,
        tools: [] as { name: string; status: string }[],
      };

      for (const tool of tools) {
        const perf = configService.getPerformance(tool.name);
        let status: string;

        if (!perf) {
          status = "unknown";
          summary.unknown++;
        } else if (perf.successRate >= 0.9) {
          status = "healthy";
          summary.healthy++;
        } else if (perf.successRate >= 0.7) {
          status = "degraded";
          summary.degraded++;
        } else {
          status = "unhealthy";
          summary.unhealthy++;
        }

        summary.tools.push({ name: tool.name, status });
      }

      loggerService.info(LogCategory.HEALTH, `健康检查完成`, {
        context: {
          total: summary.total,
          healthy: summary.healthy,
          degraded: summary.degraded,
          unhealthy: summary.unhealthy,
        },
        duration: Date.now() - startTime,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(summary, null, 2),
          },
        ],
      };
    }
  );
}
