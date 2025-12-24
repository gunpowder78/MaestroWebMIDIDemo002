/**
 * 纯 esbuild + Tailwind CSS 构建脚本
 * 完全绕过 Vite/Rollup，用于解决 Node.js v24 兼容性问题
 */
import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const outDir = 'dist';
const publicDir = 'public';

console.log('🚀 Starting build...');

// 清理输出目录
if (fs.existsSync(outDir)) {
  fs.rmSync(outDir, { recursive: true });
  console.log('✓ Cleaned dist/');
}
fs.mkdirSync(outDir);
fs.mkdirSync(path.join(outDir, 'assets'));

// 复制 public 目录内容
function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const item of fs.readdirSync(src)) {
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyDir(publicDir, outDir);
console.log('✓ Copied public assets');

async function build() {
  try {
    // Step 1: 构建 JS/TSX (esbuild 会内联 CSS)
    console.log('📦 Building JavaScript...');
    await esbuild.build({
      entryPoints: ['src/main.tsx'],
      bundle: true,
      outfile: path.join(outDir, 'assets/main.js'),
      format: 'esm',
      target: 'es2020',
      loader: {
        '.tsx': 'tsx',
        '.ts': 'ts',
        '.jsx': 'jsx',
        '.js': 'js',
        '.css': 'css', // esbuild 会处理 CSS import
        '.png': 'file',
        '.jpg': 'file',
        '.svg': 'file',
        '.gif': 'file',
        '.woff': 'file',
        '.woff2': 'file',
        '.ttf': 'file',
        '.eot': 'file',
        '.mid': 'file',
      },
      assetNames: 'assets/[name]',
      publicPath: './',
      minify: false,
      sourcemap: false,
      define: {
        'process.env.NODE_ENV': '"production"',
      },
      jsx: 'automatic',
      metafile: true,
    });
    console.log('✓ JavaScript bundled');

    // Step 2: 使用 Tailwind CLI 处理 CSS
    console.log('🎨 Processing Tailwind CSS...');
    execSync('npx tailwindcss -i src/index.css -o dist/assets/style.css --minify', {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    console.log('✓ Tailwind CSS processed');

    // Step 3: 生成优化的 index.html
    console.log('📄 Generating index.html...');
    const htmlTemplate = fs.readFileSync('index.html', 'utf-8');
    const processedHtml = htmlTemplate
      // CSS 在 head 中加载
      .replace(
        '</head>',
        '    <link rel="stylesheet" href="./assets/style.css">\n  </head>'
      )
      // JS 替换
      .replace(
        /<script type="module" src="\/src\/main\.tsx"><\/script>/,
        '<script type="module" src="./assets/main.js"></script>'
      );
    
    fs.writeFileSync(path.join(outDir, 'index.html'), processedHtml);
    console.log('✓ index.html generated');

    // 输出构建摘要
    console.log('\n✅ Build completed successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📁 Output: ${outDir}/`);
    
    const files = fs.readdirSync(path.join(outDir, 'assets'));
    let totalSize = 0;
    for (const file of files) {
      const stat = fs.statSync(path.join(outDir, 'assets', file));
      const sizeKB = (stat.size / 1024).toFixed(2);
      totalSize += stat.size;
      console.log(`   📄 assets/${file}: ${sizeKB} KB`);
    }
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📊 Total: ${(totalSize / 1024).toFixed(2)} KB`);

  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

build();
