/**
 * MCP Registry API 服务
 * 与官方 MCP Registry (modelcontextprotocol/registry) 交互
 * 获取 MCP 服务器列表、搜索、获取详情
 * 
 * 特性:
 * - API 版本正确 (/v0.1/api/v1/...)
 * - 重试机制 (指数退避)
 * - GitHub 搜索后备方案
 * - 请求缓存
 */

import type { AxiosInstance} from "axios";
import axios, { AxiosError } from "axios";
import type { ToolCandidate, SearchFilter } from "../types/index.js";
import { REGISTRY_API_BASE, REGISTRY_API_TIMEOUT_MS, REGISTRY_CACHE_TTL_MS } from "../utils/constants.js";

// API 路径前缀
const API_PREFIX = "/v0.1/api/v1";

// GitHub API 配置
const GITHUB_API_BASE = "https://api.github.com";
const GITHUB_SEARCH_QUERY = "MCP server OR modelcontextprotocol in:topic";

// 重试配置
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000; // 1秒基础延迟

// API 响应类型
interface RegistryListResponse {
  servers: RegistryServer[];
  total: number;
  page: number;
  pageSize: number;
}

interface RegistryServer {
  name: string;
  description: string;
  categories: string[];
  tools: string[];
  repository?: string;
  homepage?: string;
  license?: string;
  language?: string;
  stars?: number;
  downloads?: number;
  version?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface RegistryDetailResponse extends RegistryServer {
  fullName?: string;
  forks?: number;
  npmPackage?: string;
  dockerImage?: string;
  installation?: {
    command?: string;
    args?: string[];
    env?: Record<string, string>;
  };
  readme?: string;
}

// GitHub 搜索响应
interface GitHubSearchItem {
  name: string;
  full_name: string;
  description: string;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  topics: string[];
  language: string;
  license: { spdx_id: string } | null;
  updated_at: string;
  homepage: string | null;
}

interface GitHubSearchResponse {
  total_count: number;
  incomplete_results: boolean;
  items: GitHubSearchItem[];
}

export class RegistryService {
  private client: AxiosInstance;
  private githubClient: AxiosInstance;
  private cache: Map<string, { data: ToolCandidate; expires: number }> = new Map();
  private readonly CACHE_TTL: number;

  constructor() {
    // 主 Registry API 客户端
    this.client = axios.create({
      baseURL: REGISTRY_API_BASE,
      timeout: REGISTRY_API_TIMEOUT_MS,
      headers: {
        "Accept": "application/json",
        "User-Agent": "tool-optimizer-mcp/1.0.0",
      },
    });

    // GitHub API 客户端 (用于后备搜索)
    this.githubClient = axios.create({
      baseURL: GITHUB_API_BASE,
      timeout: REGISTRY_API_TIMEOUT_MS,
      headers: {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "tool-optimizer-mcp/1.0.0",
      },
    });

    this.CACHE_TTL = REGISTRY_CACHE_TTL_MS;
  }

  /**
   * 带重试的请求执行器
   */
  private async executeWithRetry<T>(
    request: () => Promise<T>,
    fallback: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await request();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // 检查是否是可重试的错误 (网络错误、5xx服务器错误)
        const isRetryable = this.isRetryableError(error);
        
        if (isRetryable && attempt < MAX_RETRIES - 1) {
          // 指数退避延迟
          const delay = RETRY_DELAY_BASE * Math.pow(2, attempt);
          console.warn(`${operationName} 请求失败 (尝试 ${attempt + 1}/${MAX_RETRIES}), ${delay}ms 后重试...`);
          await this.sleep(delay);
          continue;
        }
        
        // 达到最大重试次数或不可重试错误，尝试后备方案
        break;
      }
    }

    // 所有重试都失败，尝试后备方案
    console.warn(`${operationName} 最终失败，尝试后备方案:`, lastError?.message);
    return fallback();
  }

  /**
   * 判断错误是否可重试
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof AxiosError) {
      // 网络错误
      if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
        return true;
      }
      // 服务器错误 (5xx)
      if (error.response?.status && error.response.status >= 500) {
        return true;
      }
      // 速率限制 (429)
      if (error.response?.status === 429) {
        return true;
      }
    }
    return false;
  }

  /**
   * 睡眠工具
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 搜索 MCP 服务器
   */
  async search(filter: SearchFilter, limit: number = 10): Promise<ToolCandidate[]> {
    return this.executeWithRetry(
      async () => {
        const params: Record<string, string | number> = { limit };
        if (filter.query) params.q = filter.query;
        if (filter.category) params.category = filter.category;
        if (filter.sortBy) params.sort = filter.sortBy;

        const response = await this.client.get<RegistryListResponse>(
          `${API_PREFIX}/servers`,
          { params }
        );
        return response.data.servers.map((s) => this.mapToCandidate(s));
      },
      async () => this.fallbackGitHubSearch(filter, limit),
      "搜索"
    );
  }

  /**
   * 获取服务器详情
   */
  async getDetails(name: string): Promise<ToolCandidate | null> {
    // 检查缓存
    const cached = this.cache.get(name);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    return this.executeWithRetry(
      async () => {
        const response = await this.client.get<RegistryDetailResponse>(
          `${API_PREFIX}/servers/${encodeURIComponent(name)}`
        );
        const candidate = this.mapDetailToCandidate(response.data);
        this.cache.set(name, {
          data: candidate,
          expires: Date.now() + this.CACHE_TTL,
        });
        return candidate;
      },
      async () => this.fallbackGetDetailsFromGitHub(name),
      `获取详情 ${name}`
    );
  }

  /**
   * 获取热门服务器
   */
  async getPopular(limit: number = 10): Promise<ToolCandidate[]> {
    return this.executeWithRetry(
      async () => {
        const response = await this.client.get<RegistryListResponse>(
          `${API_PREFIX}/servers/popular`,
          { params: { limit } }
        );
        return response.data.servers.map((s) => this.mapToCandidate(s));
      },
      async () => this.fallbackGitHubSearch({ sortBy: "stars" }, limit),
      "获取热门服务器"
    );
  }

  /**
   * 获取分类列表
   */
  async getCategories(): Promise<string[]> {
    return this.executeWithRetry(
      async () => {
        const response = await this.client.get<string[]>(`${API_PREFIX}/categories`);
        return response.data;
      },
      () => Promise.resolve(this.getDefaultCategories()),
      "获取分类列表"
    );
  }

  /**
   * 根据关键词搜索相关工具
   */
  async findRelatedTools(keywords: string[]): Promise<ToolCandidate[]> {
    const results: ToolCandidate[] = [];

    for (const keyword of keywords) {
      const tools = await this.search({ query: keyword }, 5);
      results.push(...tools);
    }

    // 去重
    const unique = new Map<string, ToolCandidate>();
    for (const tool of results) {
      if (!unique.has(tool.name)) {
        unique.set(tool.name, tool);
      }
    }

    return Array.from(unique.values());
  }

  /**
   * 比较两个工具
   */
  async compareTools(name1: string, name2: string): Promise<{
    tool1: ToolCandidate | null;
    tool2: ToolCandidate | null;
  }> {
    const [tool1, tool2] = await Promise.all([
      this.getDetails(name1),
      this.getDetails(name2),
    ]);

    return { tool1, tool2 };
  }

  /**
   * GitHub 搜索后备方案
   * 使用 GitHub Topic 搜索 MCP 相关仓库
   */
  private async fallbackGitHubSearch(
    filter: SearchFilter,
    limit: number
  ): Promise<ToolCandidate[]> {
    try {
      // 构建搜索查询
      let query = GITHUB_SEARCH_QUERY;
      if (filter.query) {
        query += ` ${filter.query}`;
      }
      if (filter.category) {
        query += ` topic:${filter.category}`;
      }

      const sort = filter.sortBy === "stars" ? "stars" : "updated";
      
      const response = await this.githubClient.get<GitHubSearchResponse>(
        "/search/repositories",
        {
          params: {
            q: query,
            sort,
            per_page: limit,
          },
        }
      );

      return response.data.items.map((item) => this.mapGitHubToCandidate(item));
    } catch (error) {
      console.error("GitHub 搜索后备失败:", error);
      return [];
    }
  }

  /**
   * 从 GitHub 获取工具详情
   */
  private async fallbackGetDetailsFromGitHub(name: string): Promise<ToolCandidate | null> {
    try {
      // 尝试将 name 作为完整仓库名处理
      const response = await this.githubClient.get(
        `/repos/${encodeURIComponent(name)}`
      );
      return this.mapGitHubRepoToCandidate(response.data as Parameters<typeof this.mapGitHubRepoToCandidate>[0]);
    } catch (error) {
      console.error(`GitHub 获取 ${name} 详情失败:`, error);
      return null;
    }
  }

  /**
   * 映射 GitHub 搜索结果到 ToolCandidate
   */
  private mapGitHubToCandidate(item: GitHubSearchItem): ToolCandidate {
    return {
      name: item.name,
      fullName: item.full_name,
      description: item.description || "",
      stars: item.stargazers_count,
      forks: item.forks_count,
      license: item.license?.spdx_id || "Unknown",
      language: item.language || "Unknown",
      homepage: item.homepage || `https://github.com/${item.full_name}`,
      repository: `https://github.com/${item.full_name}`,
      categories: item.topics?.filter(t => t.startsWith("mcp-")).map(t => t.replace("mcp-", "")) || [],
      tools: [], // GitHub 搜索不提供工具列表
      lastUpdated: item.updated_at,
    };
  }

  /**
   * 映射 GitHub 仓库详情到 ToolCandidate
   */
  private mapGitHubRepoToCandidate(repo: {
    name: string;
    full_name: string;
    description: string | null;
    stargazers_count: number;
    forks_count: number;
    topics: string[];
    language: string;
    license: { spdx_id: string } | null;
    updated_at: string;
    homepage: string | null;
  }): ToolCandidate {
    return {
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description || "",
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      license: repo.license?.spdx_id || "Unknown",
      language: repo.language || "Unknown",
      homepage: repo.homepage || `https://github.com/${repo.full_name}`,
      repository: `https://github.com/${repo.full_name}`,
      categories: repo.topics?.filter(t => t.startsWith("mcp-")).map(t => t.replace("mcp-", "")) || [],
      tools: [],
      lastUpdated: repo.updated_at,
    };
  }

  /**
   * 映射 Registry 响应到 ToolCandidate
   */
  private mapToCandidate(server: RegistryServer): ToolCandidate {
    return {
      name: server.name,
      fullName: server.name,
      description: server.description,
      stars: server.stars || 0,
      forks: 0,
      license: server.license || "Unknown",
      language: server.language || "Unknown",
      homepage: server.homepage,
      repository: server.repository,
      categories: server.categories || [],
      tools: server.tools || [],
      lastUpdated: server.updatedAt,
      npmPackage: server.name,
    };
  }

  /**
   * 映射详情响应
   */
  private mapDetailToCandidate(detail: RegistryDetailResponse): ToolCandidate {
    return {
      name: detail.name,
      fullName: detail.fullName || detail.name,
      description: detail.description,
      stars: detail.stars || 0,
      forks: detail.forks || 0,
      license: detail.license || "Unknown",
      language: detail.language || "Unknown",
      homepage: detail.homepage,
      repository: detail.repository,
      categories: detail.categories || [],
      tools: detail.tools || [],
      lastUpdated: detail.updatedAt,
      npmPackage: detail.npmPackage,
      dockerImage: detail.dockerImage,
    };
  }

  /**
   * 默认分类列表
   */
  private getDefaultCategories(): string[] {
    return [
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
    ];
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// 导出单例
export const registryService = new RegistryService();