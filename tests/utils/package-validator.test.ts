/**
 * Package Validator 单元测试
 * 测试包名、Docker镜像名、工具名验证功能
 */
import { describe, it, expect } from "vitest";
import {
  validatePackageName,
  validateDockerImage,
  validateToolName,
  sanitizePackageName,
} from "../../src/utils/package-validator.js";

describe("package-validator", () => {
  // ============== validatePackageName ==============
  describe("validatePackageName", () => {
    it("应接受有效的普通包名", () => {
      expect(validatePackageName("axios").valid).toBe(true);
      expect(validatePackageName("lodash").valid).toBe(true);
      expect(validatePackageName("my-package").valid).toBe(true);
      expect(validatePackageName("my_package").valid).toBe(true);
      expect(validatePackageName("package123").valid).toBe(true);
    });

    it("应接受带scope的包名", () => {
      expect(validatePackageName("@types/node").valid).toBe(true);
      expect(validatePackageName("@babel/core").valid).toBe(true);
      expect(validatePackageName("@scope/package-name").valid).toBe(true);
    });

    it("应拒绝空包名", () => {
      expect(validatePackageName("").valid).toBe(false);
      expect(validatePackageName("   ").valid).toBe(false);
    });

    it("应拒绝 null 和 undefined", () => {
      expect(validatePackageName(null as any).valid).toBe(false);
      expect(validatePackageName(undefined as any).valid).toBe(false);
    });

    it("应拒绝过长的包名 (超过214字符)", () => {
      const longName = "a".repeat(215);
      expect(validatePackageName(longName).valid).toBe(false);
      expect(validatePackageName(longName).error).toContain("过长");
    });

    it("应拒绝包含shell特殊字符的包名", () => {
      const dangerousNames = [
        "package;rm -rf",
        "package&&echo",
        "package||exit",
        "package$(whoami)",
        "package`id`",
        "package>file",
        "package<file",
        "package|grep",
        "package&background",
        "package`command`",
      ];
      for (const name of dangerousNames) {
        expect(validatePackageName(name).valid).toBe(false);
      }
    });

    it("应拒绝危险关键词包名", () => {
      expect(validatePackageName("sudo-package").valid).toBe(false);
      expect(validatePackageName("evil-tool").valid).toBe(false);
      expect(validatePackageName("malicious-code").valid).toBe(false);
      expect(validatePackageName("hack-tool").valid).toBe(false);
      // rm -rf 需要空格分隔，rm-rf 不是危险关键词
      expect(validatePackageName("rm-rf-package").valid).toBe(true);
    });

    it("应拒绝参数注入模式 (--)", () => {
      expect(validatePackageName("package--evil-flag").valid).toBe(false);
      expect(validatePackageName("--help").valid).toBe(false);
    });

    it("应拒绝开头或结尾空白的包名", () => {
      expect(validatePackageName(" package").valid).toBe(false);
      expect(validatePackageName("package ").valid).toBe(false);
    });

    it("应拒绝无效的scoped包名格式", () => {
      expect(validatePackageName("@").valid).toBe(false);
      expect(validatePackageName("@/package").valid).toBe(false);
      expect(validatePackageName("@scope/").valid).toBe(false);
      expect(validatePackageName("@scope/package/extra").valid).toBe(false);
    });

    it("应返回ValidationResult结构", () => {
      const result = validatePackageName("axios");
      expect(typeof result.valid).toBe("boolean");
    });

    it("无效包名应包含error信息", () => {
      const result = validatePackageName("");
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // ============== validateDockerImage ==============
  describe("validateDockerImage", () => {
    it("应接受有效的Docker镜像名", () => {
      expect(validateDockerImage("nginx").valid).toBe(true);
      expect(validateDockerImage("nginx:latest").valid).toBe(true);
      expect(validateDockerImage("myregistry.com/nginx").valid).toBe(true);
      expect(validateDockerImage("myregistry.com/nginx:latest").valid).toBe(true);
      expect(validateDockerImage("my-image_v2.0").valid).toBe(true);
    });

    it("应接受带sha256的镜像", () => {
      expect(validateDockerImage("nginx@sha256:abc123").valid).toBe(true);
    });

    it("应拒绝空镜像名", () => {
      expect(validateDockerImage("").valid).toBe(false);
      expect(validateDockerImage("   ").valid).toBe(false);
    });

    it("应拒绝null和undefined", () => {
      expect(validateDockerImage(null as any).valid).toBe(false);
      expect(validateDockerImage(undefined as any).valid).toBe(false);
    });

    it("应拒绝无效格式的镜像名", () => {
      expect(validateDockerImage("image name").valid).toBe(false);
      expect(validateDockerImage("image|name").valid).toBe(false);
      expect(validateDockerImage("image;rm").valid).toBe(false);
    });

    it("应返回ValidationResult结构", () => {
      const result = validateDockerImage("nginx");
      expect(typeof result.valid).toBe("boolean");
    });
  });

  // ============== validateToolName ==============
  describe("validateToolName", () => {
    it("应接受有效的工具名", () => {
      expect(validateToolName("chrome-devtools").valid).toBe(true);
      expect(validateToolName("playwright").valid).toBe(true);
      expect(validateToolName("my_tool").valid).toBe(true);
      expect(validateToolName("tool123").valid).toBe(true);
    });

    it("应接受带scope的工具名", () => {
      expect(validateToolName("@user/tool").valid).toBe(true);
      expect(validateToolName("@org/tool-name").valid).toBe(true);
    });

    it("应拒绝空工具名", () => {
      expect(validateToolName("").valid).toBe(false);
      expect(validateToolName("   ").valid).toBe(false);
    });

    it("应拒绝null和undefined", () => {
      expect(validateToolName(null as any).valid).toBe(false);
      expect(validateToolName(undefined as any).valid).toBe(false);
    });

    it("应拒绝过长的工具名 (超过100字符)", () => {
      const longName = "a".repeat(101);
      expect(validateToolName(longName).valid).toBe(false);
      expect(validateToolName(longName).error).toContain("过长");
    });

    it("应拒绝包含特殊字符的工具名", () => {
      expect(validateToolName("tool name").valid).toBe(false);
      expect(validateToolName("tool;command").valid).toBe(false);
      expect(validateToolName("tool|pipe").valid).toBe(false);
    });

    it("应返回ValidationResult结构", () => {
      const result = validateToolName("tool");
      expect(typeof result.valid).toBe("boolean");
    });
  });

  // ============== sanitizePackageName ==============
  describe("sanitizePackageName", () => {
    it("应返回有效的原始包名", () => {
      expect(sanitizePackageName("axios")).toBe("axios");
      expect(sanitizePackageName("lodash")).toBe("lodash");
    });

    it("应移除空白", () => {
      expect(sanitizePackageName("  axios  ")).toBe("axios");
    });

    it("应返回null当输入为空", () => {
      expect(sanitizePackageName("")).toBeNull();
      expect(sanitizePackageName("   ")).toBeNull();
    });

    it("应返回null当输入为null或undefined", () => {
      expect(sanitizePackageName(null as any)).toBeNull();
      expect(sanitizePackageName(undefined as any)).toBeNull();
    });

    it("清理后无效的包名应返回null", () => {
      expect(sanitizePackageName(";;;")).toBeNull();
    });
  });
});
