# Tool Optimizer MCP 服务器

一个用于管理、优化和迭代 MCP 工具的 Model Context Protocol (MCP) 服务器。支持工具搜索、对比、升级、健康检查等功能。

[English](./README.md) | [中文](./README_zh.md)

---

## 功能特性

- 🔍 **工具搜索** - 在 MCP Registry 中搜索更好的替代工具
- ⚖️ **工具对比** - 生成详细的评估报告，对比效率、可靠性、功能
- 🚀 **智能升级** - 安装新工具 → 测试验证 → 自动卸载旧工具
- 💾 **配置管理** - 自动管理 OpenCode 等 MCP 客户端的配置
- 📊 **性能监控** - 跟踪工具成功率、执行时间等指标
- 📝 **日志系统** - 结构化日志记录，用于调试和迭代改进
- 🔒 **安全优先** - 包名验证、命令注入防护

## 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                      MCP 客户端                           │
│              (OpenCode / Claude Desktop 等)              │
└─────────────────────┬───────────────────────────────────┘
                      │ stdio
                      ▼
┌─────────────────────────────────────────────────────────┐
│              Tool Optimizer MCP 服务器                   │
├─────────────────────────────────────────────────────────┤
│  工具层                                                   │
│  ├── 健康工具 (列表、健康检查)                             │
│  ├── 搜索工具 (搜索、查找替代)                           │
│  ├── 对比工具 (对比、评估升级)                           │
│  ├── 升级工具 (安装、升级、卸载)                         │
│  └── 日志工具 (统计、最近、错误)                         │
├─────────────────────────────────────────────────────────┤
│  服务层                                                   │
│  ├── ConfigService - 配置管理服务                        │
│  ├── RegistryService - MCP Registry API 客户端          │
│  ├── EvaluatorService - 工具评估与评分                  │
│  └── LoggerService - 结构化日志服务                     │
├─────────────────────────────────────────────────────────┤
│  工具层                                                   │
│  ├── PackageValidator - 安全验证                         │
│  ├── ErrorUtils - 错误处理工具                        │
│  └── Constants - 魔法数字集中管理                        │
└─────────────────────────────────────────────────────────┘
```

## 工作流程

```
启动检查                       任务卡点
   │                            │
   ▼                            ▼
评估现有工具 ─────────────────┼──▶ 检测问题
   │                            │
   ▼                            ▼
提示可升级项 ────────────────▶ 评估是否为工具问题
   │                            │
   ▼                            ▼
等待确认 ───────────────────▶ 搜索更强替代工具
   │                            │
   ▼                            ▼
安装新工具 ──────────────────▶ 确认推荐
   │                            │
   ▼                            ▼
评估报告 ◀────────────────────┘
   │
   ▼
确认优于旧工具 → 卸载旧工具
```

## 安装

### 环境要求

- Node.js >= 18.0.0
- npm 或 yarn

### 从源码构建

```bash
# 克隆仓库
git clone https://github.com/lh123aa/tool-optimizer.git
cd tool-optimizer-mcp

# 安装依赖
npm install

# 构建
npm run build
```

### 全局安装

```bash
npm install -g tool-optimizer-mcp
```

## 配置

### OpenCode

添加到 `~/.config/opencode/opencode.json`:

```json
{
  "mcpServers": {
    "tool-optimizer": {
      "command": "node",
      "args": ["/path/to/tool-optimizer-mcp/dist/index.js"],
      "env": {}
    }
  }
}
```

### Claude Desktop

添加到 `~/AppData/Roaming/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "tool-optimizer": {
      "command": "node",
      "args": ["C:/path/to/tool-optimizer-mcp/dist/index.js"]
    }
  }
}
```

## 可用工具

### 健康检查工具

| 工具 | 描述 |
|------|------|
| `tool_list` | 列出所有已安装的工具 |
| `tool_health` | 检查单个工具的健康状态 |
| `tool_health_all` | 检查所有工具的健康状态 |

### 搜索工具

| 工具 | 描述 |
|------|------|
| `tool_search` | 搜索 MCP Registry |
| `tool_find_better` | 查找更好的替代工具 |
| `tool_categories` | 获取工具分类列表 |
| `tool_popular` | 获取热门工具列表 |

### 对比工具

| 工具 | 描述 |
|------|------|
| `tool_compare` | 对比两个工具 |
| `tool_evaluate_upgrade` | 评估升级建议 |

### 升级工具

| 工具 | 描述 |
|------|------|
| `tool_install` | 安装新工具 |
| `tool_upgrade` | 升级（安装 + 测试 + 卸载旧工具） |
| `tool_uninstall` | 卸载工具 |
| `tool_rollback` | 回滚到旧版本 |
| `tool_archive_list` | 列出已归档的工具 |

### 日志工具

| 工具 | 描述 |
|------|------|
| `tool_log_stats` | 获取日志统计 |
| `tool_log_recent` | 获取最近日志 |
| `tool_log_errors` | 获取错误日志 |
| `tool_log_tool` | 获取指定工具的日志 |
| `tool_log_search` | 搜索日志 |
| `tool_log_info` | 获取日志系统信息 |

## 使用示例

### 搜索工具

```javascript
// 搜索 MCP Registry
const results = await tool_search({
  query: "browser automation",
  category: "browser",
  limit: 10
});

// 查找更好的替代
const alternatives = await tool_find_better({
  toolName: "chrome-devtools",
  limit: 5
});
```

### 对比和升级

```javascript
// 对比工具
const report = await tool_compare({
  toolName: "chrome-devtools",
  candidateName: "microsoft/playwright-mcp"
});

// 评估升级
const evaluation = await tool_evaluate_upgrade({
  toolName: "chrome-devtools",
  candidateName: "microsoft/playwright-mcp"
});

// 执行升级
const result = await tool_upgrade({
  toolName: "chrome-devtools",
  candidateName: "microsoft/playwright-mcp",
  confirm: true
});
```

### 健康检查

```javascript
// 列出所有工具
const tools = await tool_list();

// 检查指定工具
const health = await tool_health({
  toolName: "chrome-devtools"
});

// 检查所有工具
const allHealth = await tool_health_all();
```

## 评估报告

```json
{
  "id": "eval_xxx-xxx",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "oldTool": {
    "name": "chrome-devtools",
    "version": "1.0.0"
  },
  "newTool": {
    "name": "microsoft/playwright-mcp",
    "stars": 30039,
    "forks": 5231
  },
  "scores": {
    "efficiency": 85,
    "reliability": 78,
    "features": 82,
    "overall": 82
  },
  "recommendation": "upgrade",
  "reason": "综合得分 82/100，建议升级"
}
```

## 数据存储

数据存储在 `~/.tool-optimizer-mcp/`:

| 文件 | 描述 |
|------|------|
| `tools.json` | 已安装工具列表 |
| `archive.json` | 已归档的旧工具 |
| `metrics.json` | 性能指标 |
| `config.json` | 系统配置 |
| `logs/` | 结构化日志 |

## 开发

```bash
# 安装依赖
npm install

# 开发模式（热重载）
npm run dev

# 构建
npm run build

# 运行测试
npm test

# 运行测试（覆盖率）
npm run test:coverage

# 代码检查
npm run lint

# 代码格式化
npm run format

# 清理构建
npm run clean
```

## 安全特性

- **包名验证**: 所有 npm 包名在安装前都会验证
- **命令注入防护**: 使用数组形式的 `spawnSync` 参数
- **输入校验**: 所有工具输入使用 Zod schema 验证
- **安全日志**: 敏感数据不会被记录

## 测试

```bash
# 运行所有测试
npm test

# 监听模式运行测试
npm run test:watch

# 生成覆盖率报告
npm run test:coverage
```

## 评分维度

评估报告基于以下维度进行评分：

| 维度 | 权重 | 评分依据 |
|------|------|----------|
| 效率分 | 40% | GitHub stars、forks、更新频率 |
| 可靠性分 | 30% | 历史成功率、执行时间稳定性 |
| 功能分 | 20% | 提供的工具数量、描述详细程度 |
| Token 效率 | 10% | Token 消耗水平 |

## 许可证

MIT

## 贡献

欢迎贡献！请阅读 [AGENTS.md](./AGENTS.md) 了解开发规范。
