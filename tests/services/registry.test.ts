/**
 * Registry Service 单元测试
 * 
 * 注意: 由于 RegistryService 直接创建 axios 实例,
 * 这里只测试不依赖 HTTP 的基础功能和默认行为
 */
import { describe, it, expect, beforeEach } from "vitest";
import { RegistryService } from "../../src/services/registry.js";

describe("RegistryService", () => {
  let registry: RegistryService;

  beforeEach(() => {
    registry = new RegistryService();
  });

  describe("search - 搜索功能", () => {
    it("search 方法应存在且可调用", () => {
      expect(typeof registry.search).toBe("function");
    });

    it("应返回数组", async () => {
      const result = await registry.search({ query: "test" }, 10);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("getDetails - 获取详情", () => {
    it("getDetails 方法应存在且可调用", () => {
      expect(typeof registry.getDetails).toBe("function");
    });

    it("不存在的工具应返回 null", async () => {
      const result = await registry.getDetails("nonexistent-tool-that-does-not-exist-12345");
      expect(result).toBeNull();
    });
  });

  describe("getPopular - 热门工具", () => {
    it("getPopular 方法应存在且可调用", () => {
      expect(typeof registry.getPopular).toBe("function");
    });

    it("应返回数组", async () => {
      const result = await registry.getPopular(10);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("getCategories - 分类列表", () => {
    it("getCategories 方法应存在且可调用", () => {
      expect(typeof registry.getCategories).toBe("function");
    });

    it("应返回默认分类数组", async () => {
      const result = await registry.getCategories();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain("browser");
    });
  });

  describe("findRelatedTools - 相关工具搜索", () => {
    it("findRelatedTools 方法应存在且可调用", () => {
      expect(typeof registry.findRelatedTools).toBe("function");
    });

    it("应返回数组", async () => {
      const result = await registry.findRelatedTools(["browser", "automation"]);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("compareTools - 工具对比", () => {
    it("compareTools 方法应存在且可调用", () => {
      expect(typeof registry.compareTools).toBe("function");
    });

    it("应返回包含 tool1 和 tool2 的对象", async () => {
      const result = await registry.compareTools("tool1", "tool2");
      expect(result).toHaveProperty("tool1");
      expect(result).toHaveProperty("tool2");
    });
  });

  describe("clearCache - 缓存管理", () => {
    it("clearCache 方法应存在且可调用", () => {
      expect(typeof registry.clearCache).toBe("function");
    });

    it("调用清除缓存不应抛出错误", () => {
      expect(() => registry.clearCache()).not.toThrow();
    });
  });
});