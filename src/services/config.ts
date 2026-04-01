/**
 * 配置文件管理服务
 * 负责读取、写入 MCP 配置文件
 * 支持 OpenCode、Claude Desktop 等 MCP 客户端配置
 * 
 * 特性:
 * - 异步文件操作 (fs.promises)
 * - 写队列 (防止并发写入冲突)
 * - 批量写入优化
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import type { 
  InstalledTool, 
  ArchivedTool, 
  ToolPerformance, 
  SystemConfig
} from "../types/index.js";

/**
 * MCP 客户端配置结构
 */
interface MCPConfig {
  mcp?: Record<string, {
    command?: string;
    args?: string[];
    enabled?: boolean;
    type?: "local" | "remote";
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

// 配置文件路径
const CONFIG_PATHS = {
  opencode: join(homedir(), ".config/opencode/opencode.json"),
  claudeDesktop: join(homedir(), "AppData/Roaming/Claude/claude_desktop_config.json"),
};

/**
 * 工具数据存储路径
 */
const DATA_DIR = join(homedir(), ".tool-optimizer-mcp");
const TOOLS_FILE = join(DATA_DIR, "tools.json");
const ARCHIVE_FILE = join(DATA_DIR, "archive.json");
const CONFIG_FILE = join(DATA_DIR, "config.json");
const METRICS_FILE = join(DATA_DIR, "metrics.json");

/**
 * 挂起中的写入操作
 */
interface PendingWrite {
  filePath: string;
  data: unknown;
  resolve: () => void;
  reject: (error: Error) => void;
}

export class ConfigService {
  private tools: Map<string, InstalledTool> = new Map();
  private archive: Map<string, ArchivedTool> = new Map();
  private config: SystemConfig;
  private metrics: Map<string, ToolPerformance> = new Map();
  
  // 写队列
  private writeQueue: PendingWrite[] = [];
  private isProcessingQueue = false;
  private readonly BATCH_DELAY_MS = 100; // 批量写入延迟

  constructor() {
    this.ensureDataDirSync();
    this.config = this.getDefaultConfig();
    // 初始化时不需要等待加载
    void this.load().catch((err: Error) => console.error("初始化加载失败:", err.message));
  }

  /**
   * 同步确保数据目录存在 (构造函数中使用)
   */
  private ensureDataDirSync(): void {
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  /**
   * 确保数据目录存在 (异步)
   */
  private async ensureDataDir(): Promise<void> {
    if (!existsSync(DATA_DIR)) {
      await mkdir(DATA_DIR, { recursive: true });
    }
  }

  /**
   * 处理写队列
   */
  private async processWriteQueue(): Promise<void> {
    if (this.isProcessingQueue || this.writeQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    // 等待批量延迟，收集更多的写操作
    await this.sleep(this.BATCH_DELAY_MS);

    // 取出所有挂起的写入
    const pending = [...this.writeQueue];
    this.writeQueue = [];

    // 按文件分组
    const grouped = new Map<string, PendingWrite[]>();
    for (const write of pending) {
      const existing = grouped.get(write.filePath) || [];
      existing.push(write);
      grouped.set(write.filePath, existing);
    }

    // 执行每个文件的最后一次写入 (覆盖之前的)
    const promises = [];
    for (const [filePath, writes] of grouped) {
      const lastWrite = writes[writes.length - 1]; // 只保留最后一次写入
      promises.push(
        this.writeFileSafe(filePath, lastWrite.data)
          .then(() => lastWrite.resolve())
          .catch((err: unknown) => lastWrite.reject(err instanceof Error ? err : new Error(String(err))))
      );
    }

    await Promise.all(promises);
    this.isProcessingQueue = false;

    // 如果队列还有剩余，继续处理
    if (this.writeQueue.length > 0) {
      void this.processWriteQueue();
    }
  }

  /**
   * 安全写入文件 (带错误处理)
   */
  private async writeFileSafe(filePath: string, data: unknown): Promise<void> {
    try {
      const dir = dirname(filePath);
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }
      await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
    } catch (error) {
      console.error(`写入文件失败 ${filePath}:`, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * 睡眠工具
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 将写入加入队列
   */
  private enqueueWrite(filePath: string, data: unknown): Promise<void> {
    return new Promise((resolve, reject) => {
      this.writeQueue.push({ filePath, data, resolve, reject });
      void this.processWriteQueue();
    });
  }

  /**
   * 加载所有数据 (异步)
   */
  private async load(): Promise<void> {
    await Promise.all([
      this.loadTools(),
      this.loadArchive(),
      this.loadMetrics(),
      this.loadConfigFile(),
    ]);
  }

  /**
   * 从文件加载已安装工具
   */
  private async loadTools(): Promise<void> {
    try {
      if (existsSync(TOOLS_FILE)) {
        const data = JSON.parse(await readFile(TOOLS_FILE, "utf-8")) as Record<string, InstalledTool>;
        this.tools = new Map(Object.entries(data));
      }
    } catch (error) {
      console.warn("加载工具列表失败:", error);
    }
  }

  /**
   * 保存已安装工具到文件 (异步批量写入)
   */
  private saveToolsAsync(): void {
    void this.enqueueWrite(TOOLS_FILE, Object.fromEntries(this.tools));
  }

  /**
   * 从文件加载归档工具
   */
  private async loadArchive(): Promise<void> {
    try {
      if (existsSync(ARCHIVE_FILE)) {
        const data = JSON.parse(await readFile(ARCHIVE_FILE, "utf-8")) as Record<string, ArchivedTool>;
        this.archive = new Map(Object.entries(data));
      }
    } catch (error) {
      console.warn("加载归档列表失败:", error);
    }
  }

  /**
   * 保存归档工具到文件 (异步批量写入)
   */
  private saveArchiveAsync(): void {
    void this.enqueueWrite(ARCHIVE_FILE, Object.fromEntries(this.archive));
  }

  /**
   * 加载性能指标
   */
  private async loadMetrics(): Promise<void> {
    try {
      if (existsSync(METRICS_FILE)) {
        const data = JSON.parse(await readFile(METRICS_FILE, "utf-8")) as Record<string, ToolPerformance>;
        this.metrics = new Map(Object.entries(data));
      }
    } catch (error) {
      console.warn("加载性能指标失败:", error);
    }
  }

  /**
   * 保存性能指标 (异步批量写入)
   */
  private saveMetricsAsync(): void {
    void this.enqueueWrite(METRICS_FILE, Object.fromEntries(this.metrics));
  }

  /**
   * 加载系统配置 (异步)
   */
  private async loadConfigFile(): Promise<void> {
    try {
      if (existsSync(CONFIG_FILE)) {
        const loaded = JSON.parse(await readFile(CONFIG_FILE, "utf-8")) as Partial<SystemConfig>;
        this.config = { ...this.getDefaultConfig(), ...loaded };
        return;
      }
    } catch (error) {
      console.warn("加载配置失败:", error);
    }
    this.config = this.getDefaultConfig();
  }

  /**
   * 保存系统配置 (异步批量写入)
   */
  private saveConfigAsync(): void {
    void this.enqueueWrite(CONFIG_FILE, this.config);
  }

  /**
   * 获取默认配置
   */
  private getDefaultConfig(): SystemConfig {
    return {
      monitor: {
        enabled: true,
        checkIntervalMs: 1000 * 60 * 60, // 1 小时
        trackPerformance: true,
      },
      diagnose: {
        enabled: true,
        mode: "manual", // 默认手动模式，只有用户说"升级工具"时才检测
        autoTriggers: {
          taskStuck: false,       // 任务卡住时不自自动诊断（除非明确开启）
          toolFailed: false,      // 工具失败时不自动诊断
          scheduled: false,       // 不使用定时诊断
        },
        minConfidence: 0.7,      // 最小置信度 70%
      },
      evaluation: {
        minScoreDiff: 10, // 分数差大于 10 才建议升级
        requireUserConfirm: true,
        autoBackup: true,
      },
      install: {
        autoInstallDeps: true,
        npmRegistry: "https://registry.npmjs.org",
      },
      notification: {
        enabled: true,
        pushOnStartup: true,
        pushOnUpgrade: true,
      },
    };
  }

  // ============== 工具管理 ==============

  /**
   * 获取所有已安装工具
   */
  getAllTools(): InstalledTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * 获取单个工具
   */
  getTool(name: string): InstalledTool | undefined {
    return this.tools.get(name);
  }

  /**
   * 添加或更新工具 (异步写入)
   */
  setTool(tool: InstalledTool): void {
    this.tools.set(tool.name, tool);
    this.saveToolsAsync();
  }

  /**
   * 移除工具 (异步写入)
   */
  removeTool(name: string): boolean {
    const result = this.tools.delete(name);
    if (result) {
      this.saveToolsAsync();
    }
    return result;
  }

  /**
   * 归档旧工具（卸载前）(异步写入)
   */
  archiveTool(name: string, reason: string): ArchivedTool | null {
    const tool = this.tools.get(name);
    if (!tool) return null;

    const archived: ArchivedTool = {
      name: tool.name,
      command: tool.command,
      args: tool.args,
      archivedAt: new Date().toISOString(),
      reason,
      performanceSnapshot: tool.performance,
    };

    this.archive.set(name, archived);
    this.saveArchiveAsync();

    // 从活动工具中移除
    this.tools.delete(name);
    this.saveToolsAsync();

    return archived;
  }

  /**
   * 获取归档工具
   */
  getArchivedTools(): ArchivedTool[] {
    return Array.from(this.archive.values());
  }

  /**
   * 恢复归档的工具 (异步写入)
   */
  restoreTool(name: string): InstalledTool | null {
    const archived = this.archive.get(name);
    if (!archived) return null;

    const restored: InstalledTool = {
      name: archived.name,
      command: archived.command,
      args: archived.args,
      type: "local",
      enabled: true,
      installedAt: new Date().toISOString(),
      performance: archived.performanceSnapshot,
    };

    this.tools.set(name, restored);
    this.saveToolsAsync();

    this.archive.delete(name);
    this.saveArchiveAsync();

    return restored;
  }

  // ============== MCP 配置读写 ==============

  /**
   * 读取 OpenCode MCP 配置 (异步)
   */
  async readOpenCodeConfig(): Promise<MCPConfig> {
    return this.readMCPConfigAsync(CONFIG_PATHS.opencode);
  }

  /**
   * 写入 OpenCode MCP 配置 (异步)
   */
  async writeOpenCodeConfig(config: MCPConfig): Promise<void> {
    await this.writeMCPConfigAsync(CONFIG_PATHS.opencode, config);
  }

  /**
   * 添加工具到 OpenCode 配置 (异步)
   */
  async addToolToOpenCode(name: string, tool: InstalledTool): Promise<void> {
    const config = await this.readOpenCodeConfig();
    if (!config.mcp) config.mcp = {};

    config.mcp[name] = {
      command: tool.command,
      args: tool.args,
      enabled: true,
      type: tool.type,
    };

    await this.writeOpenCodeConfig(config);
  }

  /**
   * 从 OpenCode 配置移除工具 (异步)
   */
  async removeToolFromOpenCode(name: string): Promise<void> {
    const config = await this.readOpenCodeConfig();
    if (config.mcp && config.mcp[name]) {
      delete config.mcp[name];
      await this.writeOpenCodeConfig(config);
    }
  }

  /**
   * 读取 MCP 配置文件 (异步)
   */
  private async readMCPConfigAsync(path: string): Promise<MCPConfig> {
    try {
      if (existsSync(path)) {
        return JSON.parse(await readFile(path, "utf-8")) as MCPConfig;
      }
    } catch (error) {
      console.warn(`读取配置文件失败 ${path}:`, error);
    }
    return {};
  }

  /**
   * 写入 MCP 配置文件 (异步)
   */
  private async writeMCPConfigAsync(path: string, config: MCPConfig): Promise<void> {
    try {
      const dir = dirname(path);
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }
      await writeFile(path, JSON.stringify(config, null, 2), "utf-8");
    } catch (error) {
      console.error(`写入配置文件失败 ${path}:`, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  // ============== 性能指标 ==============

  /**
   * 记录工具性能 (异步批量写入)
   */
  recordPerformance(toolName: string, success: boolean, duration: number, tokens?: number): void {
    let perf = this.metrics.get(toolName);

    if (!perf) {
      perf = {
        successRate: 0,
        avgDuration: 0,
        failureCount: 0,
        successCount: 0,
      };
    }

    // 更新计数
    if (success) {
      perf.successCount++;
    } else {
      perf.failureCount++;
    }

    // 计算成功率
    const total = perf.successCount + perf.failureCount;
    perf.successRate = total > 0 ? perf.successCount / total : 0;

    // 更新平均执行时间 (指数移动平均)
    if (perf.avgDuration === 0) {
      perf.avgDuration = duration;
    } else {
      perf.avgDuration = (perf.avgDuration * 0.7) + (duration * 0.3);
    }

    // 更新 Token 消耗
    if (tokens !== undefined) {
      perf.tokenConsumption = tokens;
    }

    perf.lastMetricsAt = new Date().toISOString();

    this.metrics.set(toolName, perf);
    this.saveMetricsAsync();

    // 同时更新工具的性能数据
    const tool = this.tools.get(toolName);
    if (tool) {
      tool.performance = perf;
      this.saveToolsAsync();
    }
  }

  /**
   * 获取工具性能
   */
  getPerformance(toolName: string): ToolPerformance | undefined {
    return this.metrics.get(toolName);
  }

  /**
   * 获取所有性能数据
   */
  getAllPerformance(): Map<string, ToolPerformance> {
    return new Map(this.metrics);
  }

  // ============== 配置访问 ==============

  /**
   * 获取系统配置
   */
  getSystemConfig(): SystemConfig {
    return { ...this.config };
  }

  /**
   * 更新系统配置 (异步批量写入)
   */
  updateSystemConfig(updates: Partial<SystemConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfigAsync();
  }

  // ============== 诊断配置访问 ==============

  /**
   * 获取诊断模式
   */
  getDiagnoseMode(): "manual" | "auto" | "both" {
    return this.config.diagnose.mode;
  }

  /**
   * 检查是否启用诊断功能
   */
  isDiagnoseEnabled(): boolean {
    return this.config.diagnose.enabled;
  }

  /**
   * 检查是否允许自动触发诊断
   */
  isAutoDiagnoseEnabled(): boolean {
    return this.config.diagnose.enabled && 
           (this.config.diagnose.mode === "auto" || this.config.diagnose.mode === "both");
  }

  /**
   * 检查是否允许手动触发诊断
   */
  isManualDiagnoseEnabled(): boolean {
    return this.config.diagnose.enabled && 
           (this.config.diagnose.mode === "manual" || this.config.diagnose.mode === "both");
  }

  /**
   * 设置诊断模式
   */
  setDiagnoseMode(mode: "manual" | "auto" | "both"): void {
    this.config.diagnose.mode = mode;
    this.saveConfigAsync();
  }

  /**
   * 更新诊断自动触发配置
   */
  updateAutoDiagnoseTriggers(triggers: Partial<SystemConfig["diagnose"]["autoTriggers"]>): void {
    this.config.diagnose.autoTriggers = {
      ...this.config.diagnose.autoTriggers,
      ...triggers,
    };
    this.saveConfigAsync();
  }

  /**
   * 获取数据目录
   */
  getDataDir(): string {
    return DATA_DIR;
  }
}

// 导出单例
export const configService = new ConfigService();