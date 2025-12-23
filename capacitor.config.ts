import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.maestro.demo002',
  appName: 'Maestro',
  webDir: 'dist',
  android: {
    // 强制 WebView 使用正确的视口设置
    webContentsDebuggingEnabled: true,
    allowMixedContent: true,
    initialFocus: true
  },
  server: {
    // 确保资源正确加载
    androidScheme: 'https'
  }
};

export default config;
