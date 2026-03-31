/**
 * Tool Optimizer MCP Server
 * 
 * 一个 MCP 服务器，用于管理、优化和迭代 MCP 工具
 * 支持工具搜索、对比、升级、卸载等操作
 * 
 * 安装方式:
 * 1. npm install
 * 2. npm run build
 * 3. 在 MCP 客户端配置中添加此服务器
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// 导入工具注册函数
import { registerHealthTools } from "./tools/health.js";
import { registerSearchTools } from "./tools/search.js";
import { registerCompareTools } from "./tools/compare.js";
import { registerUpgradeTools } from "./tools/upgrade.js";
import { registerLogTools } from "./tools/logs.js";
import { registerDiagnoseTools } from "./tools/diagnose.js";

// 导入服务
import { configService } from "./services/config.js";
import { loggerService, LogCategory } from "./services/logger.js";

// 服务器信息
const SERVER_NAME = "tool-optimizer";
const SERVER_VERSION = "1.0.0";

/**
 * 创建并启动 MCP 服务器
 */
async function main() {
  console.error(`[${SERVER_NAME}] 启动中...`);

  // 记录启动日志
  loggerService.info(LogCategory.SYSTEM, `MCP 服务器启动`, {
    context: { name: SERVER_NAME, version: SERVER_VERSION },
  });

  // 创建 MCP 服务器实例
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  // 注册所有工具
  registerHealthTools(server);
  registerSearchTools(server);
  registerCompareTools(server);
  registerUpgradeTools(server);
  registerLogTools(server);
  registerDiagnoseTools(server);

  // 添加工具列表快捷查询
  server.tool(
    "tool_help",
    "获取工具使用帮助",
    {},
    () => {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                name: SERVER_NAME,
                version: SERVER_VERSION,
                description: "MCP 工具迭代管理系统 - 帮助 CLI 工具自动发现、评估和升级更好的替代工具",
                tools: {
                  health: {
                    description: "健康检查工具",
                    commands: [
                      "tool_list - 列出所有已安装工具",
                      "tool_health - 检查单个工具健康状态",
                      "tool_health_all - 检查所有工具健康状态",
                    ],
                  },
                  search: {
                    description: "搜索工具",
                    commands: [
                      "tool_search - 搜索 MCP Registry",
                      "tool_find_better - 查找更好的替代工具",
                      "tool_categories - 获取工具分类",
                      "tool_popular - 获取热门工具",
                    ],
                  },
                  compare: {
                    description: "对比工具",
                    commands: [
                      "tool_compare - 对比两个工具",
                      "tool_evaluate_upgrade - 评估升级建议",
                    ],
                  },
                  upgrade: {
                    description: "升级工具",
                    commands: [
                      "tool_install - 安装新工具",
                      "tool_upgrade - 升级工具(安装+测试+卸载旧工具)",
                      "tool_uninstall - 卸载工具",
                      "tool_rollback - 回滚到旧版本",
                      "tool_archive_list - 列出已归档工具",
                    ],
                  },
                  logs: {
                    description: "日志查询",
                    commands: [
                      "tool_log_stats - 获取日志统计",
                      "tool_log_recent - 获取最近日志",
                      "tool_log_errors - 获取错误日志",
                      "tool_log_tool - 获取工具日志",
                      "tool_log_search - 搜索日志",
                      "tool_log_info - 获取日志系统信息",
                    ],
                  },
                  diagnose: {
                    description: "工具诊断 (手动/自动双模式)",
                    mode: "manual | auto | both",
                    commands: [
                      "tool_diagnose - 手动触发诊断",
                      "tool_diagnose_auto - 自动诊断(任务失败时)",
                      "tool_check_diagnose_keyword - 检查诊断关键词",
                      "tool_set_diagnose_mode - 设置诊断模式",
                      "tool_get_diagnose_config - 获取诊断配置",
                    ],
                    manualTriggers: [
                      "升级工具", "检测工具", "替代工具", "更换工具",
                      "工具问题", "工具出错", "换个工具", "更好的工具",
                    ],
                  },
                },
                usage: {
                  searchExample: "tool_search({ query: 'browser automation' })",
                  compareExample:
                    "tool_compare({ toolName: 'chrome-devtools', candidateName: 'microsoft/playwright-mcp' })",
                  upgradeExample:
                    "tool_upgrade({ toolName: 'chrome-devtools', candidateName: 'microsoft/playwright-mcp', confirmed: true })",
                },
                config: {
                  dataDir: configService.getDataDir(),
                },
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // 创建stdio传输通道
  const transport = new StdioServerTransport();

  // 启动服务器
  console.error(`[${SERVER_NAME}] MCP 服务器已启动`);
  console.error(`[${SERVER_NAME}] 数据目录: ${configService.getDataDir()}`);
  console.error(`[${SERVER_NAME}] 等待请求...`);

  await server.connect(transport);

  // 记录关闭日志
  loggerService.info(LogCategory.SYSTEM, `MCP 服务器关闭`);
  loggerService.shutdown();

  console.error(`[${SERVER_NAME}] 服务器已关闭`);
}

// 导出 main 函数
export { main };

// 直接运行
main().catch((error) => {
  console.error(`[${SERVER_NAME}] 启动失败:`, error);
  process.exit(1);
});
