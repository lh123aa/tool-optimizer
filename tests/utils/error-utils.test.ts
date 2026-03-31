/**
 * error-utils 测试
 */
import { describe, it, expect } from "vitest";
import {
  getErrorMessage,
  getErrorStack,
  isNetworkError,
  isPermissionError,
  getRecoverySuggestion,
  createErrorResponse,
} from "../../src/utils/error-utils.js";

describe("error-utils", () => {
  // ============== getErrorMessage ==============
  describe("getErrorMessage", () => {
    it("应从 Error 对象提取消息", () => {
      const error = new Error("测试错误");
      expect(getErrorMessage(error)).toBe("测试错误");
    });

    it("应处理字符串错误", () => {
      expect(getErrorMessage("字符串错误")).toBe("字符串错误");
    });

    it("应处理未知类型", () => {
      expect(getErrorMessage(123)).toBe("123");
      expect(getErrorMessage(null)).toBe("null");
      expect(getErrorMessage(undefined)).toBe("undefined");
    });

    it("应处理包含复杂信息的对象", () => {
      const error = { code: "ENOENT", path: "/test" };
      expect(getErrorMessage(error)).toBe("[object Object]");
    });
  });

  // ============== getErrorStack ==============
  describe("getErrorStack", () => {
    it("应从 Error 对象提取堆栈", () => {
      const error = new Error("测试错误");
      const stack = getErrorStack(error);
      expect(stack).toBeDefined();
      expect(stack).toContain("测试错误");
    });

    it("应处理没有堆栈的错误", () => {
      const error = new Error("无堆栈");
      error.stack = undefined;
      expect(getErrorStack(error)).toBeUndefined();
    });

    it("应处理非 Error 对象", () => {
      expect(getErrorStack("字符串错误")).toBeUndefined();
      expect(getErrorStack(123)).toBeUndefined();
    });
  });

  // ============== isNetworkError ==============
  describe("isNetworkError", () => {
    it("应识别网络相关错误", () => {
      expect(isNetworkError(new Error("network error"))).toBe(true);
      expect(isNetworkError(new Error("timeout"))).toBe(true);
      expect(isNetworkError(new Error("ECONNREFUSED"))).toBe(true);
      expect(isNetworkError(new Error("ENOTFOUND"))).toBe(true);
      expect(isNetworkError(new Error("socket hang up"))).toBe(true);
    });

    it("应拒绝非网络错误", () => {
      expect(isNetworkError(new Error("permission denied"))).toBe(false);
      expect(isNetworkError(new Error("file not found"))).toBe(false);
    });

    it("应处理非 Error 对象", () => {
      expect(isNetworkError("network error")).toBe(false);
      expect(isNetworkError(123)).toBe(false);
    });
  });

  // ============== isPermissionError ==============
  describe("isPermissionError", () => {
    it("应识别权限相关错误", () => {
      expect(isPermissionError(new Error("permission denied"))).toBe(true);
      expect(isPermissionError(new Error("EACCES: permission denied"))).toBe(true);
      // EPERM 错误消息通常不包含 "eperm" 字符串，所以需要包含 permission
      expect(isPermissionError(new Error("EPERM: permission denied"))).toBe(true);
    });

    it("应拒绝非权限错误", () => {
      expect(isPermissionError(new Error("network error"))).toBe(false);
      expect(isPermissionError(new Error("timeout"))).toBe(false);
    });

    it("应处理非 Error 对象", () => {
      expect(isPermissionError("permission denied")).toBe(false);
      expect(isPermissionError(123)).toBe(false);
    });
  });

  // ============== getRecoverySuggestion ==============
  describe("getRecoverySuggestion", () => {
    it("应为网络错误提供网络建议", () => {
      const error = new Error("network error");
      expect(getRecoverySuggestion(error)).toContain("网络");
    });

    it("应为权限错误提供权限建议", () => {
      const error = new Error("permission denied");
      expect(getRecoverySuggestion(error)).toContain("权限");
    });

    it("应为其他错误提供通用建议", () => {
      const error = new Error("unknown error");
      expect(getRecoverySuggestion(error)).toContain("详细错误信息");
    });
  });

  // ============== createErrorResponse ==============
  describe("createErrorResponse", () => {
    it("应创建包含错误消息的响应", () => {
      const error = new Error("测试错误");
      const response = createErrorResponse(error);

      expect(response.content).toHaveLength(1);
      expect(response.content[0].type).toBe("text");

      const parsed = JSON.parse(response.content[0].text);
      expect(parsed.error).toBe("操作失败"); // 默认消息
      expect(parsed.message).toBe("测试错误");
    });

    it("应使用自定义默认消息", () => {
      const error = new Error("具体错误");
      const response = createErrorResponse(error, "自定义失败消息");

      const parsed = JSON.parse(response.content[0].text);
      expect(parsed.error).toBe("自定义失败消息");
      expect(parsed.message).toBe("具体错误");
    });

    it("应处理非 Error 类型的错误", () => {
      const response = createErrorResponse("字符串错误");

      const parsed = JSON.parse(response.content[0].text);
      expect(parsed.message).toBe("字符串错误");
    });

    it("应格式化 JSON 输出", () => {
      const error = new Error("测试");
      const response = createErrorResponse(error);

      // 验证 JSON 格式（2空格缩进）
      expect(response.content[0].text).toContain("\n");
    });
  });
});
