/**
 * Vitest 测试配置
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // 测试环境
    environment: "node",
    
    // 全局测试超时 (30秒)
    testTimeout: 30000,
    
    // 全局 hook 超时
    hookTimeout: 10000,
    
    // 启用源码映射 (方便调试)
    sourceMap: true,
    
    // 测试输出
    reporters: ["verbose"],
  },
});