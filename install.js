/**
 * Tool Optimizer MCP 安装脚本
 * 
 * 运行此脚本进行一键安装：
 * 1. 安装依赖
 * 2. 构建项目
 * 3. 添加到 OpenCode 配置
 * 
 * 用法: node install.js
 */

import { execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { homedir } from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectDir = __dirname;

// 颜色输出
const colors = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  reset: "\x1b[0m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  console.log(`\n${colors.blue}[${step}]${colors.reset} ${message}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, "green");
}

function logError(message) {
  log(`❌ ${message}`, "red");
}

function logWarning(message) {
  log(`⚠️  ${message}`, "yellow");
}

// 主安装函数
async function install() {
  log("Tool Optimizer MCP - 安装程序", "blue");
  log("=".repeat(50), "blue");

  try {
    // 1. 检查 Node.js
    logStep(1, "检查 Node.js 环境...");
    try {
      const nodeVersion = execSync("node --version", { encoding: "utf-8" }).trim();
      logSuccess(`Node.js 版本: ${nodeVersion}`);
    } catch {
      logError("未安装 Node.js，请先安装 https://nodejs.org/");
      process.exit(1);
    }

    // 2. 安装依赖
    logStep(2, "安装项目依赖...");
    try {
      execSync("npm install", {
        cwd: projectDir,
        stdio: "inherit",
      });
      logSuccess("依赖安装完成");
    } catch (error) {
      logError("依赖安装失败");
      process.exit(1);
    }

    // 3. 构建项目
    logStep(3, "构建项目...");
    try {
      execSync("npm run build", {
        cwd: projectDir,
        stdio: "inherit",
      });
      logSuccess("项目构建完成");
    } catch (error) {
      logError("项目构建失败");
      process.exit(1);
    }

    // 4. 配置 OpenCode
    logStep(4, "配置 OpenCode MCP...");
    const opencodeConfigPath = join(homedir(), ".config/opencode/opencode.json");
    const mcpEntry = {
      command: "node",
      args: [join(projectDir, "dist/index.js").replace(/\\/g, "/")],
      enabled: true,
      type: "local",
    };

    let opencodeConfig = {};
    if (existsSync(opencodeConfigPath)) {
      try {
        opencodeConfig = JSON.parse(readFileSync(opencodeConfigPath, "utf-8"));
        log("找到现有 OpenCode 配置", "yellow");
      } catch {
        logWarning("OpenCode 配置格式错误，将创建新配置");
      }
    }

    // 添加或更新 tool-optimizer
    if (!opencodeConfig.mcp) {
      opencodeConfig.mcp = {};
    }
    opencodeConfig.mcp["tool-optimizer"] = mcpEntry;

    // 保存配置
    try {
      writeFileSync(opencodeConfigPath, JSON.stringify(opencodeConfig, null, 2), "utf-8");
      logSuccess(`已添加 tool-optimizer 到 OpenCode 配置`);
      log(`   配置文件: ${opencodeConfigPath}`, "yellow");
    } catch (error) {
      logWarning(`无法自动添加配置，请手动添加:`);
      console.log(JSON.stringify({ mcp: { "tool-optimizer": mcpEntry } }, null, 2));
    }

    // 5. 完成
    log("\n" + "=".repeat(50), "green");
    logSuccess("安装完成!");
    log("=".repeat(50), "green");
    log("\n使用方法:");
    log("  1. 重启 OpenCode");
    log("  2. 使用 tool_help 查看可用命令");
    log("  3. 使用 tool_search 搜索更好的工具");
    log("\n示例:");
    log("  tool_search({ query: 'browser automation' })");
    log("  tool_find_better({ toolName: 'chrome-devtools' })");
    log("  tool_upgrade({ toolName: 'xxx', candidateName: 'yyy', confirmed: true })");

  } catch (error) {
    logError(`安装失败: ${error.message}`);
    process.exit(1);
  }
}

// 运行安装
install();
