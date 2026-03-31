# tool-optimizer-mcp 修复计划

> 生成日期: 2026-03-31
> 预估总工时: 6-8 小时
> 执行顺序: 按优先级 P0 → P1 → P2 → P3

---

## 📋 目录

1. [P0 - 安全漏洞修复](#p0---安全漏洞修复)
2. [P0 - 评估系统改进](#p0---评估系统改进)
3. [P1 - 测试体系建设](#p1---测试体系建设)
4. [P1 - API 稳定性增强](#p1---api-稳定性增强)
5. [P2 - 异步文件操作改造](#p2---异步文件操作改造)
6. [P2 - 并发安全机制](#p2---并发安全机制)
7. [P3 - 日志可靠性增强](#p3---日志可靠性增强)

---

## P0 - 安全漏洞修复

### 问题位置
`src/tools/upgrade.ts` 第 84-124 行

### 问题代码
```typescript
// 危险：用户输入的包名直接拼接命令
execSync(`npm install -g ${packageName}`, { timeout: 60000 });
```

### 修复方案

#### Step 1: 创建包验证器 `src/utils/package-validator.ts`
```typescript
// 1. 包名格式验证 (符合 npm 包名规范)
// 2. 恶意模式检测 (包含 shell 特殊字符)
// 3. 可信来源白名单 (官方 registry)

const FORBIDDEN_PATTERNS = [
  /[;&|`$>(){}[\]]/,  // shell 特殊字符
  /^npm_/,             // npm 保留名
  /--/,                // 参数注入
];

const TRUSTED_REGISTRY = 'https://registry.npmjs.org';
```

#### Step 2: 修改安装逻辑
```typescript
// 替换直接 exec 为：
// 1. npx 验证模式 (更安全)
// 2. npm registry 直连 (绕过代理风险)
// 3. 沙箱安装路径

async function safeInstall(packageName: string): Promise<InstallResult> {
  // 验证包名
  if (!validatePackageName(packageName)) {
    throw new SecurityError('Invalid package name');
  }
  
  // 使用 npx 代替直接 npm exec
  const result = execSync(`npx --yes ${packageName}@latest --dry-run`, ...);
  
  // 验证安装包完整性
  await verifyPackageIntegrity(packageName);
}
```

#### Step 3: 添加安全警告日志
```typescript
loggerService.warn(LogCategory.INSTALL, `安装高风险操作: ${packageName}`, {
  context: { packageName, source: 'user_input' },
  securityAlert: true,
});
```

### 文件变更
| 文件 | 操作 | 变更量 |
|------|------|--------|
| `src/utils/package-validator.ts` | 新增 | ~80 行 |
| `src/tools/upgrade.ts` | 修改 | ~30 行 |
| `src/services/logger.ts` | 修改 | 添加 securityAlert 字段 |

### 风险评估
- **风险**: 低 (新增验证层)
- **影响**: 阻止恶意包安装
- **回滚**: 简单 (删除验证器即可)

---

## P0 - 评估系统改进

### 问题位置
`src/services/evaluator.ts` 第 85-157 行

### 问题分析
```typescript
// 假数据：硬编码功能特征
if (name.includes("chrome") || name.includes("browser")) {
  features.push({ name: "浏览器控制", supported: true, quality: "excellent" });
}
```

### 修复方案

#### Step 1: 建立真实数据源
```typescript
// 基于 Registry API 实际元数据评分
interface RealMetrics {
  githubStars: number;       // 真实社区活跃度
  githubForks: number;       // 社区参与度
  lastCommitDate: string;    // 维护活跃度
  issueResponseTime: number; // 社区支持度
  downloads: number;         // 实际使用量
  versionCount: number;      // 版本迭代速度
}
```

#### Step 2: 评分算法重构
```typescript
// 替换为基于真实数据的评分
calculateEfficiencyScore(candidate: ToolCandidate, metrics: RealMetrics): number {
  // 社区活跃度 (40%)
  const communityScore = Math.min(100, (metrics.githubStars / 1000) * 40);
  
  // 维护活跃度 (30%)
  const maintenanceScore = calculateMaintenanceScore(metrics.lastCommitDate);
  
  // 实际使用度 (30%)
  const usageScore = Math.min(100, Math.log10(metrics.downloads + 1) * 20);
  
  return communityScore * 0.4 + maintenanceScore * 0.3 + usageScore * 0.3;
}
```

#### Step 3: 风险识别真实化
```typescript
// 使用真实数据识别风险
identifyRisks(candidate: ToolCandidate, metrics: RealMetrics): string[] {
  const risks: string[] = [];
  
  // 检查维护状态
  if (metrics.daysSinceLastCommit > 365) {
    risks.push('工具已超过一年未更新，存在兼容性风险');
  }
  
  // 检查社区支持
  if (metrics.githubStars < 100) {
    risks.push('社区规模小，遇到问题难以获得帮助');
  }
  
  return risks;
}
```

#### Step 4: 删除硬编码特征
- 移除 `extractFeatures()` 硬编码逻辑
- 改用 Registry 的 `tools` 字段作为真实功能列表

### 文件变更
| 文件 | 操作 | 变更量 |
|------|------|--------|
| `src/services/evaluator.ts` | 重写 | ~200 行 |
| `src/types/index.ts` | 修改 | 添加 RealMetrics 接口 |

### 风险评估
- **风险**: 中 (评分算法变化可能影响已有决策)
- **影响**: 评估结果更客观
- **回滚**: 保留旧版本代码

---

## P1 - 测试体系建设

### 问题分析
- 无测试框架
- 无测试文件
- 无 CI/CD

### 修复方案

#### Step 1: 添加 Vitest 配置
```bash
npm install -D vitest @vitest/coverage-v8
```

`vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
```

#### Step 2: 编写单元测试

**config.test.ts**:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigService } from './config';

describe('ConfigService', () => {
  let service: ConfigService;
  
  beforeEach(() => {
    service = new ConfigService();
  });
  
  describe('getTool', () => {
    it('should return undefined for non-existent tool', () => {
      expect(service.getTool('non-existent')).toBeUndefined();
    });
  });
});
```

**evaluator.test.ts**:
```typescript
describe('EvaluatorService', () => {
  describe('calculateEfficiencyScore', () => {
    it('should return higher score for tools with more stars', () => {
      const highStarTool = createCandidate({ stars: 10000 });
      const lowStarTool = createCandidate({ stars: 100 });
      
      expect(calculateEfficiencyScore(highStarTool))
        .toBeGreaterThan(calculateEfficiencyScore(lowStarTool));
    });
  });
});
```

**logger.test.ts**:
```typescript
describe('LoggerService', () => {
  it('should create log entry with correct structure', () => {
    const entry = loggerService.info(LogCategory.TOOL_OPERATION, 'test');
    
    expect(entry).toHaveProperty('id');
    expect(entry).toHaveProperty('timestamp');
    expect(entry.level).toBe(LogLevel.INFO);
  });
});
```

#### Step 3: 添加工具测试

**upgrade.test.ts**:
```typescript
describe('registerUpgradeTools', () => {
  it('should reject installation without confirmation', async () => {
    const result = await tool_install({ 
      candidateName: 'test-package',
      confirm: false 
    });
    
    expect(result.content[0].text).toContain('需要确认');
  });
});
```

### 文件变更
| 文件 | 操作 | 变更量 |
|------|------|--------|
| `vitest.config.ts` | 新增 | ~20 行 |
| `package.json` | 修改 | 添加 vitest 依赖 |
| `src/services/config.test.ts` | 新增 | ~100 行 |
| `src/services/evaluator.test.ts` | 新增 | ~150 行 |
| `src/services/logger.test.ts` | 新增 | ~80 行 |
| `src/tools/upgrade.test.ts` | 新增 | ~120 行 |

### 覆盖率目标
- 核心服务: 80%+
- 工具函数: 60%+
- 整体: 70%+

---

## P1 - API 稳定性增强

### 问题位置
`src/services/registry.ts` 第 197-205 行

### 问题分析
```typescript
// 空实现后备
private async fallbackGitHubSearch(...): Promise<ToolCandidate[]> {
  console.warn("使用 GitHub 搜索后备（需要实现）");
  return [];  // API 失败就返回空
}
```

### 修复方案

#### Step 1: 实现 npm Registry 后备
```typescript
// 使用 npm Registry API 作为后备
const NPM_REGISTRY_API = 'https://registry.npmjs.org';

async searchWithNPMFallback(filter: SearchFilter, limit: number): Promise<ToolCandidate[]> {
  try {
    // 1. 先尝试 MCP Registry
    return await this.search(filter, limit);
  } catch (error) {
    // 2. MCP Registry 失败，使用 npm Registry
    return this.searchNPM(filter, limit);
  }
}

async searchNPM(filter: SearchFilter, limit: number): Promise<ToolCandidate[]> {
  const query = filter.query || '';
  const url = `${NPM_REGISTRY_API}/-/v1/search?text=${encodeURIComponent(query)}&size=${limit}`;
  
  const response = await axios.get(url);
  return response.data.objects.map(pkg => ({
    name: pkg.package.name,
    fullName: pkg.package.name,
    description: pkg.package.description,
    stars: pkg.package.version ? 0 : 0, // npm API 不提供 stars
    npmPackage: pkg.package.name,
    repository: pkg.package.links?.repository,
  }));
}
```

#### Step 2: 添加指数退避重试
```typescript
async searchWithRetry(filter: SearchFilter, limit: number, retries = 3): Promise<ToolCandidate[]> {
  for (let i = 0; i < retries; i++) {
    try {
      return await this.search(filter, limit);
    } catch (error) {
      if (i === retries - 1) throw error;
      
      // 指数退避: 1s, 2s, 4s
      await sleep(Math.pow(2, i) * 1000);
    }
  }
  return [];
}
```

#### Step 3: 实现真正的 GitHub 搜索 (可选)
```typescript
// 使用 GitHub API 搜索仓库
async searchGitHub(query: string, limit: number): Promise<ToolCandidate[]> {
  // 需要 GitHub Token 才能访问 API
  const token = process.env.GITHUB_TOKEN;
  if (!token) return [];
  
  const response = await axios.get('https://api.github.com/search/repositories', {
    params: { q: query, per_page: limit },
    headers: { Authorization: `token ${token}` },
  });
  
  return response.data.items.map(repo => ({
    name: repo.name,
    fullName: repo.full_name,
    description: repo.description,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    language: repo.language,
    repository: repo.html_url,
    lastUpdated: repo.updated_at,
  }));
}
```

### 文件变更
| 文件 | 操作 | 变更量 |
|------|------|--------|
| `src/services/registry.ts` | 修改 | ~80 行 |
| `.env.example` | 新增 | 添加 GITHUB_TOKEN 说明 |

---

## P2 - 异步文件操作改造

### 问题位置
- `src/services/config.ts`
- `src/services/logger.ts`

### 问题分析
```typescript
// 同步操作会阻塞事件循环
readFileSync(TOOLS_FILE, 'utf-8');
writeFileSync(TOOLS_FILE, JSON.stringify(data), 'utf-8');
```

### 修复方案

#### Step 1: 创建统一文件系统服务 `src/services/file-service.ts`
```typescript
import { promises as fs } from 'fs';
import { Mutex } from 'async-mutex';

export class FileService {
  private locks: Map<string, Mutex> = new Map();
  
  async read<T>(path: string): Promise<T | null> {
    try {
      const content = await fs.readFile(path, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
  
  async write(path: string, data: unknown): Promise<void> {
    const mutex = this.getMutex(path);
    await mutex.runExclusive(async () => {
      await fs.writeFile(path, JSON.stringify(data, null, 2), 'utf-8');
    });
  }
  
  private getMutex(path: string): Mutex {
    if (!this.locks.has(path)) {
      this.locks.set(path, new Mutex());
    }
    return this.locks.get(path)!;
  }
}
```

#### Step 2: 修改 ConfigService
```typescript
import { FileService } from './file-service.js';

export class ConfigService {
  private fileService = FileService.getInstance();
  
  async loadTools(): Promise<void> {
    const data = await this.fileService.read<Record<string, InstalledTool>>(TOOLS_FILE);
    if (data) {
      this.tools = new Map(Object.entries(data));
    }
  }
}
```

### 文件变更
| 文件 | 操作 | 变更量 |
|------|------|--------|
| `src/services/file-service.ts` | 新增 | ~80 行 |
| `src/services/config.ts` | 修改 | ~100 行 |
| `src/services/logger.ts` | 修改 | ~50 行 |
| `package.json` | 修改 | 添加 async-mutex 依赖 |

---

## P2 - 并发安全机制

### 问题分析
- 多请求同时写入 `tools.json` 会损坏数据
- 没有事务支持

### 修复方案

#### Step 1: 使用 WAL (Write-Ahead Logging) 模式
```typescript
export class ConfigService {
  private wal: WriteAheadLog;
  
  async setTool(tool: InstalledTool): Promise<void> {
    // 1. 写入 WAL
    await this.wal.write({
      type: 'setTool',
      data: tool,
      timestamp: Date.now(),
    });
    
    // 2. 应用变更
    this.tools.set(tool.name, tool);
    await this.saveTools();
  }
}
```

#### Step 2: 崩溃恢复
```typescript
async recover(): Promise<void> {
  const walFile = join(DATA_DIR, 'tools.wal');
  const walExists = existsSync(walFile);
  
  if (walExists) {
    // 读取 WAL 并重放
    const entries = await this.wal.read();
    for (const entry of entries) {
      await this.apply WALEntry(entry);
    }
    await this.wal.clear();
  }
}
```

### 简化方案 (推荐)
使用文件锁 + 队列：
```typescript
class WriteQueue {
  private queue: Array<() => Promise<void>> = [];
  private processing = false;
  
  async enqueue(operation: () => Promise<void>): Promise<void> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          await operation();
          resolve();
        } catch (e) {
          reject(e);
        }
      });
      this.process();
    });
  }
  
  private async process(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    
    while (this.queue.length > 0) {
      const op = this.queue.shift()!;
      await op();
    }
    
    this.processing = false;
  }
}
```

---

## P3 - 日志可靠性增强

### 问题位置
`src/services/logger.ts`

### 问题分析
```typescript
// 错误日志被缓冲，程序崩溃时会丢失
this.logBuffer.push(entry);
if (level === LogLevel.ERROR) {
  this.flush();
}
```

### 修复方案

#### Step 1: 错误日志立即同步写入
```typescript
log(level: LogLevel, category: LogCategory, message: string, options?: {...}): LogEntry {
  const entry = this.createEntry(level, category, message, options);
  
  // 立即写入控制台
  this.writeToConsole(entry);
  
  // 添加到缓冲区
  this.logBuffer.push(entry);
  
  // ERROR 级别立即同步写入文件
  if (level === LogLevel.ERROR) {
    this.writeToFileSync(entry);  // 同步版本
  } else {
    this.flush();  // 其他级别批量刷新
  }
  
  return entry;
}

private writeToFileSync(entry: LogEntry): void {
  try {
    appendFileSync(this.logFile, JSON.stringify(entry) + '\n', 'utf-8');
  } catch (error) {
    // 最后手段：写入 stderr
    console.error('[Logger] 同步写入失败:', error);
  }
}
```

#### Step 2: 添加致命错误处理器
```typescript
constructor() {
  // 进程退出前刷新所有日志
  process.on('beforeExit', () => {
    this.flush();
  });
  
  // 未捕获异常
  process.on('uncaughtException', (error) => {
    this.error(LogCategory.SYSTEM, '未捕获异常', { error });
    this.flush();
  });
}
```

### 文件变更
| 文件 | 操作 | 变更量 |
|------|------|--------|
| `src/services/logger.ts` | 修改 | ~30 行 |

---

## 📊 执行计划总览

### 阶段划分

| 阶段 | 任务 | 预估工时 | 依赖 |
|------|------|----------|------|
| **Phase 1** | P0 安全漏洞修复 | 2 小时 | 无 |
| **Phase 2** | P0 评估系统改进 | 2 小时 | Phase 1 |
| **Phase 3** | P1 测试体系建设 | 1.5 小时 | Phase 1 |
| **Phase 4** | P1 API 稳定性 | 1 小时 | Phase 2 |
| **Phase 5** | P2 异步文件 + 并发 | 1.5 小时 | Phase 3 |
| **Phase 6** | P3 日志可靠性 | 0.5 小时 | 无 |

### 里程碑

| 里程碑 | 完成标志 |
|--------|----------|
| **M1: 安全合规** | 安全测试通过，无命令注入风险 |
| **M2: 评估可信** | 评估结果可追溯到真实数据 |
| **M3: 测试覆盖** | 覆盖率报告生成 |
| **M4: 稳定可靠** | 压力测试无数据损坏 |
| **M5: 生产就绪** | 所有阶段完成 |

---

## ⚠️ 风险与回滚

| 风险 | 缓解措施 |
|------|----------|
| 评估算法变化影响已有决策 | 保留旧版本代码，添加特性开关 |
| 异步改造引入竞态条件 | 充分测试，保留同步版本作为 fallback |
| 安全修复阻断正常安装 | 白名单机制可配置 |

---

## ✅ 验收标准

1. **安全**: 无命令注入漏洞，通过安全扫描
2. **评估**: 评分可追溯到 Registry 真实数据
3. **测试**: 覆盖率 70%+，所有测试通过
4. **稳定**: 100 次并发写入无数据损坏
5. **日志**: 模拟崩溃后日志完整

---

## 📝 后续优化建议 (非本次计划范围)

1. 添加 Web UI 管理界面
2. 支持更多 MCP 客户端配置
3. 实现工具使用分析
4. 添加自动更新建议
5. 集成 Slack/钉钉 通知
