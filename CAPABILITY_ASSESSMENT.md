# Tool Optimizer MCP 系统能力评估报告

**评估日期**: 2026-03-31  
**系统版本**: 1.0.0

---

## 一、评估概述

Tool Optimizer MCP 是一个 MCP 服务器，用于管理、优化和迭代 MCP 工具。系统包含 **6 大功能模块**，共计 **20+ 个工具能力**。

---

## 二、能力矩阵

### 2.1 健康检查模块 (Health)

| 工具 | 能力 | 输入 | 输出 | 状态 |
|------|------|------|------|------|
| `tool_list` | 列出所有已安装工具 | - | 工具列表 + 性能数据 | ✅ |
| `tool_health` | 检查单个工具健康状态 | toolName | 健康状态 + 评分 | ✅ |
| `tool_health_all` | 批量检查所有工具 | - | 健康摘要报告 | ✅ |

**健康判定标准**:
- `healthy`: 成功率 ≥ 90%
- `degraded`: 成功率 70-90%
- `unhealthy`: 成功率 < 70%
- `unknown`: 无数据

**数据维度**:
- 成功率 (successRate)
- 平均执行时间 (avgDuration)
- 成功/失败次数 (successCount/failureCount)
- 最后指标时间 (lastMetricsAt)

---

### 2.2 搜索模块 (Search)

| 工具 | 能力 | 输入 | 输出 | 状态 |
|------|------|------|------|------|
| `tool_search` | 关键词搜索 Registry | query, category?, limit? | 工具列表 | ✅ |
| `tool_find_better` | 查找当前工具替代品 | toolName, limit? | 当前工具 + 替代列表 | ✅ |
| `tool_categories` | 获取分类列表 | - | 可用分类 | ✅ |
| `tool_popular` | 获取热门工具 | limit? | 热门工具列表 | ✅ |

**搜索特性**:
- 按 stars 排序
- GitHub 后备搜索 (Registry 失败时)
- API 重试机制 (指数退避)
- 结果缓存 (TTL)

**数据来源**:
- MCP Registry API
- GitHub Topic Search (后备)

---

### 2.3 对比模块 (Compare)

| 工具 | 能力 | 输入 | 输出 | 状态 |
|------|------|------|------|------|
| `tool_compare` | 对比两个工具 | toolName, candidateName? | 详细评估报告 | ✅ |
| `tool_evaluate_upgrade` | 评估升级建议 | toolName, candidateName | 建议 + 风险 + 步骤 | ✅ |

**评估维度**:

| 维度 | 权重 | 评分依据 |
|------|------|----------|
| 效率 (efficiency) | 40% | GitHub stars, forks, 更新频率 |
| 可靠性 (reliability) | 30% | 历史成功率, 执行时间稳定性 |
| 功能 (features) | 20% | 工具数量, 分类覆盖 |
| Token 节省 | 10% | Token 消耗对比 |

**评分阈值**:
- ≥ 75 且 efficiency ≥ 65 且 reliability ≥ 60 → 建议升级
- < 55 → 建议保持
- 其他 → 需要测试

---

### 2.4 升级模块 (Upgrade)

| 工具 | 能力 | 输入 | 输出 | 状态 |
|------|------|------|------|------|
| `tool_install` | 安装新工具 | candidateName, confirm | 安装结果 | ✅ |
| `tool_upgrade` | 升级工具 | toolName, candidateName, confirmed? | 升级结果 | ✅ |
| `tool_uninstall` | 卸载工具 | toolName, confirm | 卸载结果 | ✅ |
| `tool_rollback` | 回滚到旧版本 | toolName, confirm | 回滚结果 | ✅ |
| `tool_archive_list` | 列出归档工具 | - | 归档列表 | ✅ |

**升级流程** (tool_upgrade):
```
1. 安装新工具 (npm install -g / docker pull)
   ↓
2. 测试新工具
   ↓
3. 归档旧工具 (备份 + 记录)
   ↓
4. 从 MCP 配置移除旧工具
   ↓
5. 添加新工具到 MCP 配置
```

**安全特性**:
- 包名白名单验证
- 命令参数数组形式 (防注入)
- 确认机制 (防止误操作)
- 自动备份归档

---

### 2.5 诊断模块 (Diagnose) - 新增

| 工具 | 能力 | 输入 | 输出 | 状态 |
|------|------|------|------|------|
| `tool_diagnose` | 手动触发诊断 | taskContext?, errorContext?, specificTool? | 诊断报告 | ✅ |
| `tool_diagnose_auto` | 自动诊断 | taskContext, errorContext, failedTool? | 诊断报告 | ✅ |
| `tool_check_diagnose_keyword` | 检测诊断关键词 | text | 匹配结果 | ✅ |
| `tool_set_diagnose_mode` | 设置诊断模式 | mode, autoTriggers? | 配置结果 | ✅ |
| `tool_get_diagnose_config` | 获取诊断配置 | - | 当前配置 | ✅ |

**诊断模式**:
- `manual`: 仅手动触发 (默认)
- `auto`: 仅自动触发
- `both`: 两者都启用

**自动触发条件** (可配置):
- `taskStuck`: 任务卡住时
- `toolFailed`: 工具失败时
- `scheduled`: 定时检测

**诊断关键词**:
```
升级工具, 工具升级, 检测工具, 工具检测,
替代工具, 工具替代, 更换工具, 工具更换,
工具问题, 工具出错, 工具失败, 工具不行,
换个工具, 其他工具, 更好的工具
```

---

### 2.6 日志模块 (Logs)

| 工具 | 能力 | 输入 | 输出 | 状态 |
|------|------|------|------|------|
| `tool_log_stats` | 日志统计 | - | 统计摘要 | ✅ |
| `tool_log_recent` | 最近日志 | limit?, level? | 日志列表 | ✅ |
| `tool_log_errors` | 错误日志 | limit? | 错误列表 | ✅ |
| `tool_log_tool` | 工具日志 | toolName, limit? | 工具相关日志 | ✅ |
| `tool_log_search` | 日志搜索 | keyword, limit? | 匹配日志 | ✅ |
| `tool_log_info` | 日志系统信息 | - | 文件路径 + 统计 | ✅ |

**日志级别**:
- DEBUG (0)
- INFO (1)
- WARN (2)
- ERROR (3)

**日志分类**:
```
tool_operation, install, upgrade, uninstall,
search, compare, health, diagnose,
registry, config, system, security
```

**特性**:
- 缓冲 + 定时刷新 (5s)
- 自动日志轮转 (5MB)
- 独立错误日志文件
- 进程退出时强制刷新
- 异常捕获写入

---

## 三、数据流分析

### 3.1 工具生命周期

```
安装 (install)
    ↓
运行 (recordPerformance)
    ↓
监控 (health check)
    ↓
问题检测 (diagnose)
    ↓
对比评估 (compare/evaluate_upgrade)
    ↓
决定 (user confirm)
    ↓
升级/回滚 (upgrade/rollback)
```

### 3.2 数据存储

| 数据 | 路径 | 格式 |
|------|------|------|
| 工具配置 | ~/.tool-optimizer-mcp/tools.json | JSON |
| 归档工具 | ~/.tool-optimizer-mcp/archive.json | JSON |
| 性能指标 | ~/.tool-optimizer-mcp/metrics.json | JSON |
| 系统配置 | ~/.tool-optimizer-mcp/config.json | JSON |
| 运行日志 | ~/.tool-optimizer-mcp/logs/tool-optimizer.log | JSON Lines |
| 错误日志 | ~/.tool-optimizer-mcp/logs/errors.log | JSON Lines |

### 3.3 服务架构

```
┌─────────────────────────────────────────────────────────┐
│                    MCP Server (index.ts)                 │
├─────────────────────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│  │ Health  │ │ Search  │ │ Compare │ │ Upgrade │        │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘        │
│       │           │           │           │              │
│  ┌────┴───────────┴───────────┴───────────┴────┐       │
│  │              ConfigService                    │       │
│  │  - 工具管理 (get/set/archive/restore)       │       │
│  │  - 性能记录 (recordPerformance)              │       │
│  │  - 配置读写                                  │       │
│  └──────────────────┬──────────────────────────┘       │
│                     │                                   │
│  ┌─────────────────┴───────────────────────┐          │
│  │           RegistryService               │          │
│  │  - MCP Registry API (搜索/详情)         │          │
│  │  - GitHub 后备搜索                       │          │
│  │  - 缓存管理                              │          │
│  └──────────────────────────────────────────┘          │
│                                                        │
│  ┌──────────────────────────────────────────┐          │
│  │          EvaluatorService                │          │
│  │  - 生成评估报告 (评分/建议/风险)          │          │
│  └──────────────────────────────────────────┘          │
│                                                        │
│  ┌──────────────────────────────────────────┐          │
│  │          LoggerService                   │          │
│  │  - 分级日志 (error/warn/info/debug)      │          │
│  │  - 日志轮转/归档                         │          │
│  │  - 统计分析                              │          │
│  └──────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────┘
```

---

## 四、能力覆盖度评估

### 4.1 功能覆盖

| 功能 | 覆盖 | 说明 |
|------|------|------|
| 工具发现 | ✅ 完整 | search, find_better, popular, categories |
| 健康监控 | ✅ 完整 | health, health_all, recordPerformance |
| 升级决策 | ✅ 完整 | compare, evaluate_upgrade, 评分体系 |
| 执行升级 | ✅ 完整 | install, upgrade, uninstall, rollback |
| 问题诊断 | ✅ 完整 | diagnose (手动+自动双模式) |
| 日志追踪 | ✅ 完整 | stats, recent, errors, search, tool |
| 配置管理 | ✅ 完整 | 读、写、默认值、持久化 |
| 安全验证 | ✅ 完整 | 包名验证、命令防注入、确认机制 |

### 4.2 评估指标维度

| 维度 | 支持 | 指标 |
|------|------|------|
| 效率 | ✅ | stars, forks, 更新频率 |
| 可靠性 | ✅ | 成功率, 执行时间 |
| 功能 | ✅ | 工具数量, 分类覆盖 |
| Token | ⚠️ 可选 | 消耗数据 (需启用) |
| 风险 | ✅ | 许可证, 活跃度, 兼容性 |

### 4.3 触发模式

| 触发方式 | 支持 | 工具 |
|----------|------|------|
| 手动触发 | ✅ | diagnose, upgrade, uninstall 等 |
| 自动触发 | ✅ | diagnose_auto (可配置) |
| 定时触发 | ⚙️ 配置 | 需外部调度器 |
| 事件触发 | ⚙️ 预留 | TriggerEvent 类型已定义 |

---

## 五、优势与局限

### 5.1 优势

1. **完整的工具生命周期管理** - 从发现到升级的闭环
2. **双模式诊断** - 手动/自动灵活切换
3. **量化评估体系** - 多维度评分 + 置信度
4. **安全优先** - 包名验证、防注入、确认机制
5. **可观测性** - 完整日志 + 统计 + 错误追踪
6. **容错设计** - Registry 后备 GitHub 搜索、重试机制

### 5.2 局限

1. **定时检测需外部触发** - 内部无调度器
2. **跨平台命令差异** - Windows 支持未充分测试
3. **Token 消耗数据** - 需手动启用
4. **无 Web UI** - 仅 CLI/MCP 接口

---

## 六、建议改进

### 高优先级
1. 添加定时调度器 (支持 checkIntervalMs 配置)
2. Windows 环境测试与适配
3. Web Dashboard (可视化工具状态)

### 中优先级
1. 通知推送集成 (钉钉/飞书/Slack)
2. Token 消耗自动追踪
3. 性能基准测试框架

### 低优先级
1. 多语言支持 (i18n)
2. 插件系统 (扩展评估维度)
3. 历史趋势图表

---

## 七、总结

| 维度 | 评分 |
|------|------|
| 功能完整性 | ★★★★★ |
| 安全性 | ★★★★☆ |
| 可维护性 | ★★★★☆ |
| 可扩展性 | ★★★★☆ |
| 用户体验 | ★★★☆☆ |

**综合评级**: A- (工具管理功能完善，诊断能力突出，安全设计良好)

---

*报告生成时间: 2026-03-31*
