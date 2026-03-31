/**
 * Config Service 单元测试
 * 
 * 注意: 由于 ConfigService 直接操作文件系统,
 * 这里主要测试不依赖文件系统的静态方法和接口
 */
import { describe, it, expect } from "vitest";
import { configService } from "../../src/services/config.js";

describe("ConfigService", () => {
  describe("getAllTools - 获取工具列表", () => {
    it("getAllTools 方法应存在且可调用", () => {
      expect(typeof configService.getAllTools).toBe("function");
    });

    it("应返回数组", () => {
      const result = configService.getAllTools();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("getTool - 获取单个工具", () => {
    it("getTool 方法应存在且可调用", () => {
      expect(typeof configService.getTool).toBe("function");
    });
  });

  describe("setTool - 设置工具", () => {
    it("setTool 方法应存在且可调用", () => {
      expect(typeof configService.setTool).toBe("function");
    });
  });

  describe("removeTool - 移除工具", () => {
    it("removeTool 方法应存在且可调用", () => {
      expect(typeof configService.removeTool).toBe("function");
    });
  });

  describe("archiveTool - 归档工具", () => {
    it("archiveTool 方法应存在且可调用", () => {
      expect(typeof configService.archiveTool).toBe("function");
    });
  });

  describe("getArchivedTools - 获取归档列表", () => {
    it("getArchivedTools 方法应存在且可调用", () => {
      expect(typeof configService.getArchivedTools).toBe("function");
    });

    it("应返回数组", () => {
      const result = configService.getArchivedTools();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("restoreTool - 恢复工具", () => {
    it("restoreTool 方法应存在且可调用", () => {
      expect(typeof configService.restoreTool).toBe("function");
    });
  });

  describe("getSystemConfig - 获取系统配置", () => {
    it("getSystemConfig 方法应存在且可调用", () => {
      expect(typeof configService.getSystemConfig).toBe("function");
    });

    it("应返回对象", () => {
      const result = configService.getSystemConfig();
      expect(typeof result).toBe("object");
    });

    it("配置应包含必要的属性", () => {
      const config = configService.getSystemConfig();
      expect(config).toHaveProperty("monitor");
      expect(config).toHaveProperty("evaluation");
      expect(config).toHaveProperty("install");
      expect(config).toHaveProperty("notification");
    });

    it("install 配置应包含 npmRegistry 默认值", () => {
      const config = configService.getSystemConfig();
      expect(config.install.npmRegistry).toBe("https://registry.npmjs.org");
    });
  });
});
