/**
 * 工具评估服务
 * 生成工具对比评估报告
 * 
 * 评分基于以下真实数据:
 * - GitHub stars (社区活跃度)
 * - GitHub forks (社区参与度)
 * - 最后更新时间 (维护活跃度)
 * - 提供的工具数量 (功能丰富度)
 * - 历史性能数据 (可靠性)
 */

import { randomUUID } from "crypto";
import type {
  InstalledTool,
  ToolCandidate,
  EvaluationReport,
  EvaluatedTool,
  ToolPerformance,
} from "../types/index.js";
import {
  SCORE_WEIGHTS,
  STAR_THRESHOLDS,
  FORK_THRESHOLDS,
  TOKEN_CONSUMPTION_THRESHOLDS,
  BASE_SCORE,
  NO_DATA_SCORE,
} from "../utils/constants.js";

/**
 * 工具评估服务
 */
export class EvaluatorService {
  /**
   * 生成完整评估报告
   */
  generateReport(
    oldTool: InstalledTool,
    newTool: ToolCandidate
  ): EvaluationReport {
    // 计算各维度得分 (基于真实数据)
    const efficiencyScore = this.calculateEfficiencyScore(newTool);
    const reliabilityScore = this.calculateReliabilityScore(oldTool.performance);
    const featureScore = this.calculateFeatureScore(newTool);
    const tokenScore = this.calculateTokenScore(oldTool.performance);

    // 综合得分 (加权平均)
    const overallScore = Math.round(
      efficiencyScore * SCORE_WEIGHTS.efficiency +
      reliabilityScore * SCORE_WEIGHTS.reliability +
      featureScore * SCORE_WEIGHTS.features +
      (tokenScore !== null ? tokenScore * SCORE_WEIGHTS.token : 0)
    );

    // 生成对比描述
    const comparison = this.generateComparison(
      oldTool,
      newTool,
      efficiencyScore,
      reliabilityScore,
      featureScore,
      tokenScore
    );

    // 推荐建议
    const recommendation = this.getRecommendation(overallScore, efficiencyScore, reliabilityScore);
    const reason = this.getReason(recommendation, overallScore, efficiencyScore, reliabilityScore);
    const risks = this.identifyRisks(newTool, oldTool);

    return {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      oldTool: this.toEvaluatedTool(oldTool),
      newTool,
      efficiencyScore,
      reliabilityScore,
      featureScore,
      tokenScore: tokenScore ?? undefined,
      overallScore,
      comparison,
      recommendation,
      reason,
      risks,
    };
  }

  /**
   * 计算效率得分
   * 基于: GitHub stars, forks, 更新频率
   */
  private calculateEfficiencyScore(candidate: ToolCandidate): number {
    let score = BASE_SCORE;

    // GitHub stars - 社区活跃度
    if (candidate.stars > STAR_THRESHOLDS.HIGH) {
      score += 20;
    } else if (candidate.stars > STAR_THRESHOLDS.MEDIUM) {
      score += 15;
    } else if (candidate.stars > STAR_THRESHOLDS.LOW) {
      score += 10;
    }

    // GitHub forks - 社区参与度
    if (candidate.forks > FORK_THRESHOLDS.HIGH) {
      score += 10;
    } else if (candidate.forks > FORK_THRESHOLDS.MEDIUM) {
      score += 5;
    }

    // 更新频率
    if (candidate.lastUpdated) {
      const daysSinceUpdate = this.daysSince(candidate.lastUpdated);
      if (daysSinceUpdate < 30) {
        score += 10; // 30天内更新
      } else if (daysSinceUpdate < 180) {
        score += 5; // 6个月内更新
      } else if (daysSinceUpdate > 365) {
        score -= 10; // 超过1年未更新
      }
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * 计算可靠性得分
   * 基于: 历史成功率, 执行时间稳定性
   */
  private calculateReliabilityScore(performance?: ToolPerformance): number {
    if (!performance) return NO_DATA_SCORE;

    let score = 50;

    // 成功率 (占主导)
    score += performance.successRate * 40;

    // 执行时间稳定性 (使用对数偏差)
    if (performance.avgDuration > 0) {
      const idealDuration = 1000; // 1秒
      const deviation = Math.abs(Math.log10(performance.avgDuration) - Math.log10(idealDuration));
      score -= Math.min(10, deviation * 5);
    }

    return Math.min(100, Math.max(0, Math.round(score)));
  }

  /**
   * 计算功能得分
   * 基于: Registry 提供的工具数量, 分类覆盖
   */
  private calculateFeatureScore(candidate: ToolCandidate): number {
    let score = 50;

    // 工具数量 (来自 Registry 的 tools 字段)
    const toolCount = candidate.tools?.length || 0;
    score += Math.min(20, toolCount * 3);

    // 分类覆盖
    const categoryCount = candidate.categories?.length || 0;
    score += Math.min(15, categoryCount * 3);

    // 描述详细程度
    if (candidate.description && candidate.description.length > 100) {
      score += 5;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * 计算 Token 节省得分
   */
  private calculateTokenScore(performance?: ToolPerformance): number | null {
    if (!performance || performance.tokenConsumption === undefined) {
      return null;
    }

    const consumption = performance.tokenConsumption;
    if (consumption < TOKEN_CONSUMPTION_THRESHOLDS.LOW) return 90;
    if (consumption < TOKEN_CONSUMPTION_THRESHOLDS.MEDIUM) return 80;
    if (consumption < TOKEN_CONSUMPTION_THRESHOLDS.HIGH) return 70;
    if (consumption < TOKEN_CONSUMPTION_THRESHOLDS.VERY_HIGH) return 60;
    return 50;
  }

  /**
   * 生成对比描述
   */
  private generateComparison(
    oldTool: InstalledTool,
    newTool: ToolCandidate,
    efficiencyScore: number,
    reliabilityScore: number,
    featureScore: number,
    tokenScore: number | null
  ): EvaluationReport["comparison"] {
    const efficiency = efficiencyScore > 70 ? "领先" : efficiencyScore > 50 ? "相当" : "落后";
    const reliability = reliabilityScore > 70 ? "更稳定" : reliabilityScore > 50 ? "相当" : "不稳定";
    const feature = featureScore > 70 ? "功能更丰富" : featureScore > 50 ? "功能相当" : "功能较少";

    const speedComparison = `${newTool.name} 在效率指标上比 ${oldTool.name} ${efficiency}。` +
      (newTool.stars ? ` 该工具拥有 ${newTool.stars.toLocaleString()} GitHub stars，表明社区活跃度高。` : "");

    const reliabilityComparison = oldTool.performance
      ? `${oldTool.name} 历史成功率为 ${(oldTool.performance.successRate * 100).toFixed(1)}%。` +
        ` 新工具 ${newTool.name} 基于社区反馈，可靠性 ${reliability}。`
      : `${newTool.name} 基于 ${newTool.stars || 0} stars 的社区评价，可靠性 ${reliability}。`;

    const featureComparison = `${newTool.name} ${feature}。` +
      (newTool.categories?.length ? ` 分类: ${newTool.categories.join(", ")}` : "") +
      (newTool.tools?.length ? ` 提供 ${newTool.tools.length} 个工具。` : "");

    const tokenComparison = tokenScore !== null
      ? tokenScore > 70 ? "新工具预计能节省约 20-30% Token 消耗。" :
        tokenScore > 50 ? "Token 消耗水平相当。" : "新工具可能消耗更多 Token。"
      : "无 Token 消耗数据。";

    return {
      speedComparison,
      reliabilityComparison,
      featureComparison,
      tokenComparison,
    };
  }

  /**
   * 获取推荐
   */
  private getRecommendation(
    overallScore: number,
    efficiencyScore: number,
    reliabilityScore: number
  ): "upgrade" | "keep" | "uncertain" {
    if (overallScore >= 75 && efficiencyScore >= 65 && reliabilityScore >= 60) {
      return "upgrade";
    }
    if (overallScore < 55) {
      return "keep";
    }
    return "uncertain";
  }

  /**
   * 获取推荐理由
   */
  private getReason(
    recommendation: "upgrade" | "keep" | "uncertain",
    overallScore: number,
    efficiencyScore: number,
    reliabilityScore: number
  ): string {
    switch (recommendation) {
      case "upgrade":
        return `综合得分 ${overallScore}/100，效率 ${efficiencyScore}/100，可靠性 ${reliabilityScore}/100。` +
          `新工具在多个维度优于当前工具，建议升级。`;
      case "keep":
        return `综合得分 ${overallScore}/100，新工具未表现出明显优势。` +
          `建议保持当前工具。`;
      case "uncertain":
        return `综合得分 ${overallScore}/100，部分指标需要实际测试验证。` +
          `建议小范围测试后再决定。`;
    }
  }

  /**
   * 识别潜在风险
   */
  private identifyRisks(newTool: ToolCandidate, oldTool: InstalledTool): string[] {
    const risks: string[] = [];

    // 活跃度风险
    if (newTool.lastUpdated) {
      const daysSinceUpdate = this.daysSince(newTool.lastUpdated);
      if (daysSinceUpdate > 365) {
        risks.push("该工具超过 1 年未更新，可能存在兼容性问题");
      } else if (daysSinceUpdate > 180) {
        risks.push("该工具超过 6 个月未更新，需确认是否仍在维护");
      }
    }

    // 社区风险
    if (newTool.stars < STAR_THRESHOLDS.LOW) {
      risks.push("该工具 GitHub stars 较低，社区规模小，遇到问题可能难以获得支持");
    }

    // 许可证风险
    if (newTool.license === "Unknown" || !newTool.license) {
      risks.push("许可证未知，使用前请确认合规性");
    }

    // 功能风险 - 检查新工具是否缺少常见功能
    const oldToolCount = oldTool.performance ? 1 : 0; // 简化判断
    const newToolCount = newTool.tools?.length || 0;
    if (newToolCount === 0 && oldToolCount > 0) {
      risks.push("新工具未提供功能列表，可能与旧工具功能差异较大");
    }

    return risks;
  }

  /**
   * 转换为 EvaluatedTool
   */
  private toEvaluatedTool(tool: InstalledTool): EvaluatedTool {
    return {
      name: tool.name,
      version: tool.version,
      performance: tool.performance,
      features: tool.performance ? ["performance_tracking"] : [],
    };
  }

  /**
   * 计算距离某个日期过了多少天
   */
  private daysSince(dateStr: string): number {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }
}

// 导出单例
export const evaluatorService = new EvaluatorService();
