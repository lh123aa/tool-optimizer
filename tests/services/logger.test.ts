/**
 * Logger Service 单元测试
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { LoggerService, LogLevel, LogCategory } from "../../src/services/logger.js";

// Mock fs module
vi.mock("fs", () => ({
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(() => ""),
  writeFileSync: vi.fn(),
  appendFileSync: vi.fn(),
  statSync: vi.fn(() => ({ size: 100 })),
  readdirSync: vi.fn(() => []),
  unlinkSync: vi.fn(),
}));

describe("LoggerService", () => {
  let logger: LoggerService;

  beforeEach(() => {
    logger = new LoggerService();
    // 重置 mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    logger.shutdown();
  });

  describe("基础日志记录", () => {
    it("应正确创建 debug 日志条目", () => {
      const entry = logger.debug(LogCategory.SYSTEM, "测试 debug 消息");
      
      expect(entry).toBeDefined();
      expect(entry.level).toBe(LogLevel.DEBUG);
      expect(entry.levelName).toBe("DEBUG");
      expect(entry.category).toBe(LogCategory.SYSTEM);
      expect(entry.message).toBe("测试 debug 消息");
      expect(entry.id).toBeDefined();
      expect(entry.timestamp).toBeDefined();
    });

    it("应正确创建 info 日志条目", () => {
      const entry = logger.info(LogCategory.TOOL_OPERATION, "工具操作信息");
      
      expect(entry.level).toBe(LogLevel.INFO);
      expect(entry.levelName).toBe("INFO");
      expect(entry.category).toBe(LogCategory.TOOL_OPERATION);
    });

    it("应正确创建 warn 日志条目", () => {
      const entry = logger.warn(LogCategory.REGISTRY, "警告消息");
      
      expect(entry.level).toBe(LogLevel.WARN);
      expect(entry.levelName).toBe("WARN");
    });

    it("应正确创建 error 日志条目", () => {
      const error = new Error("测试错误");
      const entry = logger.error(LogCategory.CONFIG, "错误消息", { error });
      
      expect(entry.level).toBe(LogLevel.ERROR);
      expect(entry.levelName).toBe("ERROR");
      expect(entry.error).toBeDefined();
      expect(entry.error?.message).toBe("测试错误");
      expect(entry.error?.name).toBe("Error");
    });

    it("应包含 securityAlert 标记", () => {
      const entry = logger.warn(LogCategory.SECURITY, "安全警告", { 
        securityAlert: true 
      });
      
      expect(entry.securityAlert).toBe(true);
    });
  });

  describe("带上下文的日志", () => {
    it("应正确记录工具名称", () => {
      const entry = logger.info(LogCategory.TOOL_OPERATION, "操作进行中", {
        toolName: "playwright-mcp"
      });
      
      expect(entry.toolName).toBe("playwright-mcp");
    });

    it("应正确记录操作耗时", () => {
      const entry = logger.info(LogCategory.UPGRADE, "升级完成", {
        duration: 1500
      });
      
      expect(entry.duration).toBe(1500);
    });

    it("应正确记录操作成功状态", () => {
      const successEntry = logger.operationEnd(LogCategory.INSTALL, "安装", undefined, 1000, true);
      const failEntry = logger.operationEnd(LogCategory.INSTALL, "安装", undefined, 1000, false);
      
      expect(successEntry.success).toBe(true);
      expect(failEntry.success).toBe(false);
    });

    it("应正确记录额外上下文", () => {
      const context = { 
        version: "1.0.0", 
        retryCount: 3,
        nested: { key: "value" }
      };
      const entry = logger.info(LogCategory.SEARCH, "搜索结果", { context });
      
      expect(entry.context).toEqual(context);
    });
  });

  describe("操作便捷方法", () => {
    it("operationStart 应创建 info 级别日志", () => {
      const entry = logger.operationStart(
        LogCategory.UPGRADE, 
        "升级工具", 
        "test-tool",
        { fromVersion: "1.0.0", toVersion: "2.0.0" }
      );
      
      expect(entry.level).toBe(LogLevel.INFO);
      expect(entry.toolName).toBe("test-tool");
      expect(entry.message).toContain("开始: 升级工具");
      expect(entry.context).toBeDefined();
    });

    it("operationEnd 成功时应创建 info 级别日志", () => {
      const entry = logger.operationEnd(
        LogCategory.UPGRADE,
        "升级工具",
        "test-tool",
        2000,
        true
      );
      
      expect(entry.level).toBe(LogLevel.INFO);
      expect(entry.message).toContain("完成: 升级工具");
      expect(entry.duration).toBe(2000);
      expect(entry.success).toBe(true);
    });

    it("operationEnd 失败时应创建 error 级别日志", () => {
      const entry = logger.operationEnd(
        LogCategory.UPGRADE,
        "升级工具",
        "test-tool",
        500,
        false
      );
      
      expect(entry.level).toBe(LogLevel.ERROR);
      expect(entry.message).toContain("失败: 升级工具");
      expect(entry.success).toBe(false);
    });

    it("toolError 应记录工具错误", () => {
      const error = new Error("Connection failed");
      const entry = logger.toolError(
        "browser-automation",
        "连接浏览器",
        error,
        { timeout: 30000 }
      );
      
      expect(entry.level).toBe(LogLevel.ERROR);
      expect(entry.category).toBe(LogCategory.TOOL_OPERATION);
      expect(entry.toolName).toBe("browser-automation");
      expect(entry.message).toContain("工具错误");
      expect(entry.error).toBeDefined();
      expect(entry.success).toBe(false);
    });
  });

  describe("日志分类", () => {
    it("应支持所有定义的分类", () => {
      const categories = [
        LogCategory.TOOL_OPERATION,
        LogCategory.INSTALL,
        LogCategory.UPGRADE,
        LogCategory.UNINSTALL,
        LogCategory.SEARCH,
        LogCategory.COMPARE,
        LogCategory.HEALTH,
        LogCategory.REGISTRY,
        LogCategory.CONFIG,
        LogCategory.SYSTEM,
        LogCategory.SECURITY,
      ];

      for (const category of categories) {
        const entry = logger.info(category, `测试分类: ${category}`);
        expect(entry.category).toBe(category);
      }
    });
  });

  describe("路径获取", () => {
    it("getLogFilePath 应返回日志文件路径", () => {
      const path = logger.getLogFilePath();
      expect(path).toBeDefined();
      expect(path).toContain("tool-optimizer.log");
    });

    it("getLogDir 应返回日志目录路径", () => {
      const dir = logger.getLogDir();
      expect(dir).toBeDefined();
      expect(dir).toContain(".tool-optimizer-mcp");
    });
  });
});