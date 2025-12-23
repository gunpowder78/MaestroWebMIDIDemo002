import React, { useRef, useEffect, useState, useMemo } from 'react';
import { RAW_TIMING_DATA, parseTimingData } from '../config/snow_timing';

interface ScoreRendererProps {
  currentTime: number;
  isPlaying: boolean;
}

/**
 * ScoreRenderer Component
 * 基于原 SheetMusic 组件适配，用于新版本的 App.tsx。
 */
const ScoreRenderer: React.FC<ScoreRendererProps> = ({ 
  currentTime
}) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const [currentWidth, setCurrentWidth] = useState(0);

  // 解析时间映射表
  const timingData = useMemo(() => parseTimingData(RAW_TIMING_DATA), []);
  const scoreOffset = -60; // 默认偏移量

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

  const translateX = useMemo(() => {
    if (currentWidth === 0 || !timingData || timingData.length === 0) return scoreOffset;

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

    let targetX = prev.x;
    if (next.time !== prev.time) {
      const progress = (currentTime - prev.time) / (next.time - prev.time);
      targetX = prev.x + (next.x - prev.x) * progress;
    }

    const PS_MEASURE_WIDTH = 28500;
    const browserX = targetX * (currentWidth / PS_MEASURE_WIDTH);

    return scoreOffset - browserX;
  }, [currentTime, timingData, currentWidth, scoreOffset]);

  return (
    <div className="w-full h-full overflow-hidden relative bg-black flex items-center">
      {/* 播放指针 */}
      <div 
        className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-red-500 z-50 opacity-80 shadow-[0_0_10px_rgba(239,68,68,0.7)]"
      />

      <div
        className="absolute left-1/2 h-full will-change-transform flex items-center"
        style={{
          transform: `translateX(${translateX}px)`,
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

      <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-black to-transparent pointer-events-none z-30" />
      <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-black to-transparent pointer-events-none z-30" />
    </div>
  );
};

export default ScoreRenderer;
