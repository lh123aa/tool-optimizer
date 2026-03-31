/**
 * 工具对比 MCP 工具
 * 对比两个工具并生成评估报告
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { configService } from "../services/config.js";
import { registryService } from "../services/registry.js";
import { evaluatorService } from "../services/evaluator.js";
import { loggerService, LogCategory } from "../services/logger.js";

export function registerCompareTools(server: McpServer): void {
  /**
   * tool_compare - 对比当前工具和候选工具
   */
  server.registerTool(
    "tool_compare",
    {
      description: "对比当前安装的工具与候选工具，生成评估报告",
      inputSchema: z.object({
        toolName: z.string().describe("当前安装的工具名称"),
        candidateName: z.string().optional().describe("候选工具名称 (MCP Registry 中的名称)"),
      }),
    },
    async ({ toolName, candidateName }) => {
      const startTime = Date.now();
      loggerService.info(LogCategory.COMPARE, `对比工具: ${toolName} vs ${candidateName || "待指定"}`, {
        toolName,
        context: { candidateName },
      });

      try {
        // 获取当前工具
        const currentTool = configService.getTool(toolName);
        if (!currentTool) {
          loggerService.warn(LogCategory.COMPARE, `工具不存在: ${toolName}`, { toolName });
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: `未找到当前工具: ${toolName}`,
                }),
              },
            ],
          };
        }

        // 如果没有指定候选工具，返回可用的替代选项
        if (!candidateName) {
          // 搜索替代工具
          const keywords = toolName
            .toLowerCase()
            .replace(/[-_]/g, " ")
            .split(" ")
            .filter((w: string) => w.length > 2);

          const candidates = await registryService.search(
            { query: keywords.join(" "), sortBy: "stars" },
            5
          );

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  currentTool: {
                    name: currentTool.name,
                    version: currentTool.version,
                    performance: currentTool.performance,
                  },
                  message: "请指定 candidateName 参数",
                  suggestions: candidates
                    .filter((c) => c.name.toLowerCase() !== toolName.toLowerCase())
                    .slice(0, 3)
                    .map((c) => ({
                      name: c.name,
                      stars: c.stars,
                      description: c.description,
                    })),
                }, null, 2),
              },
            ],
          };
        }

        // 获取候选工具详情
        const candidate = await registryService.getDetails(candidateName);
        if (!candidate) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: `未找到候选工具: ${candidateName}`,
                }),
              },
            ],
          };
        }

        // 生成评估报告
        const report = evaluatorService.generateReport(currentTool, candidate);

        loggerService.info(LogCategory.COMPARE, `对比完成: ${toolName}`, {
          toolName,
          context: {
            candidateName,
            overallScore: report.overallScore,
            recommendation: report.recommendation,
          },
          duration: Date.now() - startTime,
          success: true,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(report, null, 2),
            },
          ],
        };
      } catch (error) {
        loggerService.error(LogCategory.COMPARE, `对比失败: ${toolName}`, {
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
                error: "对比失败",
                message: error instanceof Error ? error.message : String(error),
              }),
            },
          ],
        };
      }
    }
  );

  /**
   * tool_evaluate_upgrade - 评估升级建议
   */
  server.registerTool(
    "tool_evaluate_upgrade",
    {
      description: "评估是否应该升级到新工具（基于评估报告）",
      inputSchema: z.object({
        toolName: z.string().describe("当前工具名称"),
        candidateName: z.string().describe("候选工具名称"),
      }),
    },
    async ({ toolName, candidateName }) => {
      const startTime = Date.now();
      loggerService.info(LogCategory.COMPARE, `评估升级: ${toolName} -> ${candidateName}`, {
        toolName,
        context: { candidateName },
      });

      try {
        const currentTool = configService.getTool(toolName);
        if (!currentTool) {
          loggerService.warn(LogCategory.COMPARE, `工具不存在: ${toolName}`, { toolName });
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: `未找到工具: ${toolName}`,
                }),
              },
            ],
          };
        }

        const candidate = await registryService.getDetails(candidateName);
        if (!candidate) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: `未找到候选工具: ${candidateName}`,
                }),
              },
            ],
          };
        }

        const report = evaluatorService.generateReport(currentTool, candidate);

        // 构建用户友好的建议
        const suggestion = {
          verdict: report.recommendation === "upgrade" ? "建议升级" :
                   report.recommendation === "keep" ? "建议保持" : "需要测试",
          confidence: report.overallScore >= 80 ? "高" :
                      report.overallScore >= 60 ? "中" : "低",
          summary: {
            overallScore: report.overallScore,
            efficiency: report.efficiencyScore,
            reliability: report.reliabilityScore,
            features: report.featureScore,
          },
          keyFindings: [
            report.comparison.speedComparison,
            report.comparison.reliabilityComparison,
            report.comparison.featureComparison,
          ].filter(Boolean),
          risks: report.risks,
          nextSteps: report.recommendation === "upgrade"
            ? [
                "1. 在测试环境中安装新工具",
                "2. 运行评估测试",
                "3. 确认性能提升",
                "4. 确认后卸载旧工具",
              ]
            : report.recommendation === "uncertain"
            ? [
                "1. 先进行小范围测试",
                "2. 收集实际使用数据",
                "3. 重新评估",
              ]
            : [
                "1. 保持当前工具",
                "2. 继续收集性能数据",
                "3. 定期检查是否有更好的选择",
              ],
        };

        loggerService.info(LogCategory.COMPARE, `评估完成: ${toolName}`, {
          toolName,
          context: {
            candidateName,
            verdict: suggestion.verdict,
            overallScore: report.overallScore,
          },
          duration: Date.now() - startTime,
          success: true,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(suggestion, null, 2),
            },
          ],
        };
      } catch (error) {
        loggerService.error(LogCategory.COMPARE, `评估失败: ${toolName}`, {
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
                error: "评估失败",
                message: error instanceof Error ? error.message : String(error),
              }),
            },
          ],
        };
      }
    }
  );
}
