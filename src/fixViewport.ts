/**
 * Fix Viewport for Android WebViews (Huawei P30 Pro specific)
 * 
 * This script forces the root element to match window.innerHeight precisely,
 * bypassing CSS vh/dvh issues on some Android WebViews.
 */

export function initViewportFix() {
  function forceLayout() {
    // 强制读取 JS 像素高度，无视 CSS 计算
    const h = window.innerHeight;
    const w = window.innerWidth;
    const root = document.getElementById('root');
    
    if (root) {
      root.style.position = 'fixed';
      root.style.top = '0px';
      root.style.left = '0px';
      root.style.width = w + 'px';
      root.style.height = h + 'px';
      root.style.overflow = 'hidden';
    }
    
    // Apply to body as well to be safe
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.overflow = 'hidden';
    document.body.style.backgroundColor = '#000';
  }

  window.addEventListener('resize', forceLayout);
  window.addEventListener('load', forceLayout);
  setInterval(forceLayout, 1000); // 暴力轮询防止键盘顶起失效
  
  // Apply immediately
  forceLayout();

  // 禁止橡皮筋滚动
  document.body.addEventListener('touchmove', function(e) {
    // @ts-ignore
    if (!e.target.closest('.scrollable')) e.preventDefault();
  }, { passive: false });
  
  console.log('[ViewportFix] Initialized nuclear layout adaptation');
}
