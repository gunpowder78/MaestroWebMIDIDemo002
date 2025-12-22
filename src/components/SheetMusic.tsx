import React, { useRef, useEffect, useState, useMemo } from 'react';
import type { TimingPoint } from '../config/snow_timing';

interface SheetMusicProps {
  /**
   * 当前物理引擎的时间（秒）
   */
  currentSeconds: number;
  /**
   * 解析后的时间-坐标映射表
   */
  timingData: TimingPoint[];
  /**
   * 初始偏移量（可选）
   */
  scoreOffset?: number;
}

/**
 * SheetMusic Component (Adaptive Timing Edition)
 * 根据时间驱动和预设的像素映射表进行声画同步。
 */
export const SheetMusic: React.FC<SheetMusicProps> = ({ 
  currentSeconds,
  timingData,
  scoreOffset = 0
}) => {
  const imgRef = useRef<HTMLImageElement>(null);
  // 状态：图片实际渲染宽度
  const [currentWidth, setCurrentWidth] = useState(0);

  // 使用 ResizeObserver 监听图片实际宽度变化
  useEffect(() => {
    if (!imgRef.current) return;
    
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === imgRef.current) {
          setCurrentWidth(entry.contentRect.width);
        }
      }
    });

    observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, []);

  /**
   * 核心插值逻辑
   * 使用校准过的 PS_MEASURE_WIDTH 作为缩放基准
   */
  const translateX = useMemo(() => {
    if (currentWidth === 0 || !timingData || timingData.length === 0) return scoreOffset;

    const currentTime = currentSeconds;
    
    // 1. 区间查找
    let prev = timingData[0];
    let next = timingData[0];

    if (currentTime <= timingData[0].time) {
      prev = timingData[0];
      next = timingData[0];
    } else if (currentTime >= timingData[timingData.length - 1].time) {
      prev = timingData[timingData.length - 1];
      next = timingData[timingData.length - 1];
    } else {
      for (let i = 0; i < timingData.length - 1; i++) {
        if (currentTime >= timingData[i].time && currentTime < timingData[i + 1].time) {
          prev = timingData[i];
          next = timingData[i + 1];
          break;
        }
      }
    }

    // 2. 线性插值计算目标坐标
    let targetX = prev.x;
    if (next.time !== prev.time) {
      const progress = (currentTime - prev.time) / (next.time - prev.time);
      targetX = prev.x + (next.x - prev.x) * progress;
    }

    // 3. 使用校准过的基准宽度进行缩放
    // PS_MEASURE_WIDTH = 28500 是经过多次测试校准的值
    const PS_MEASURE_WIDTH = 28500;
    const browserX = targetX * (currentWidth / PS_MEASURE_WIDTH);

    // 4. 最终位移
    return scoreOffset - browserX;
  }, [currentSeconds, timingData, currentWidth, scoreOffset]);

  return (
    <div className="w-full h-[770px] overflow-hidden relative border-y border-zinc-800 bg-black shadow-inner flex items-center">
      <div 
        className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-red-500 z-50 opacity-80 shadow-[0_0_10px_rgba(239,68,68,0.7)]"
        aria-hidden="true"
      />

      <div
        className="absolute left-1/2 h-full will-change-transform flex items-center"
        style={{
          transform: `translateX(${translateX}px)`,
          // 物理引擎驱动下，禁用 CSS 过渡以获得最精确的同步
          transition: 'none',
        }}
      >
        <img 
          ref={imgRef}
          src="/snow_visual.svg" 
          alt="Musical Score" 
          className="h-full w-auto max-w-none block"
          onLoad={() => {
            if (imgRef.current) setCurrentWidth(imgRef.current.offsetWidth);
          }}
          style={{ 
            imageRendering: 'auto',
            filter: 'invert(1) brightness(2)',
            objectFit: 'contain'
          }}
        />
      </div>

      <div className="absolute left-0 top-0 bottom-0 w-24 bg-linear-to-r from-black to-transparent pointer-events-none z-30" />
      <div className="absolute right-0 top-0 bottom-0 w-24 bg-linear-to-l from-black to-transparent pointer-events-none z-30" />
    </div>
  );
};

export default SheetMusic;
