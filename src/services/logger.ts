/**
 * 日志服务
 * 记录系统运行中的问题，用于迭代升级
 * 
 * 功能:
 * - 分级日志 (error, warn, info, debug)
 * - 结构化日志存储
 * - 自动归档旧日志
 * - 问题追踪
 * - 错误日志即时写入 (防止崩溃丢失)
 * - 进程退出时自动刷新
 */

import { randomUUID } from "crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, statSync, readdirSync, unlinkSync } from "fs";
import { join } from "path";
import { homedir } from "os";

// 日志级别
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

// 日志分类
export enum LogCategory {
  TOOL_OPERATION = "tool_operation",     // 工具操作
  INSTALL = "install",                     // 安装相关
  UPGRADE = "upgrade",                     // 升级相关
  UNINSTALL = "uninstall",                 // 卸载相关
  SEARCH = "search",                       // 搜索相关
  COMPARE = "compare",                     // 对比相关
  HEALTH = "health",                       // 健康检查
  REGISTRY = "registry",                   // Registry API
  CONFIG = "config",                       // 配置相关
  SYSTEM = "system",                       // 系统相关
  SECURITY = "security",                   // 安全相关
}

// 日志条目
export interface LogEntry {
  id: string;                    // 唯一 ID
  timestamp: string;             // ISO 时间戳
  level: LogLevel;               // 日志级别
  levelName: string;            // 级别名称
  category: LogCategory;        // 分类
  message: string;               // 日志消息
  toolName?: string;            // 相关工具名
  error?: {                     // 错误信息
    name: string;
    message: string;
    stack?: string;
  };
  context?: Record<string, unknown>;  // 额外上下文
  duration?: number;             // 操作耗时 (ms)
  success?: boolean;            // 操作是否成功
  securityAlert?: boolean;     // 安全警告标记
}

// 日志统计
export interface LogStats {
  total: number;
  errorCount: number;
  warnCount: number;
  infoCount: number;
  debugCount: number;
  byCategory: Record<string, number>;
  recentErrors: LogEntry[];
}

// 日志服务类
export class LoggerService {
  private logDir: string;
  private logFile: string;
  private errorLogFile: string;  // 独立的错误日志文件
  private archiveDir: string;
  private maxFileSize: number = 5 * 1024 * 1024; // 5MB
  private maxArchives: number = 10;
  private currentLevel: LogLevel = LogLevel.INFO;
  private logBuffer: LogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly FLUSH_INTERVAL_MS = 5000; // 5秒刷新一次

  constructor() {
    this.logDir = join(homedir(), ".tool-optimizer-mcp/logs");
    this.logFile = join(this.logDir, "tool-optimizer.log");
    this.errorLogFile = join(this.logDir, "errors.log");  // 独立错误日志
    this.archiveDir = join(this.logDir, "archive");

    this.ensureLogDir();
    this.startFlushTimer();
    this.setupExitHandler();
  }

  /**
   * 设置进程退出处理器，确保日志被刷新
   */
  private setupExitHandler(): void {
    // 确保进程退出前刷新所有日志
    const flushOnExit = () => {
      this.flush();
    };

    process.on("beforeExit", flushOnExit);
    process.on("exit", flushOnExit);

    // 处理未捕获的异常
    process.on("uncaughtException", (error) => {
      this.error(LogCategory.SYSTEM, "未捕获的异常", { error });
      this.flush();
    });

    process.on("unhandledRejection", (reason) => {
      this.error(LogCategory.SYSTEM, "未处理的 Promise 拒绝", { 
        context: { reason: String(reason) } 
      });
      this.flush();
    });
  }

  /**
   * 确保日志目录存在
   */
  private ensureLogDir(): void {
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true });
    }
    if (!existsSync(this.archiveDir)) {
      mkdirSync(this.archiveDir, { recursive: true });
    }
  }

  /**
   * 启动定时刷新
   */
  private startFlushTimer(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flushInterval = setInterval(() => {
      this.flush();
    }, this.FLUSH_INTERVAL_MS);
  }

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    return `log_${Date.now()}_${randomUUID()}`;
  }

  /**
   * 获取级别名称
   */
  private getLevelName(level: LogLevel): string {
    return LogLevel[level];
  }

  /**
   * 写入日志文件
   */
  private writeToFile(entry: LogEntry, alsoToErrorFile: boolean = false): void {
    try {
      // 检查文件大小
      if (existsSync(this.logFile)) {
        const stats = statSync(this.logFile);
        if (stats.size >= this.maxFileSize) {
          this.rotateLog();
        }
      }

      // 序列化日志条目
      const line = JSON.stringify(entry) + "\n";

      // 写入主日志文件
      appendFileSync(this.logFile, line, "utf-8");

      // 如果是错误或安全相关，写入独立错误日志
      if (alsoToErrorFile || entry.level >= LogLevel.ERROR) {
        appendFileSync(this.errorLogFile, line, "utf-8");
      }
    } catch (error) {
      console.error("[Logger] 写入日志文件失败:", error);
    }
  }

  /**
   * 轮转日志
   */
  private rotateLog(): void {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const archiveFile = join(this.archiveDir, `tool-optimizer_${timestamp}.log`);

      // 移动当前日志到归档
      const content = existsSync(this.logFile) ? readFileSync(this.logFile, "utf-8") : "";
      writeFileSync(archiveFile, content, "utf-8");

      // 清空当前日志
      writeFileSync(this.logFile, "", "utf-8");

      // 清理旧归档
      this.cleanArchives();
    } catch (error) {
      console.error("[Logger] 日志轮转失败:", error);
    }
  }

  /**
   * 清理旧归档
   */
  private cleanArchives(): void {
    try {
      const files = readdirSync(this.archiveDir)
        .filter((f: string) => f.endsWith(".log"))
        .sort()
        .reverse();

      // 删除超过数量的旧归档
      for (let i = this.maxArchives; i < files.length; i++) {
        unlinkSync(join(this.archiveDir, files[i]));
      }
    } catch (error) {
      // 清理归档失败不影响主流程，仅输出警告
      console.warn("[Logger] 清理旧归档失败:", error);
    }
  }

  /**
   * 刷新缓冲区 - 同步写入所有缓冲的日志
   */
  private flush(): void {
    if (this.logBuffer.length === 0) return;

    const entries = [...this.logBuffer];
    this.logBuffer = [];

    for (const entry of entries) {
      // 所有日志都写入文件，错误日志额外写入 errorLogFile
      this.writeToFile(entry, entry.level >= LogLevel.ERROR);
    }
  }

  /**
   * 创建日志条目
   */
  private createEntry(
    level: LogLevel,
    category: LogCategory,
    message: string,
    options?: {
      toolName?: string;
      error?: Error;
      context?: Record<string, unknown>;
      duration?: number;
      success?: boolean;
      securityAlert?: boolean;
    }
  ): LogEntry {
    const entry: LogEntry = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      level,
      levelName: this.getLevelName(level),
      category,
      message,
      ...(options?.toolName && { toolName: options.toolName }),
      ...(options?.error && {
        error: {
          name: options.error.name,
          message: options.error.message,
          stack: options.error.stack,
        },
      }),
      ...(options?.context && { context: options.context }),
      ...(options?.duration !== undefined && { duration: options.duration }),
      ...(options?.success !== undefined && { success: options.success }),
      ...(options?.securityAlert !== undefined && { securityAlert: options.securityAlert }),
    };

    return entry;
  }

  /**
   * 记录日志
   */
  private log(
    level: LogLevel,
    category: LogCategory,
    message: string,
    options?: {
      toolName?: string;
      error?: Error;
      context?: Record<string, unknown>;
      duration?: number;
      success?: boolean;
      securityAlert?: boolean;
    }
  ): LogEntry {
    const entry = this.createEntry(level, category, message, options);

    // 输出到控制台 (用于调试)
    const consoleMsg = `[${entry.timestamp}] [${entry.levelName}] [${entry.category}] ${message}`;
    if (level === LogLevel.ERROR) {
      console.error(consoleMsg, options?.error ? `\n${options.error.stack}` : "");
    } else if (level === LogLevel.WARN) {
      console.warn(consoleMsg);
    } else if (level === LogLevel.DEBUG) {
      console.debug(consoleMsg);
    } else {
      console.log(consoleMsg);
    }

    // 添加到缓冲区
    this.logBuffer.push(entry);

    // 如果是错误级别或安全告警，立即同步写入 (防止崩溃丢失)
    if (level === LogLevel.ERROR || options?.securityAlert) {
      this.writeToFile(entry, true);
    }

    return entry;
  }

  /**
   * 调试日志
   */
  debug(
    category: LogCategory,
    message: string,
    options?: {
      toolName?: string;
      error?: Error;
      context?: Record<string, unknown>;
      duration?: number;
      success?: boolean;
      securityAlert?: boolean;
    }
  ): LogEntry {
    if (this.currentLevel > LogLevel.DEBUG) {
      return this.createEntry(LogLevel.DEBUG, category, message, options);
    }
    return this.log(LogLevel.DEBUG, category, message, options);
  }

  /**
   * 信息日志
   */
  info(
    category: LogCategory,
    message: string,
    options?: {
      toolName?: string;
      error?: Error;
      context?: Record<string, unknown>;
      duration?: number;
      success?: boolean;
      securityAlert?: boolean;
    }
  ): LogEntry {
    if (this.currentLevel > LogLevel.INFO) {
      return this.createEntry(LogLevel.INFO, category, message, options);
    }
    return this.log(LogLevel.INFO, category, message, options);
  }

  /**
   * 警告日志
   */
  warn(
    category: LogCategory,
    message: string,
    options?: {
      toolName?: string;
      error?: Error;
      context?: Record<string, unknown>;
      duration?: number;
      success?: boolean;
      securityAlert?: boolean;
    }
  ): LogEntry {
    if (this.currentLevel > LogLevel.WARN) {
      return this.createEntry(LogLevel.WARN, category, message, options);
    }
    return this.log(LogLevel.WARN, category, message, options);
  }

  /**
   * 错误日志
   */
  error(
    category: LogCategory,
    message: string,
    options?: {
      toolName?: string;
      error?: Error;
      context?: Record<string, unknown>;
      duration?: number;
      success?: boolean;
      securityAlert?: boolean;
    }
  ): LogEntry {
    return this.log(LogLevel.ERROR, category, message, options);
  }

  /**
   * 记录操作开始
   */
  operationStart(
    category: LogCategory,
    operation: string,
    toolName?: string,
    context?: Record<string, unknown>
  ): LogEntry {
    return this.info(category, `开始: ${operation}`, { toolName, context });
  }

  /**
   * 记录操作完成
   */
  operationEnd(
    category: LogCategory,
    operation: string,
    toolName?: string,
    duration?: number,
    success: boolean = true
  ): LogEntry {
    const msg = success ? `完成: ${operation}` : `失败: ${operation}`;
    return this.log(
      success ? LogLevel.INFO : LogLevel.ERROR,
      category,
      msg,
      { toolName, duration, success }
    );
  }

  /**
   * 记录工具错误
   */
  toolError(
    toolName: string,
    operation: string,
    error: Error,
    context?: Record<string, unknown>
  ): LogEntry {
    return this.error(LogCategory.TOOL_OPERATION, `工具错误: ${toolName} - ${operation}`, {
      toolName,
      error,
      context,
      success: false,
    });
  }

  /**
   * 获取日志统计
   */
  getStats(): LogStats {
    const stats: LogStats = {
      total: 0,
      errorCount: 0,
      warnCount: 0,
      infoCount: 0,
      debugCount: 0,
      byCategory: {},
      recentErrors: [],
    };

    try {
      if (!existsSync(this.logFile)) {
        return stats;
      }

      const content = readFileSync(this.logFile, "utf-8");
      const lines = content.split("\n").filter((line: string) => line.trim());

      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as LogEntry;
          stats.total++;

          // 统计级别
          switch (entry.level) {
            case LogLevel.ERROR:
              stats.errorCount++;
              stats.recentErrors.push(entry);
              if (stats.recentErrors.length > 10) {
                stats.recentErrors.shift();
              }
              break;
            case LogLevel.WARN:
              stats.warnCount++;
              break;
            case LogLevel.INFO:
              stats.infoCount++;
              break;
            case LogLevel.DEBUG:
              stats.debugCount++;
              break;
          }

          // 统计分类
          if (!stats.byCategory[entry.category]) {
            stats.byCategory[entry.category] = 0;
          }
          stats.byCategory[entry.category]++;
        } catch {
          // 忽略解析错误
        }
      }
    } catch {
      // 忽略读取错误
    }

    return stats;
  }

  /**
   * 获取最近的日志
   */
  getRecentLogs(limit: number = 100, level?: LogLevel): LogEntry[] {
    const entries: LogEntry[] = [];

    try {
      if (!existsSync(this.logFile)) {
        return entries;
      }

      const content = readFileSync(this.logFile, "utf-8");
      const lines = content.split("\n").filter((line: string) => line.trim());

      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as LogEntry;
          if (level === undefined || entry.level >= level) {
            entries.push(entry);
          }
        } catch {
          // 忽略解析错误
        }
      }
    } catch {
      // 忽略读取错误
    }

    // 返回最近的日志
    return entries.slice(-limit);
  }

  /**
   * 获取错误日志 (从专门的错误日志文件)
   */
  getErrorLogs(limit: number = 50): LogEntry[] {
    const entries: LogEntry[] = [];

    try {
      if (!existsSync(this.errorLogFile)) {
        // fallback 到主日志文件
        return this.getRecentLogs(limit, LogLevel.ERROR);
      }

      const content = readFileSync(this.errorLogFile, "utf-8");
      const lines = content.split("\n").filter((line: string) => line.trim());

      for (const line of lines) {
        try {
          entries.push(JSON.parse(line) as LogEntry);
        } catch {
          // 忽略解析错误
        }
      }
    } catch {
      // 忽略读取错误
    }

    return entries.slice(-limit);
  }

  /**
   * 获取工具相关日志
   */
  getToolLogs(toolName: string, limit: number = 50): LogEntry[] {
    const allLogs = this.getRecentLogs(limit * 2);
    return allLogs
      .filter((entry) => entry.toolName === toolName)
      .slice(0, limit);
  }

  /**
   * 搜索日志
   */
  searchLogs(keyword: string, limit: number = 100): LogEntry[] {
    const allLogs = this.getRecentLogs(limit * 3);
    const lowerKeyword = keyword.toLowerCase();
    return allLogs
      .filter(
        (entry) =>
          entry.message.toLowerCase().includes(lowerKeyword) ||
          entry.toolName?.toLowerCase().includes(lowerKeyword) ||
          entry.category.toLowerCase().includes(lowerKeyword)
      )
      .slice(0, limit);
  }

  /**
   * 导出日志
   */
  exportLogs(
    startDate?: string,
    endDate?: string,
    level?: LogLevel,
    category?: LogCategory
  ): LogEntry[] {
    const allLogs = this.getRecentLogs(10000, level);
    return allLogs.filter((entry) => {
      // 日期过滤
      if (startDate && entry.timestamp < startDate) return false;
      if (endDate && entry.timestamp > endDate) return false;
      // 分类过滤
      if (category && entry.category !== category) return false;
      return true;
    });
  }

  /**
   * 获取日志文件路径
   */
  getLogFilePath(): string {
    return this.logFile;
  }

  /**
   * 获取错误日志文件路径
   */
  getErrorLogFilePath(): string {
    return this.errorLogFile;
  }

  /**
   * 获取日志目录
   */
  getLogDir(): string {
    return this.logDir;
  }

  /**
   * 清理日志
   */
  clearLogs(): void {
    try {
      if (existsSync(this.logFile)) {
        writeFileSync(this.logFile, "", "utf-8");
      }
      if (existsSync(this.errorLogFile)) {
        writeFileSync(this.errorLogFile, "", "utf-8");
      }
      this.info(LogCategory.SYSTEM, "日志已清空");
    } catch (error) {
      this.error(LogCategory.SYSTEM, "清空日志失败", { error: error as Error });
    }
  }

  /**
   * 关闭服务
   */
  shutdown(): void {
    this.flush();
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }
}

// 导出单例
export const loggerService = new LoggerService();