/// <reference types="vite/client" />

// SVG 模块声明，允许导入 SVG 文件作为 URL
declare module '*.svg' {
  const src: string;
  export default src;
}

// 其他资源类型声明（可选，根据需要添加）
declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.jpg' {
  const src: string;
  export default src;
}

declare module '*.jpeg' {
  const src: string;
  export default src;
}
