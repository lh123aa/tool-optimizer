/**
 * Constants 工具测试
 */
import { describe, it, expect } from "vitest";
import {
  SCORE_WEIGHTS,
  STAR_THRESHOLDS,
  FORK_THRESHOLDS,
  TOKEN_CONSUMPTION_THRESHOLDS,
  BASE_SCORE,
  NO_DATA_SCORE,
  REGISTRY_API_TIMEOUT_MS,
  REGISTRY_CACHE_TTL_MS,
  REGISTRY_MAX_CACHE_SIZE,
} from "../../src/utils/constants.js";

describe("Constants - 评分权重", () => {
  it("SCORE_WEIGHTS 总和应等于 1", () => {
    const total = 
      SCORE_WEIGHTS.efficiency +
      SCORE_WEIGHTS.reliability +
      SCORE_WEIGHTS.features +
      SCORE_WEIGHTS.token;
    expect(total).toBe(1);
  });

  it("SCORE_WEIGHTS 各属性应在有效范围内", () => {
    expect(SCORE_WEIGHTS.efficiency).toBeGreaterThan(0);
    expect(SCORE_WEIGHTS.efficiency).toBeLessThan(1);
    expect(SCORE_WEIGHTS.reliability).toBeGreaterThan(0);
    expect(SCORE_WEIGHTS.reliability).toBeLessThan(1);
    expect(SCORE_WEIGHTS.features).toBeGreaterThan(0);
    expect(SCORE_WEIGHTS.features).toBeLessThan(1);
    expect(SCORE_WEIGHTS.token).toBeGreaterThan(0);
    expect(SCORE_WEIGHTS.token).toBeLessThan(1);
  });
});

describe("Constants - Star 阈值", () => {
  it("HIGH > MEDIUM > LOW", () => {
    expect(STAR_THRESHOLDS.HIGH).toBeGreaterThan(STAR_THRESHOLDS.MEDIUM);
    expect(STAR_THRESHOLDS.MEDIUM).toBeGreaterThan(STAR_THRESHOLDS.LOW);
  });

  it("阈值应为正数", () => {
    expect(STAR_THRESHOLDS.HIGH).toBeGreaterThan(0);
    expect(STAR_THRESHOLDS.MEDIUM).toBeGreaterThan(0);
    expect(STAR_THRESHOLDS.LOW).toBeGreaterThan(0);
  });
});

describe("Constants - Fork 阈值", () => {
  it("HIGH > MEDIUM", () => {
    expect(FORK_THRESHOLDS.HIGH).toBeGreaterThan(FORK_THRESHOLDS.MEDIUM);
  });

  it("阈值应为正数", () => {
    expect(FORK_THRESHOLDS.HIGH).toBeGreaterThan(0);
    expect(FORK_THRESHOLDS.MEDIUM).toBeGreaterThan(0);
  });
});

describe("Constants - Token 消耗阈值", () => {
  it("LOW < MEDIUM < HIGH < VERY_HIGH", () => {
    expect(TOKEN_CONSUMPTION_THRESHOLDS.LOW).toBeLessThan(TOKEN_CONSUMPTION_THRESHOLDS.MEDIUM);
    expect(TOKEN_CONSUMPTION_THRESHOLDS.MEDIUM).toBeLessThan(TOKEN_CONSUMPTION_THRESHOLDS.HIGH);
    expect(TOKEN_CONSUMPTION_THRESHOLDS.HIGH).toBeLessThan(TOKEN_CONSUMPTION_THRESHOLDS.VERY_HIGH);
  });
});

describe("Constants - 基础分", () => {
  it("BASE_SCORE 应为 70", () => {
    expect(BASE_SCORE).toBe(70);
  });

  it("NO_DATA_SCORE 应为合理值", () => {
    expect(NO_DATA_SCORE).toBeGreaterThan(0);
    expect(NO_DATA_SCORE).toBeLessThan(100);
  });
});

describe("Constants - Registry API 配置", () => {
  it("API 超时应为正数", () => {
    expect(REGISTRY_API_TIMEOUT_MS).toBeGreaterThan(0);
  });

  it("缓存 TTL 应为正数 (毫秒)", () => {
    expect(REGISTRY_CACHE_TTL_MS).toBeGreaterThan(0);
  });

  it("最大缓存条目应为正数", () => {
    expect(REGISTRY_MAX_CACHE_SIZE).toBeGreaterThan(0);
  });
});