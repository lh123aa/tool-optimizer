/**
 * 包名验证工具
 * 用于验证 npm 包名安全性，防止命令注入
 */

import { loggerService, LogCategory } from "../services/logger.js";

/**
 * 允许的字符: a-z, A-Z, 0-9, @, ., _, -
 * npm 包名规范: https://docs.npmjs.com/cli/v7/configuring-npm/package-json#name
 */
const VALID_PACKAGE_NAME_REGEX = /^[a-zA-Z0-9@._-]+$/;

/**
 * 禁止的模式 (命令注入风险)
 */
const FORBIDDEN_PATTERNS = [
  /[;&|`$>(){}[\]\\]/,           // shell 特殊字符
  /^\s/,                           // 开头空白
  /\s$/,                           // 结尾空白
  /--/,                            // 参数注入 (如 --evil-flag)
  /&&/,                            // 命令链接
  /\|\|/,                          // 条件执行
  /;/,                             // 命令分隔
  /\$\(/,                          // 子shell
  /`/,                             // 命令替换
  />/,                             // 输出重定向
  /</,                             // 输入重定向
];

/**
 * 危险的包名关键词 (社工攻击)
 */
const DANGEROUS_KEYWORDS = [
  "sudo",
  "root",
  "admin",
  "evil",
  "malicious",
  "hack",
  "bypass",
  "injection",
  "rm -rf",
  "format",
];

export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitized?: string;
}

/**
 * 验证包名安全性
 * @param packageName - 待验证的包名
 * @returns 验证结果
 */
export function validatePackageName(packageName: string): ValidationResult {
  // 空检查
  if (!packageName || typeof packageName !== "string") {
    return {
      valid: false,
      error: "包名不能为空",
    };
  }

  // 长度检查
  if (packageName.length > 214) {
    return {
      valid: false,
      error: "包名过长 (最大 214 字符)",
    };
  }

  // 检查禁止的模式 (shell 注入风险)
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(packageName)) {
      loggerService.warn(LogCategory.SECURITY, `包名包含危险字符: ${packageName}`, {
        context: { packageName, pattern: pattern.source },
        securityAlert: true,
      });
      return {
        valid: false,
        error: `包名包含危险字符`,
      };
    }
  }

  // 检查 scoped package 格式 (@scope/package) - 优先处理，避免后续正则检查失败
  if (packageName.startsWith("@")) {
    const parts = packageName.split("/");
    if (parts.length !== 2 || !parts[0].match(/^@[a-zA-Z0-9-~$]+$/) || !parts[1].match(/^[a-zA-Z0-9-~$]+$/)) {
      return {
        valid: false,
        error: "scoped 包名格式不正确",
      };
    }
    // scoped package 通过 scope 检查，继续检查危险关键词
  } else {
    // 非 scoped package 检查基本格式
    if (!VALID_PACKAGE_NAME_REGEX.test(packageName)) {
      return {
        valid: false,
        error: "包名格式不正确 (只能包含字母、数字、@、.、_、-)",
      };
    }
  }

  // 检查危险关键词 (在scope检查之后，避免误杀)
  const lowerName = packageName.toLowerCase();
  for (const keyword of DANGEROUS_KEYWORDS) {
    if (lowerName.includes(keyword)) {
      loggerService.warn(LogCategory.SECURITY, `包名包含危险关键词: ${keyword}`, {
        context: { packageName, keyword },
        securityAlert: true,
      });
      return {
        valid: false,
        error: `包名包含危险关键词: ${keyword}`,
      };
    }
  }

  return { valid: true };
}

/**
 * 验证 Docker 镜像名
 * @param imageName - 待验证的镜像名
 * @returns 验证结果
 */
export function validateDockerImage(imageName: string): ValidationResult {
  if (!imageName || typeof imageName !== "string") {
    return {
      valid: false,
      error: "镜像名不能为空",
    };
  }

  // Docker 镜像名格式检查
  // 允许: registry/name:tag, registry/name@sha256:digest, name:tag
  const dockerPattern = /^[a-zA-Z0-9._/-]+(:[a-zA-Z0-9._-]+)?(@sha256:[a-f0-9]+)?$/;
  
  if (!dockerPattern.test(imageName)) {
    return {
      valid: false,
      error: "Docker 镜像名格式不正确",
    };
  }

  return { valid: true };
}

/**
 * 验证工具名称 (用于配置中)
 * @param toolName - 待验证的工具名
 * @returns 验证结果
 */
export function validateToolName(toolName: string): ValidationResult {
  if (!toolName || typeof toolName !== "string") {
    return {
      valid: false,
      error: "工具名不能为空",
    };
  }

  // 检查 scoped package 格式 (@scope/package)
  if (toolName.startsWith("@")) {
    const parts = toolName.split("/");
    if (parts.length !== 2 || !parts[0].match(/^@[a-zA-Z0-9-~$]+$/) || !parts[1].match(/^[a-zA-Z0-9-~$]+$/)) {
      return {
        valid: false,
        error: "工具名格式不正确",
      };
    }
    return { valid: true };
  }

  // 工具名应该比较宽松，但也需要限制特殊字符
  const toolNamePattern = /^[a-zA-Z0-9._-]+$/;
  
  if (!toolNamePattern.test(toolName)) {
    return {
      valid: false,
      error: "工具名格式不正确",
    };
  }

  if (toolName.length > 100) {
    return {
      valid: false,
      error: "工具名过长",
    };
  }

  return { valid: true };
}

/**
 * 清理并规范化包名
 * @param packageName - 原始包名
 * @returns 清理后的包名或 null
 */
export function sanitizePackageName(packageName: string): string | null {
  if (!packageName || typeof packageName !== "string") {
    return null;
  }

  // 移除空白
  let sanitized = packageName.trim();

  // 移除危险字符
  for (const pattern of FORBIDDEN_PATTERNS) {
    sanitized = sanitized.replace(pattern, "");
  }

  // 如果清理后为空或无效，返回 null
  if (!sanitized || !VALID_PACKAGE_NAME_REGEX.test(sanitized)) {
    return null;
  }

  return sanitized;
}
