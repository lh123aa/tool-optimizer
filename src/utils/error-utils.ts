/**
 * 错误处理工具函数
 * 统一错误处理模式，减少重复代码
 */

/**
 * 从错误对象中提取消息字符串
 * @param error - 任意错误对象
 * @returns 错误消息字符串
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return String(error);
}

/**
 * 从错误对象中提取堆栈信息
 * @param error - 任意错误对象
 * @returns 堆栈字符串或 undefined
 */
export function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error && error.stack) {
    return error.stack;
  }
  return undefined;
}

/**
 * 统一的错误日志记录函数
 * @param category - 日志分类
 * @param message - 错误消息
 * @param error - 错误对象
 * @param context - 额外上下文
 * @param logger - 可选的日志服务 (避免循环依赖)
 */
export function logError(
  category: string,
  message: string,
  error: unknown,
  context?: Record<string, unknown>
): void {
  // 延迟导入避免循环依赖
  import("../services/logger.js").then(({ loggerService, LogCategory }) => {
    loggerService.error(LogCategory[category as keyof typeof LogCategory] || LogCategory.SYSTEM, message, {
      error: error instanceof Error ? error : new Error(getErrorMessage(error)),
      context,
      success: false,
    });
  }).catch(() => {
    // 日志服务不可用时输出到 console
    console.error(`[${category}] ${message}:`, error);
  });
}

/**
 * 创建标准化的工具错误响应
 * @param error - 错误对象
 * @param defaultMessage - 默认错误消息
 * @returns MCP 工具响应格式的错误对象
 */
export function createErrorResponse(
  error: unknown,
  defaultMessage: string = "操作失败"
): { content: Array<{ type: "text"; text: string }> } {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          error: defaultMessage,
          message: getErrorMessage(error),
        }, null, 2),
      },
    ],
  };
}

/**
 * 检查是否为网络错误
 * @param error - 错误对象
 * @returns 是否为网络错误
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("network") ||
      message.includes("timeout") ||
      message.includes("econnrefused") ||
      message.includes("enotfound") ||
      message.includes("socket")
    );
  }
  return false;
}

/**
 * 检查是否为权限错误
 * @param error - 错误对象
 * @returns 是否为权限错误
 */
export function isPermissionError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("permission") ||
      message.includes("eacces") ||
      message.includes("epERM") ||
      message.includes("sudo")
    );
  }
  return false;
}

/**
 * 错误恢复建议
 * @param error - 错误对象
 * @returns 建议的恢复操作
 */
export function getRecoverySuggestion(error: unknown): string {
  if (isNetworkError(error)) {
    return "请检查网络连接后重试";
  }
  if (isPermissionError(error)) {
    return "请检查权限设置，或使用 sudo 重试";
  }
  return "请查看详细错误信息或联系开发者";
}
