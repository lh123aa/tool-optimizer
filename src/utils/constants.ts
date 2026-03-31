/**
 * 常量定义
 * 集中管理所有硬编码的魔法数字和字符串
 */

// ============== Registry API ==============
export const REGISTRY_API_BASE = "https://registry.modelcontextprotocol.io";
export const REGISTRY_API_TIMEOUT_MS = 10000;
export const REGISTRY_CACHE_TTL_MS = 1000 * 60 * 15; // 15 minutes
export const REGISTRY_MAX_CACHE_SIZE = 100;

// ============== NPM Registry (后备) ==============
export const NPM_REGISTRY_API = "https://registry.npmjs.org";
export const NPM_SEARCH_URL = "/-/v1/search";

// ============== 超时配置 ==============
export const INSTALL_TIMEOUT_MS = 120000;       // 2 分钟
export const UNINSTALL_TIMEOUT_MS = 60000;     // 1 分钟
export const TEST_TIMEOUT_MS = 30000;          // 30 秒
export const INSTALL_WAIT_MS = 2000;            // 安装后等待 2 秒

// ============== 评估权重 ==============
export const SCORE_WEIGHTS = {
  efficiency: 0.35,
  reliability: 0.25,
  features: 0.25,
  token: 0.15,
} as const;

// ============== 评估阈值 ==============
export const STAR_THRESHOLDS = {
  HIGH: 10000,
  MEDIUM: 1000,
  LOW: 100,
} as const;

export const FORK_THRESHOLDS = {
  HIGH: 1000,
  MEDIUM: 100,
} as const;

export const TOKEN_CONSUMPTION_THRESHOLDS = {
  LOW: 5000,
  MEDIUM: 8000,
  HIGH: 12000,
  VERY_HIGH: 20000,
} as const;

export const BASE_SCORE = 70;
export const NO_DATA_SCORE = 70;

// ============== 健康检查阈值 ==============
export const HEALTH_THRESHOLDS = {
  HEALTHY: 0.9,    // >= 90% 成功率
  DEGRADED: 0.7,   // >= 70% 成功率
} as const;

// ============== 日志配置 ==============
export const LOG_MAX_FILE_SIZE = 5 * 1024 * 1024;  // 5MB
export const LOG_FLUSH_INTERVAL_MS = 5000;            // 5 秒
export const LOG_MAX_ARCHIVES = 10;
export const LOG_RECENT_ERRORS_LIMIT = 10;
export const LOG_DEFAULT_QUERY_LIMIT = 100;
export const LOG_MAX_QUERY_LIMIT = 10000;

// ============== 系统配置 ==============
export const DEFAULT_CHECK_INTERVAL_MS = 1000 * 60 * 60;  // 1 小时
export const MIN_SCORE_DIFF = 10;  // 分数差大于 10 才建议升级

// ============== 工具分类 ==============
export const DEFAULT_CATEGORIES = [
  "browser",
  "filesystem",
  "git",
  "database",
  "web",
  "api",
  "communication",
  "development",
  "ai",
  "security",
] as const;

// ============== 默认值 ==============
export const DEFAULT_LICENSE = "Unknown";
export const DEFAULT_LANGUAGE = "Unknown";
export const DEFAULT_INSTALL_COMMAND = "npm";
export const DEFAULT_INSTALL_ARGS = ["install", "-g"];

// ============== 正则表达式 ==============
export const PACKAGE_NAME_REGEX = /^[a-zA-Z0-9@._-]+$/;
export const SCOPED_PACKAGE_REGEX = /^@[a-zA-Z0-9-~$]+\/[a-zA-Z0-9-~$]+$/;
export const DOCKER_IMAGE_REGEX = /^[a-zA-Z0-9._/-]+(:[a-zA-Z0-9._-]+)?(@sha256:[a-f0-9]+)?$/;
