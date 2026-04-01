/**
 * 工具诊断 MCP 工具
 * 诊断工具问题，搜索替代方案，推荐升级
 * 
 * 诊断流程:
 * 1. 分析任务上下文，判断是否是工具问题
 * 2. 检查相关工具的健康状态
 * 3. 搜索更好的替代工具
 * 4. 生成对比报告
 * 5. 询问用户确认
 */

import { randomUUID } from "crypto";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { configService } from "../services/config.js";
import { registryService } from "../services/registry.js";
import { evaluatorService } from "../services/evaluator.js";
import { loggerService, LogCategory } from "../services/logger.js";
import type {
  DiagnoseResult,
  DiagnoseReport,
  AnalyzedTool,
  ProblemTool,
  AlternativeCandidate,
  DiagnoseMode,
  DiagnoseTrigger,
  DiagnoseStatus,
  ToolCandidate,
  EvaluationReport,
} from "../types/index.js";

/**
 * 诊断关键词列表（用于检测手动触发）
 */
const MANUAL_TRIGGER_KEYWORDS = [
  "升级工具", "工具升级", "检测工具", "工具检测",
  "替代工具", "工具替代", "更换工具", "工具更换",
  "工具问题", "工具出错", "工具失败", "工具不行",
  "换个工具", "其他工具", "更好的工具",
];

export function registerDiagnoseTools(server: McpServer): void {
  /**
   * tool_diagnose - 手动触发诊断
   */
  server.registerTool(
    "tool_diagnose",
    {
      description: "手动触发工具诊断 - 分析当前工具问题，搜索替代方案",
      inputSchema: z.object({
        taskContext: z.string().optional().describe("任务上下文描述（可选）"),
        errorContext: z.string().optional().describe("错误上下文描述（可选）"),
        specificTool: z.string().optional().describe("指定要诊断的工具名称（可选）"),
        limit: z.number().optional().default(3).describe("搜索替代工具数量限制"),
      }),
    },
    async ({ taskContext, errorContext, specificTool, limit = 3 }) => {
      const startTime = Date.now();
      const mode: DiagnoseMode = "manual";
      const trigger: DiagnoseTrigger = "manual_keyword";

      loggerService.info(LogCategory.DIAGNOSE, "手动诊断启动", {
        context: { taskContext, errorContext, specificTool },
      });

      // 执行诊断
      const result = await performDiagnosis({
        mode,
        trigger,
        taskContext,
        errorContext,
        specificTool,
        limit,
      });

      // 生成报告
      const report = generateDiagnoseReport(result);

      loggerService.info(LogCategory.DIAGNOSE, `诊断完成: ${result.status}`, {
        context: { 
          isToolIssue: result.isToolIssue, 
          candidates: result.candidates.length,
          duration: Date.now() - startTime,
        },
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(report, null, 2),
          },
        ],
      };
    }
  );

  /**
   * tool_diagnose_auto - 自动触发诊断（任务失败时）
   */
  server.registerTool(
    "tool_diagnose_auto",
    {
      description: "自动触发工具诊断 - 任务失败时系统自动调用",
      inputSchema: z.object({
        taskContext: z.string().describe("任务上下文描述"),
        errorContext: z.string().describe("错误上下文描述"),
        failedTool: z.string().optional().describe("失败的工具名称（可选）"),
        errorMessage: z.string().optional().describe("错误信息（可选）"),
      }),
    },
    async ({ taskContext, errorContext, failedTool, errorMessage }) => {
      const startTime = Date.now();
      const mode: DiagnoseMode = "auto";
      const trigger: DiagnoseTrigger = failedTool ? "tool_failed" : "task_stuck";

      // 检查是否启用自动诊断
      if (!configService.isAutoDiagnoseEnabled()) {
        loggerService.debug(LogCategory.DIAGNOSE, "自动诊断已禁用");
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                enabled: false,
                message: "自动诊断功能已禁用，请在配置中启用",
              }),
            },
          ],
        };
      }

      loggerService.info(LogCategory.DIAGNOSE, "自动诊断启动", {
        context: { trigger, taskContext, failedTool, errorMessage },
      });

      // 执行诊断
      const result = await performDiagnosis({
        mode,
        trigger,
        taskContext,
        errorContext,
        specificTool: failedTool,
        limit: 3,
      });

      // 生成报告
      const report = generateDiagnoseReport(result);

      loggerService.info(LogCategory.DIAGNOSE, `自动诊断完成: ${result.status}`, {
        context: { 
          isToolIssue: result.isToolIssue, 
          candidates: result.candidates.length,
          duration: Date.now() - startTime,
        },
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(report, null, 2),
          },
        ],
      };
    }
  );

  /**
   * tool_check_diagnose_keyword - 检查是否包含诊断关键词
   */
  server.registerTool(
    "tool_check_diagnose_keyword",
    {
      description: "检查输入是否包含诊断关键词，用于触发手动诊断",
      inputSchema: z.object({
        text: z.string().describe("要检查的文本"),
      }),
    },
    ({ text }) => {
      const matchedKeywords = MANUAL_TRIGGER_KEYWORDS.filter(kw => 
        text.toLowerCase().includes(kw.toLowerCase())
      );
      
      const shouldTrigger = matchedKeywords.length > 0;

      loggerService.debug(LogCategory.DIAGNOSE, "关键词检查", {
        context: { matchedKeywords, shouldTrigger },
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              shouldTrigger,
              matchedKeywords,
              message: shouldTrigger
                ? `检测到诊断关键词: ${matchedKeywords.join(", ")}`
                : "未检测到诊断关键词",
            }, null, 2),
          },
        ],
      };
    }
  );

  /**
   * tool_set_diagnose_mode - 设置诊断模式
   */
  server.registerTool(
    "tool_set_diagnose_mode",
    {
      description: "设置诊断模式：manual（手动）/ auto（自动）/ both（两种都启用）",
      inputSchema: z.object({
        mode: z.enum(["manual", "auto", "both"]).describe("诊断模式"),
        autoTriggers: z.object({
          taskStuck: z.boolean().optional(),
          toolFailed: z.boolean().optional(),
          scheduled: z.boolean().optional(),
        }).optional().describe("自动触发条件（仅 auto/both 模式）"),
      }),
    },
    ({ mode, autoTriggers }) => {
      configService.setDiagnoseMode(mode);
      
      if (autoTriggers) {
        configService.updateAutoDiagnoseTriggers(autoTriggers);
      }

      const config = configService.getSystemConfig();

      loggerService.info(LogCategory.DIAGNOSE, `诊断模式已更新: ${mode}`, {
        context: { mode, autoTriggers },
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              mode,
              autoTriggers: config.diagnose.autoTriggers,
              message: `诊断模式已设置为: ${mode}`,
            }, null, 2),
          },
        ],
      };
    }
  );

  /**
   * tool_get_diagnose_config - 获取诊断配置
   */
  server.registerTool(
    "tool_get_diagnose_config",
    {
      description: "获取当前诊断配置",
      inputSchema: z.object({}),
    },
    () => {
      const config = configService.getSystemConfig();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              enabled: config.diagnose.enabled,
              mode: config.diagnose.mode,
              autoTriggers: config.diagnose.autoTriggers,
              minConfidence: config.diagnose.minConfidence,
              isAutoEnabled: configService.isAutoDiagnoseEnabled(),
              isManualEnabled: configService.isManualDiagnoseEnabled(),
            }, null, 2),
          },
        ],
      };
    }
  );
}

// ============== 诊断核心逻辑 ==============

interface DiagnoseOptions {
  mode: DiagnoseMode;
  trigger: DiagnoseTrigger;
  taskContext?: string;
  errorContext?: string;
  specificTool?: string;
  limit: number;
}

/**
 * 执行诊断
 */
async function performDiagnosis(options: DiagnoseOptions): Promise<DiagnoseResult> {
  const { mode, trigger, taskContext, errorContext, specificTool, limit } = options;
  
  const analyzeTools: AnalyzedTool[] = [];
  const problemTools: ProblemTool[] = [];
  const candidates: ToolCandidate[] = [];

  // 1. 获取要诊断的工具列表
  const tools = specificTool
    ? [configService.getTool(specificTool)].filter(Boolean)
    : configService.getAllTools();

  // 2. 分析每个工具的健康状态
  for (const tool of tools) {
    if (!tool) continue;

    const perf = configService.getPerformance(tool.name);
    const healthStatus = getHealthStatus(perf);
    const issueIndicators: string[] = [];

    // 检测问题指标
    if (perf) {
      if (perf.successRate < 0.7) {
        issueIndicators.push(`成功率过低: ${(perf.successRate * 100).toFixed(1)}%`);
      }
      if (perf.failureCount > 10) {
        issueIndicators.push(`失败次数较多: ${perf.failureCount}次`);
      }
    }

    // 检测最后错误（如果有）
    let lastError: string | undefined;
    if (errorContext && errorContext.toLowerCase().includes(tool.name.toLowerCase())) {
      lastError = errorContext;
      issueIndicators.push("近期有执行失败");
    }

    const analyzed: AnalyzedTool = {
      name: tool.name,
      healthStatus,
      performance: perf,
      issueIndicators,
      lastError,
    };

    analyzeTools.push(analyzed);

    // 如果有问题，生成详细问题报告
    if (healthStatus === "unhealthy" || healthStatus === "degraded") {
      const problem: ProblemTool = {
        name: tool.name,
        severity: healthStatus === "unhealthy" ? "critical" : "high",
        symptoms: issueIndicators,
        possibleCauses: analyzePossibleCauses(healthStatus, perf),
        recommendations: generateRecommendations(tool.name, healthStatus),
      };
      problemTools.push(problem);
    }
  }

  // 3. 如果有问题工具，搜索替代方案
  if (problemTools.length > 0) {
    for (const problem of problemTools) {
      // 提取关键词搜索替代工具
      const keywords = extractKeywords(problem.name, taskContext, errorContext);
      const relatedTools = await registryService.findRelatedTools(keywords);
      
      // 过滤掉当前工具
      const filtered = relatedTools.filter(t => 
        t.name.toLowerCase() !== problem.name.toLowerCase()
      );
      
      candidates.push(...filtered);
    }

    // 去重
    const uniqueCandidates = deduplicateCandidates(candidates);
    candidates.splice(0, candidates.length, ...uniqueCandidates.slice(0, limit));
  }

  // 4. 判断是否是工具问题
  const isToolIssue = problemTools.length > 0;
  const confidence = calculateConfidence(analyzeTools, problemTools, candidates);
  const status = determineStatus(analyzeTools, problemTools);
  const summary = generateSummary(analyzeTools, problemTools, candidates, isToolIssue);

  return {
    id: randomUUID(),
    mode,
    trigger,
    status,
    taskContext,
    errorContext,
    analyzedTools: analyzeTools,
    problemTools,
    candidates,
    createdAt: new Date().toISOString(),
    summary,
    isToolIssue,
    confidence,
  };
}

/**
 * 获取工具健康状态
 */
function getHealthStatus(perf?: { successRate: number }): "healthy" | "degraded" | "unhealthy" | "unknown" {
  if (!perf) return "unknown";
  if (perf.successRate >= 0.9) return "healthy";
  if (perf.successRate >= 0.7) return "degraded";
  return "unhealthy";
}

/**
 * 分析可能原因
 */
function analyzePossibleCauses(
  healthStatus: string,
  perf?: { successRate: number; avgDuration?: number }
): string[] {
  const causes: string[] = [];

  if (healthStatus === "unhealthy") {
    causes.push("工具版本过旧，可能存在已知问题");
    causes.push("工具与当前系统环境不兼容");
  }

  if (perf && perf.avgDuration && perf.avgDuration > 5000) {
    causes.push("工具执行时间过长，可能存在性能问题");
  }

  causes.push("可能存在更好的替代工具");
  causes.push("工具配置可能需要调整");

  return causes;
}

/**
 * 生成建议
 */
function generateRecommendations(toolName: string, healthStatus: string): string[] {
  const recommendations: string[] = [];

  if (healthStatus === "unhealthy") {
    recommendations.push(`建议立即更换工具 ${toolName}`);
    recommendations.push("搜索并评估更稳定的替代工具");
  } else {
    recommendations.push(`可以考虑升级到更稳定的版本或替代工具`);
  }

  recommendations.push("查看工具的 GitHub issues 了解已知问题");
  recommendations.push("检查工具配置是否正确");

  return recommendations;
}

/**
 * 提取搜索关键词
 */
function extractKeywords(toolName: string, taskContext?: string, errorContext?: string): string[] {
  const keywords: string[] = [];

  // 从工具名提取（如 "chrome-devtools" -> "chrome", "devtools"）
  const parts = toolName.split(/[-_]/);
  keywords.push(...parts);

  // 从任务上下文提取关键词
  if (taskContext) {
    // 简单提取英文单词
    const words = taskContext.match(/[a-zA-Z]+/g);
    if (words) {
      keywords.push(...words.slice(0, 3));
    }
  }

  // 从错误上下文提取
  if (errorContext) {
    const words = errorContext.match(/[a-zA-Z]+/g);
    if (words) {
      keywords.push(...words.slice(0, 3));
    }
  }

  // 去重
  return [...new Set(keywords)];
}

/**
 * 候选工具去重
 */
function deduplicateCandidates(candidates: ToolCandidate[]): ToolCandidate[] {
  const seen = new Map<string, ToolCandidate>();
  
  for (const candidate of candidates) {
    const key = candidate.name.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, candidate);
    }
  }

  return Array.from(seen.values());
}

/**
 * 计算诊断置信度
 */
function calculateConfidence(
  analyzedTools: AnalyzedTool[],
  problemTools: ProblemTool[],
  candidates: ToolCandidate[]
): number {
  let confidence = 0.5; // 基础置信度

  // 问题越多，置信度越高
  if (problemTools.length > 0) {
    confidence += 0.2;
  }

  // 找到替代方案，增加置信度
  if (candidates.length > 0) {
    confidence += 0.15;
  }

  // 工具健康度越低，置信度越高
  for (const tool of analyzedTools) {
    if (tool.healthStatus === "unhealthy") {
      confidence += 0.1;
    }
  }

  return Math.min(1, confidence);
}

/**
 * 判断诊断状态
 */
function determineStatus(analyzedTools: AnalyzedTool[], problemTools: ProblemTool[]): DiagnoseStatus {
  if (problemTools.length > 0) {
    return "tool_problem";
  }

  const hasUnknown = analyzedTools.some(t => t.healthStatus === "unknown");
  if (hasUnknown) {
    return "unknown_cause";
  }

  return "tool_healthy";
}

/**
 * 生成诊断摘要
 */
function generateSummary(
  analyzedTools: AnalyzedTool[],
  problemTools: ProblemTool[],
  candidates: ToolCandidate[],
  isToolIssue: boolean
): string {
  if (isToolIssue) {
    const toolNames = problemTools.map(p => p.name).join(", ");
    const candidateCount = candidates.length;
    return `检测到 ${problemTools.length} 个工具存在问题: ${toolNames}。找到 ${candidateCount} 个潜在替代方案。`;
  }

  return `未检测到明显的工具问题。分析了 ${analyzedTools.length} 个工具，全部运行正常。`;
}

/**
 * 生成诊断报告（用于用户确认）
 */
function generateDiagnoseReport(result: DiagnoseResult): DiagnoseReport {
  const alternatives: AlternativeCandidate[] = [];

  // 为每个候选工具生成评估报告
  for (const candidate of result.candidates) {
    const oldTool = configService.getTool(result.analyzedTools[0]?.name || "");
    if (oldTool) {
      const evaluationReport = evaluatorService.generateReport(oldTool, candidate);
      
      alternatives.push({
        candidate,
        evaluationReport,
        benefits: generateBenefits(evaluationReport),
        risks: evaluationReport.risks,
        compatibility: evaluateCompatibility(oldTool, candidate),
      });
    }
  }

  // 按综合得分排序
  alternatives.sort((a, b) => 
    b.evaluationReport.overallScore - a.evaluationReport.overallScore
  );

  // 判断建议操作
  let suggestedAction: DiagnoseReport["suggestedAction"] = "none";
  if (result.isToolIssue) {
    if (alternatives.length > 0 && alternatives[0].evaluationReport.recommendation === "upgrade") {
      suggestedAction = "upgrade";
    } else if (alternatives.length > 0) {
      suggestedAction = "investigate";
    } else {
      suggestedAction = "investigate";
    }
  }

  return {
    diagnoseId: result.id,
    isToolIssue: result.isToolIssue,
    summary: result.summary,
    confidence: result.confidence,
    problems: result.problemTools,
    alternatives,
    suggestedAction,
    requireConfirm: true,
    confirmMessage: result.isToolIssue
      ? "检测到工具问题，是否需要升级到推荐的工具？"
      : "未检测到明显问题，是否继续调查？",
  };
}

/**
 * 生成优势列表
 */
function generateBenefits(report: EvaluationReport): string[] {
  const benefits: string[] = [];

  if (report.efficiencyScore > 60) {
    benefits.push(`效率得分 ${report.efficiencyScore}/100，社区活跃度高`);
  }
  if (report.featureScore > 60) {
    benefits.push(`功能得分 ${report.featureScore}/100，提供 ${report.newTool.tools?.length || 0} 个工具`);
  }
  if (report.comparison.speedComparison) {
    benefits.push(report.comparison.speedComparison);
  }

  return benefits;
}

/**
 * 评估兼容性
 */
function evaluateCompatibility(
  oldTool: { name: string },
  newTool: ToolCandidate
): string {
  // 简单兼容性评估
  const oldName = oldTool.name.toLowerCase();
  const newName = newTool.name.toLowerCase();

  if (oldName.includes(newName) || newName.includes(oldName)) {
    return "高 - 名称相似，可能功能相近";
  }

  if (newTool.categories?.length > 0) {
    return "中 - 需实际测试验证兼容性";
  }

  return "未知 - 建议先小范围测试";
}
