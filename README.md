# Tool Optimizer MCP Server

一个 MCP 服务器，用于管理、优化和迭代 MCP 工具。支持工具搜索、对比、升级、卸载等操作。

## 功能特性

- 🔍 **工具搜索** - 在 MCP Registry 中搜索更好的替代工具
- ⚖️ **工具对比** - 生成详细的评估报告，对比效率、可靠性、功能
- 🚀 **智能升级** - 安装新工具 → 测试验证 → 自动卸载旧工具
- 💾 **配置管理** - 自动管理 OpenCode 等 MCP 客户端的配置
- 📊 **性能监控** - 跟踪工具成功率、执行时间等指标

## 工作流程

```
启动检查                    任务卡点
   │                          │
   ▼                          ▼
评估现有工具 ─────────────────┼──▶ 检测卡点
   │                          │
   ▼                          ▼
提示可升级项 ───────────────▶ 评估是否工具问题
   │                          │
   ▼                          ▼
等待确认 ───────────────────▶ 搜索更强替代工具
   │                          │
   ▼                          ▼
安装新工具 ───────────────────▶ 推荐确认
   │                          │
   ▼                          ▼
评估报告（效率/稳定性） ◀──────┘
   │
   ▼
确认优于旧工具 → 卸载旧工具
```

## 安装

### 方式一：npm 安装

```bash
cd E:\程序\工具迭代\tool-optimizer-mcp
npm install
npm run build
```

### 方式二：全局安装

```bash
npm install -g tool-optimizer-mcp
```

## 配置 MCP 客户端

### OpenCode

在 `~/.config/opencode/opencode.json` 中添加：

```json
{
  "mcp": {
    "tool-optimizer": {
      "command": "node",
      "args": ["E:/程序/工具迭代/tool-optimizer-mcp/dist/index.js"],
      "enabled": true,
      "type": "local"
    }
  }
}
```

### Claude Desktop

在 `~/AppData/Roaming/Claude/claude_desktop_config.json` 中添加：

```json
{
  "mcpServers": {
    "tool-optimizer": {
      "command": "node",
      "args": ["E:/程序/工具迭代/tool-optimizer-mcp/dist/index.js"]
    }
  }
}
```

### 其他 MCP 客户端

```json
{
  "mcpServers": {
    "tool-optimizer": {
      "command": "node",
      "args": ["<安装路径>/dist/index.js"]
    }
  }
}
```

## 使用方法

### 健康检查

```javascript
// 列出所有已安装工具
tool_list()

// 检查单个工具健康状态
tool_health({ toolName: "chrome-devtools" })

// 检查所有工具健康状态
tool_health_all()
```

### 搜索工具

```javascript
// 搜索 MCP Registry
tool_search({ query: "browser automation", limit: 10 })

// 查找当前工具的更好替代
tool_find_better({ toolName: "chrome-devtools", limit: 5 })

// 获取热门工具
tool_popular({ limit: 10 })
```

### 对比工具

```javascript
// 对比当前工具和候选工具
tool_compare({
  toolName: "chrome-devtools",
  candidateName: "microsoft/playwright-mcp"
})

// 获取升级建议
tool_evaluate_upgrade({
  toolName: "chrome-devtools",
  candidateName: "microsoft/playwright-mcp"
})
```

### 升级工具

```javascript
// 安装新工具
tool_install({
  candidateName: "microsoft/playwright-mcp",
  confirm: true
})

// 升级（安装 + 测试 + 卸载旧工具）
tool_upgrade({
  toolName: "chrome-devtools",
  candidateName: "microsoft/playwright-mcp",
  confirmed: true
})

// 卸载工具
tool_uninstall({
  toolName: "chrome-devtools",
  confirm: true
})

// 回滚到旧版本
tool_rollback({
  toolName: "chrome-devtools",
  confirm: true
})
```

## 数据存储

工具信息和配置存储在：
- Windows: `C:\Users\<用户名>\.tool-optimizer-mcp\`
- macOS: `~/.tool-optimizer-mcp/`
- Linux: `~/.tool-optimizer-mcp/`

包含文件：
- `tools.json` - 已安装工具列表
- `archive.json` - 已归档的旧工具
- `metrics.json` - 性能指标
- `config.json` - 系统配置

## 评估报告示例

```json
{
  "id": "uuid",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "oldTool": { "name": "chrome-devtools" },
  "newTool": { "name": "playwright-mcp", "stars": 30039 },
  "efficiencyScore": 85,
  "reliabilityScore": 78,
  "featureScore": 82,
  "overallScore": 82,
  "recommendation": "upgrade",
  "reason": "综合得分 82/100，建议升级"
}
```

## 开发

```bash
# 安装依赖
npm install

# 开发模式（热重载）
npm run dev

# 构建
npm run build

# 清理
npm run clean
```

## 许可证

MIT
