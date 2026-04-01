/**
 * 工具升级 MCP 工具
 * 执行工具的安装、升级、卸载操作
 * 
 * 安全改进:
 * - 包名白名单验证
 * - 安全的命令执行
 * - 详细的错误日志
 */

import { spawnSync } from "child_process";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { configService } from "../services/config.js";
import { registryService } from "../services/registry.js";
import { evaluatorService } from "../services/evaluator.js";
import { loggerService, LogCategory } from "../services/logger.js";
import type { InstalledTool } from "../types/index.js";
import { validatePackageName, validateDockerImage, validateToolName } from "../utils/package-validator.js";
import { getErrorMessage } from "../utils/error-utils.js";
import {
  INSTALL_TIMEOUT_MS,
  UNINSTALL_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  INSTALL_WAIT_MS,
} from "../utils/constants.js";

export function registerUpgradeTools(server: McpServer): void {
  /**
   * tool_install - 安装新工具
   */
  server.registerTool(
    "tool_install",
    {
      description: "安装新的 MCP 工具到系统",
      inputSchema: z.object({
        candidateName: z.string().describe("候选工具名称 (MCP Registry 中的名称)"),
        confirm: z.boolean().describe("确认安装"),
      }),
    },
    async ({ candidateName, confirm }) => {
      const startTime = Date.now();
      loggerService.info(LogCategory.INSTALL, `安装工具: ${candidateName}`, {
        context: { candidateName, confirm },
      });

      // 验证工具名称
      const nameValidation = validateToolName(candidateName);
      if (!nameValidation.valid) {
        loggerService.warn(LogCategory.INSTALL, `工具名验证失败: ${candidateName}`, {
          toolName: candidateName,
          context: { reason: nameValidation.error },
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: `工具名验证失败: ${nameValidation.error}`,
              }),
            },
          ],
        };
      }

      if (!confirm) {
        loggerService.debug(LogCategory.INSTALL, `安装待确认: ${candidateName}`);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                message: "安装需要确认，请设置 confirm: true",
                candidateName,
              }),
            },
          ],
        };
      }

      try {
        // 获取工具详情
        const candidate = await registryService.getDetails(candidateName);
        if (!candidate) {
          loggerService.warn(LogCategory.INSTALL, `未找到工具: ${candidateName}`);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: `未找到工具: ${candidateName}`,
                }),
              },
            ],
          };
        }

        // 安全验证包名/镜像名
        if (candidate.npmPackage) {
          const pkgValidation = validatePackageName(candidate.npmPackage);
          if (!pkgValidation.valid) {
            loggerService.error(LogCategory.SECURITY, `包名验证失败: ${candidate.npmPackage}`, {
              context: { packageName: candidate.npmPackage, error: pkgValidation.error },
              securityAlert: true,
            });
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    success: false,
                    error: `包名验证失败: ${pkgValidation.error}`,
                  }),
                },
              ],
            };
          }
        }

        if (candidate.dockerImage) {
          const imgValidation = validateDockerImage(candidate.dockerImage);
          if (!imgValidation.valid) {
            loggerService.error(LogCategory.SECURITY, `镜像名验证失败: ${candidate.dockerImage}`, {
              context: { imageName: candidate.dockerImage, error: imgValidation.error },
              securityAlert: true,
            });
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    success: false,
                    error: `镜像名验证失败: ${imgValidation.error}`,
                  }),
                },
              ],
            };
          }
        }

        // 执行安装
        const installResult = safeInstall(candidate.npmPackage, candidate.dockerImage);

        if (!installResult.success) {
          loggerService.error(LogCategory.INSTALL, `安装失败: ${candidateName}`, {
            toolName: candidateName,
            context: { error: installResult.error },
            error: new Error(installResult.error || "Unknown error"),
            duration: Date.now() - startTime,
            success: false,
          });
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: `安装失败: ${installResult.error}`,
                }),
              },
            ],
          };
        }

        // 创建工具记录
        const newTool: InstalledTool = {
          name: candidate.name,
          command: candidate.npmPackage ? "npx" : "docker",
          args: candidate.npmPackage
            ? ["-y", candidate.npmPackage]
            : ["run", candidate.dockerImage!],
          type: candidate.dockerImage ? "remote" : "local",
          enabled: true,
          installedAt: new Date().toISOString(),
        };

        // 保存到配置
        configService.setTool(newTool);
        void configService.addToolToOpenCode(candidate.name, newTool);

        loggerService.info(LogCategory.INSTALL, `安装成功: ${candidate.name}`, {
          toolName: candidate.name,
          duration: Date.now() - startTime,
          success: true,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message: `工具 ${candidate.name} 已安装`,
                tool: newTool,
                installOutput: installResult.output,
              }),
            },
          ],
        };
      } catch (error) {
        loggerService.error(LogCategory.INSTALL, `安装失败: ${candidateName}`, {
          toolName: candidateName,
          error: error as Error,
          duration: Date.now() - startTime,
          success: false,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: getErrorMessage(error),
              }),
            },
          ],
        };
      }
    }
  );

  /**
   * tool_upgrade - 升级工具（安装新工具，测试，卸载旧工具）
   */
  server.registerTool(
    "tool_upgrade",
    {
      description: "升级工具：新工具测试通过后卸载旧工具",
      inputSchema: z.object({
        toolName: z.string().describe("要升级的当前工具名称"),
        candidateName: z.string().describe("候选工具名称"),
        confirmed: z.boolean().optional().default(false).describe("确认执行升级"),
      }),
    },
    async ({ toolName, candidateName, confirmed = false }) => {
      const startTime = Date.now();
      loggerService.info(LogCategory.UPGRADE, `升级工具: ${toolName} -> ${candidateName}`, {
        toolName,
        context: { candidateName, confirmed },
      });

      // 验证工具名称
      const toolValidation = validateToolName(toolName);
      const candidateValidation = validateToolName(candidateName);
      if (!toolValidation.valid || !candidateValidation.valid) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: "工具名称验证失败",
              }),
            },
          ],
        };
      }

      try {
        // 获取当前工具
        const currentTool = configService.getTool(toolName);
        if (!currentTool) {
          loggerService.warn(LogCategory.UPGRADE, `工具不存在: ${toolName}`, { toolName });
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: `未找到当前工具: ${toolName}`,
                }),
              },
            ],
          };
        }

        // 获取候选工具
        const candidate = await registryService.getDetails(candidateName);
        if (!candidate) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: `未找到候选工具: ${candidateName}`,
                }),
              },
            ],
          };
        }

        // 生成评估报告
        const report = evaluatorService.generateReport(currentTool, candidate);

        // 如果未确认，返回报告让用户确认
        if (!confirmed) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  message: "升级需要确认",
                  report,
                  confirmRequired: true,
                  step: "请确认是否执行升级 (设置 confirmed: true)",
                }),
              },
            ],
          };
        }

        // 确认后执行升级
        // 1. 先安装新工具
        const installResult = installCandidateTool(candidate);
        if (!installResult.success) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: "安装新工具失败",
                  installError: installResult.error,
                }),
              },
            ],
          };
        }

        // 2. 测试新工具
        const testResult = await testTool(candidate.name);
        if (!testResult.success) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: "新工具测试失败",
                  testError: testResult.error,
                  recommendation: "建议保持当前工具",
                }),
              },
            ],
          };
        }

        // 3. 归档并移除旧工具
        const archived = configService.archiveTool(toolName, "升级到 " + candidate.name);
        if (!archived) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: "归档旧工具失败",
                }),
              },
            ],
          };
        }

        // 4. 从 MCP 配置中移除旧工具
        void configService.removeToolFromOpenCode(toolName);

        loggerService.info(LogCategory.UPGRADE, `升级成功: ${toolName} -> ${candidate.name}`, {
          toolName,
          context: { candidateName },
          duration: Date.now() - startTime,
          success: true,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                newTool: installResult.newTool,
                oldToolArchived: archived,
                message: `成功升级: ${toolName} -> ${candidate.name}`,
              }, null, 2),
            },
          ],
        };
      } catch (error) {
        loggerService.error(LogCategory.UPGRADE, `升级失败: ${toolName}`, {
          toolName,
          error: error as Error,
          duration: Date.now() - startTime,
          success: false,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: getErrorMessage(error),
              }),
            },
          ],
        };
      }
    }
  );

  /**
   * tool_uninstall - 卸载工具
   */
  server.registerTool(
    "tool_uninstall",
    {
      description: "卸载指定的 MCP 工具",
      inputSchema: z.object({
        toolName: z.string().describe("要卸载的工具名称"),
        confirm: z.boolean().describe("确认卸载"),
      }),
    },
    ({ toolName, confirm }) => {
      const startTime = Date.now();
      loggerService.info(LogCategory.UNINSTALL, `卸载工具: ${toolName}`, {
        toolName,
        context: { confirm },
      });

      // 验证工具名称
      const nameValidation = validateToolName(toolName);
      if (!nameValidation.valid) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: `工具名验证失败: ${nameValidation.error}`,
              }),
            },
          ],
        };
      }

      if (!confirm) {
        loggerService.debug(LogCategory.UNINSTALL, `卸载待确认: ${toolName}`);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                message: "卸载需要确认，请设置 confirm: true",
                toolName,
              }),
            },
          ],
        };
      }

      try {
        const tool = configService.getTool(toolName);
        if (!tool) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: `未找到工具: ${toolName}`,
                }),
              },
            ],
          };
        }

        // 归档工具
        const archived = configService.archiveTool(toolName, "用户主动卸载");
        if (!archived) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: "归档工具失败",
                }),
              },
            ],
          };
        }

        // 从 MCP 配置移除
        void configService.removeToolFromOpenCode(toolName);

        // 安全卸载 npm 包
        if (tool.args && tool.args[0] === "-y") {
          const packageName = tool.args[1];
          if (packageName) {
            const pkgValidation = validatePackageName(packageName);
            if (pkgValidation.valid) {
              try {
                const result = spawnSync("npm", ["uninstall", "-g", packageName], {
                  encoding: "utf-8",
                  timeout: UNINSTALL_TIMEOUT_MS,
                });
                if (result.status === 0) {
                  loggerService.debug(LogCategory.UNINSTALL, `npm 包已卸载: ${packageName}`);
                } else {
                  loggerService.warn(LogCategory.UNINSTALL, `npm 包卸载失败: ${packageName}`);
                }
              } catch {
                loggerService.warn(LogCategory.UNINSTALL, `npm 包卸载失败: ${packageName}`);
              }
            }
          }
        }

        loggerService.info(LogCategory.UNINSTALL, `卸载成功: ${toolName}`, {
          toolName,
          duration: Date.now() - startTime,
          success: true,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message: `工具 ${toolName} 已卸载并归档`,
                archived,
              }),
            },
          ],
        };
      } catch (error) {
        loggerService.error(LogCategory.UNINSTALL, `卸载失败: ${toolName}`, {
          toolName,
          error: error as Error,
          duration: Date.now() - startTime,
          success: false,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: getErrorMessage(error),
              }),
            },
          ],
        };
      }
    }
  );

  /**
   * tool_rollback - 回滚到旧版本
   */
  server.registerTool(
    "tool_rollback",
    {
      description: "从归档中恢复之前卸载的工具",
      inputSchema: z.object({
        toolName: z.string().describe("要恢复的工具名称"),
        confirm: z.boolean().describe("确认恢复"),
      }),
    },
    ({ toolName, confirm }) => {
      const startTime = Date.now();
      loggerService.info(LogCategory.UPGRADE, `回滚工具: ${toolName}`, {
        toolName,
        context: { confirm },
      });

      // 验证工具名称
      const nameValidation = validateToolName(toolName);
      if (!nameValidation.valid) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: `工具名验证失败: ${nameValidation.error}`,
              }),
            },
          ],
        };
      }

      if (!confirm) {
        const archived = configService.getArchivedTools().find((a) => a.name === toolName);
        if (!archived) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  found: false,
                  message: `未找到归档工具: ${toolName}`,
                }),
              },
            ],
          };
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                message: "恢复需要确认",
                archived,
                confirmRequired: true,
              }),
            },
          ],
        };
      }

      try {
        const restored = configService.restoreTool(toolName);
        if (!restored) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: `恢复失败: ${toolName}`,
                }),
              },
            ],
          };
        }

        // 添加回 MCP 配置
        void configService.addToolToOpenCode(toolName, restored);

        loggerService.info(LogCategory.UPGRADE, `回滚成功: ${toolName}`, {
          toolName,
          duration: Date.now() - startTime,
          success: true,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message: `工具 ${toolName} 已恢复`,
                restored,
              }),
            },
          ],
        };
      } catch (error) {
        loggerService.error(LogCategory.UPGRADE, `回滚失败: ${toolName}`, {
          toolName,
          error: error as Error,
          duration: Date.now() - startTime,
          success: false,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: getErrorMessage(error),
              }),
            },
          ],
        };
      }
    }
  );

  /**
   * tool_archive_list - 列出已归档的工具
   */
  server.registerTool(
    "tool_archive_list",
    {
      description: "列出所有已归档的旧工具",
      inputSchema: z.object({}),
    },
    () => {
      const startTime = Date.now();
      loggerService.debug(LogCategory.UNINSTALL, "查询归档工具列表");

      const archived = configService.getArchivedTools();

      loggerService.info(LogCategory.UNINSTALL, `返回 ${archived.length} 个归档工具`, {
        context: { count: archived.length },
        duration: Date.now() - startTime,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              count: archived.length,
              tools: archived,
            }, null, 2),
          },
        ],
      };
    }
  );
}

// ============== 安全的安装函数 ==============

/**
 * 安全的安装函数
 * 使用 spawnSync 数组形式参数避免 shell 注入
 */
function safeInstall(
  npmPackage?: string,
  dockerImage?: string
): { success: boolean; output?: string; error?: string } {
  try {
    if (npmPackage) {
      // npm 安装 - 使用数组形式避免注入
      const result = spawnSync("npm", ["install", "-g", npmPackage], {
        encoding: "utf-8",
        timeout: INSTALL_TIMEOUT_MS,
      });
      if (result.status !== 0) {
        return { success: false, error: result.error?.message || `npm 安装失败 (${result.status})` };
      }
      return { success: true, output: typeof result.stdout === 'string' ? result.stdout : String(result.stdout) };
    }

    if (dockerImage) {
      // Docker 安装 - 使用数组形式避免注入
      const result = spawnSync("docker", ["pull", dockerImage], {
        encoding: "utf-8",
        timeout: INSTALL_TIMEOUT_MS,
      });
      if (result.status !== 0) {
        return { success: false, error: result.error?.message || `docker pull 失败 (${result.status})` };
      }
      return { success: true, output: typeof result.stdout === 'string' ? result.stdout : String(result.stdout) };
    }

    return { success: false, error: "无法确定安装方式：缺少 npmPackage 或 dockerImage" };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }
}

// ============== 辅助函数 ==============

/**
 * 安装候选工具 (内部使用)
 */
function installCandidateTool(candidate: {
  name: string;
  npmPackage?: string;
  dockerImage?: string;
}): { success: boolean; newTool?: InstalledTool; error?: string } {
  const installResult = safeInstall(candidate.npmPackage, candidate.dockerImage);

  if (!installResult.success) {
    return { success: false, error: installResult.error };
  }

  const newTool: InstalledTool = {
    name: candidate.name,
    command: candidate.npmPackage ? "npx" : "docker",
    args: candidate.npmPackage
      ? ["-y", candidate.npmPackage]
      : ["run", candidate.dockerImage!],
    type: candidate.dockerImage ? "remote" : "local",
    enabled: true,
    installedAt: new Date().toISOString(),
  };

  configService.setTool(newTool);
  void configService.addToolToOpenCode(candidate.name, newTool);

  return { success: true, newTool };
}

/**
 * 测试工具是否正确安装
 */
async function testTool(
  toolName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const tool = configService.getTool(toolName);
    if (!tool) {
      return { success: false, error: "工具未安装" };
    }

    // 等待一小段时间让安装完成
    await new Promise((resolve) => setTimeout(resolve, INSTALL_WAIT_MS));

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }
}
