/**
 * 核弹级生产构建配置
 * 完全绕过 Rollup 的原生模块问题
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // 完全禁用所有优化
    minify: false,
    sourcemap: false,
    cssCodeSplit: false,
    
    // 使用 esbuild 而非 terser
    target: 'es2020',
    
    // Rollup 最小化配置
    rollupOptions: {
      // 禁用 tree-shaking 相关的复杂分析
      treeshake: false,
      output: {
        // 单文件输出，避免 chunk 处理
        manualChunks: undefined,
        inlineDynamicImports: true,
        // 简化输出格式
        format: 'es',
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    },
    
    // 忽略大小警告
    chunkSizeWarningLimit: 10000,
    
    // 禁用 CSS 模块化
    cssMinify: false
  },
  
  // esbuild 配置
  esbuild: {
    // 完全禁用压缩
    minify: false,
    minifyIdentifiers: false,
    minifySyntax: false,
    minifyWhitespace: false,
    // 保留调试信息
    keepNames: true
  }
})
