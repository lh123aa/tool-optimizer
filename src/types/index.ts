/**
 * 工具迭代 MCP - 类型定义
 * 定义工具管理相关的核心数据结构
 */

// ============== 工具信息 ==============

/**
 * 已安装工具的信息
 */
export interface InstalledTool {
  name: string;                    // 工具名称 (如 "chrome-devtools")
  command: string;                 // 执行命令 (如 "npx")
  args: string[];                  // 命令参数
  type: "local" | "remote";       // 本地或远程
  enabled: boolean;                // 是否启用
  version?: string;                 // 版本号
  installedAt: string;             // 安装时间
  lastUsedAt?: string;             // 最后使用时间
  performance?: ToolPerformance;    // 性能数据
}

/**
 * 工具性能数据
 */
export interface ToolPerformance {
  successRate: number;             // 成功率 (0-1)
  avgDuration: number;             // 平均执行时间 (ms)
  tokenConsumption?: number;       // Token 消耗 (可选)
  failureCount: number;            // 失败次数
  successCount: number;            // 成功次数
  lastMetricsAt?: string;          // 最后记录时间
}

// ============== 工具候选 ==============

/**
 * MCP Registry 中的工具候选
 */
export interface ToolCandidate {
  name: string;                    // 工具名称
  fullName: string;                // 完整名称 (如 "microsoft/playwright-mcp")
  description: string;             // 工具描述
  stars: number;                    // GitHub stars
  forks: number;                    // GitHub forks
  license: string;                 // 许可证
  language: string;                // 主要语言
  homepage?: string;                // 官网
  repository?: string;             // GitHub 仓库
  categories: string[];              // 分类
  tools: string[];                  // 提供的工具列表
  lastUpdated?: string;             // 最后更新时间
  npmPackage?: string;              // npm 包名
  dockerImage?: string;             // Docker 镜像
}

/**
 * 搜索过滤器
 */
export interface SearchFilter {
  query?: string;                  // 搜索关键词
  category?: string;               // 分类 (browser, filesystem, etc.)
  language?: string;              // 编程语言
  license?: string;               // 许可证
  minStars?: number;               // 最小 stars
  sortBy?: "stars" | "updated" | "name";  // 排序方式
}

// ============== 评估报告 ==============

/**
 * 工具对比评估报告
 */
export interface EvaluationReport {
  id: string;                      // 报告 ID
  createdAt: string;               // 创建时间
  
  oldTool: EvaluatedTool;          // 旧工具
  newTool: ToolCandidate;          // 新工具候选
  
  // 评估维度
  efficiencyScore: number;         // 效率得分 (0-100)
  reliabilityScore: number;        // 可靠性得分 (0-100)
  featureScore: number;            // 功能得分 (0-100)
  tokenScore?: number;            // Token 节省得分 (0-100, 可选)
  
  overallScore: number;            // 综合得分 (0-100)
  
  // 具体数据
  comparison: {
    speedComparison: string;       // 速度对比描述
    reliabilityComparison: string; // 可靠性对比描述
    featureComparison: string;    // 功能对比描述
    tokenComparison?: string;      // Token 对比描述 (可选)
  };
  
  recommendation: "upgrade" | "keep" | "uncertain";
  reason: string;                  // 推荐理由
  risks: string[];                 // 潜在风险
}

/**
 * 被评估的工具（简化版）
 */
export interface EvaluatedTool {
  name: string;
  version?: string;
  performance?: ToolPerformance;
  features: string[];              // 已知的功能列表
}

// ============== 升级结果 ==============

/**
 * 升级操作结果
 */
export interface UpgradeResult {
  success: boolean;
  newTool?: InstalledTool;
  oldToolArchived?: ArchivedTool;
  error?: string;
  message: string;
}

/**
 * 已归档的旧工具
 */
export interface ArchivedTool {
  name: string;
  command: string;
  args: string[];
  archivedAt: string;
  reason: string;
  performanceSnapshot?: ToolPerformance;
}

// ============== 诊断类型 ==============

/**
 * 诊断模式
 */
export type DiagnoseMode = 
  | "manual"          // 手动触发 - 用户主动说"升级工具"等
  | "auto"            // 自动触发 - 任务失败时自动诊断
  | "both";           // 两种模式都启用

/**
 * 诊断触发条件
 */
export type DiagnoseTrigger = 
  | "manual_keyword"      // 手动：关键词触发
  | "task_stuck"          // 自动：任务卡住
  | "tool_failed"         // 自动：工具失败
  | "scheduled";         // 自动：定时检测

/**
 * 诊断结果状态
 */
export type DiagnoseStatus = 
  | "analyzing"      // 分析中
  | "tool_healthy"   // 工具正常
  | "tool_problem"   // 工具问题
  | "unknown_cause"; // 原因不明

/**
 * 诊断结果
 */
export interface DiagnoseResult {
  id: string;                        // 诊断 ID
  mode: DiagnoseMode;                // 触发模式
  trigger: DiagnoseTrigger;           // 触发条件
  status: DiagnoseStatus;            // 诊断状态
  
  // 分析信息
  taskContext?: string;              // 任务上下文
  errorContext?: string;              // 错误上下文
  
  // 工具分析结果
  analyzedTools: AnalyzedTool[];
  
  // 问题工具（如果有）
  problemTools: ProblemTool[];
  
  // 推荐的替代工具
  candidates: ToolCandidate[];
  
  // 生成时间
  createdAt: string;
  
  // 诊断摘要
  summary: string;
  isToolIssue: boolean;              // 是否是工具问题
  confidence: number;                 // 诊断置信度 (0-1)
}

/**
 * 被分析的工具
 */
export interface AnalyzedTool {
  name: string;
  healthStatus: "healthy" | "degraded" | "unhealthy" | "unknown";
  performance?: ToolPerformance;
  issueIndicators: string[];         // 问题指标
  lastError?: string;                // 最后错误
}

/**
 * 有问题的工具
 */
export interface ProblemTool {
  name: string;
  severity: "critical" | "high" | "medium" | "low";
  symptoms: string[];                // 症状描述
  possibleCauses: string[];          // 可能原因
  recommendations: string[];         // 建议
}

/**
 * 诊断报告（用于用户确认）
 */
export interface DiagnoseReport {
  diagnoseId: string;
  
  // 概览
  isToolIssue: boolean;
  summary: string;
  confidence: number;
  
  // 问题详情
  problems: ProblemTool[];
  
  // 替代方案
  alternatives: AlternativeCandidate[];
  
  // 下一步建议
  suggestedAction: "upgrade" | "keep" | "investigate" | "none";
  
  // 用户确认信息
  requireConfirm: boolean;
  confirmMessage?: string;
}

/**
 * 替代方案候选
 */
export interface AlternativeCandidate {
  candidate: ToolCandidate;
  evaluationReport: EvaluationReport;
  benefits: string[];
  risks: string[];
  compatibility: string;
}

/**
 * 诊断参数
 */
export interface DiagnoseParams {
  mode: DiagnoseMode;                        // 诊断模式
  taskContext?: string;                      // 任务上下文（可选）
  errorContext?: string;                     // 错误上下文（可选）
  specificTool?: string;                     // 指定工具（可选）
  limit?: number;                            // 搜索候选数量限制
}

// ============== 触发事件 ==============

/**
 * 触发评估的事件类型
 */
export type TriggerEvent = 
  | { type: "startup" }                                    // 系统启动
  | { type: "task_stuck"; task: string; error?: string }   // 任务卡住
  | { type: "tool_failed"; tool: string; error: string }   // 工具失败
  | { type: "manual"; query: string }                       // 手动触发
  | { type: "diagnose"; mode: DiagnoseMode; context?: string }; // 诊断触发

/**
 * 建议操作
 */
export interface SuggestedAction {
  id: string;
  type: "upgrade" | "install" | "compare" | "test";
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  toolName: string;
  candidate?: ToolCandidate;
  evaluationReport?: EvaluationReport;
  createdAt: string;
}

// ============== 通知 ==============

/**
 * 通知消息
 */
export interface Notification {
  id: string;
  level: "info" | "warning" | "success" | "error";
  title: string;
  message: string;
  actions?: SuggestedAction[];
  createdAt: string;
  read: boolean;
}

// ============== 配置 ==============

/**
 * 工具迭代系统配置
 */
export interface SystemConfig {
  // 监控配置
  monitor: {
    enabled: boolean;
    checkIntervalMs: number;       // 检查间隔 (毫秒)
    trackPerformance: boolean;     // 是否跟踪性能
  };
  
  // 诊断配置
  diagnose: {
    enabled: boolean;             // 是否启用诊断功能
    mode: DiagnoseMode;           // 诊断模式: manual/auto/both
    autoTriggers: {
      taskStuck: boolean;         // 任务卡住时自动诊断
      toolFailed: boolean;        // 工具失败时自动诊断
      scheduled: boolean;         // 定时诊断
    };
    minConfidence: number;        // 最小置信度 (0-1)
  };
  
  // 评估配置
  evaluation: {
    minScoreDiff: number;         // 最小分数差才建议升级 (0-100)
    requireUserConfirm: boolean;   // 是否需要用户确认
    autoBackup: boolean;           // 自动备份旧工具
  };
  
  // 安装配置
  install: {
    npmRegistry?: string;         // npm 镜像
    autoInstallDeps: boolean;     // 自动安装依赖
  };
  
  // 通知配置
  notification: {
    enabled: boolean;
    pushOnStartup: boolean;       // 启动时推送
    pushOnUpgrade: boolean;       // 升级时推送
  };
}

// ============== MCP 工具参数 ==============

/**
 * 工具搜索参数
 */
export interface SearchToolsParams {
  query: string;
  category?: string;
  limit?: number;
}

/**
 * 工具对比参数
 */
export interface CompareToolsParams {
  toolName: string;
  candidateName?: string;
}

/**
 * 工具升级参数
 */
export interface UpgradeToolParams {
  toolName: string;
  candidateName: string;
  confirmed?: boolean;
}

/**
 * 健康检查参数
 */
export interface HealthCheckParams {
  toolName?: string;
}

// ============== 日志类型 (从 logger 服务重新导出) ==============
// 避免重复定义，统一从 logger.js 导出

export type { LogLevel, LogCategory, LogEntry, LogStats } from "../services/logger.js";

// 日志查询参数 (保留在 types 中，未在 logger.ts 导出)
export interface QueryLogsParams {
  limit?: number;
  level?: "debug" | "info" | "warn" | "error";
  category?: string;
  toolName?: string;
  keyword?: string;
  startDate?: string;
  endDate?: string;
}
