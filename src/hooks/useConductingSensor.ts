import { useState, useEffect, useRef, useCallback } from 'react';

interface ConductingSensorOptions {
  threshold?: number;       // 加速度阈值 (默认 15.0)
  debounceMs?: number;      // 最小间隔 (默认 300ms)
  onBeat?: (bpm?: number) => void; // 检测到节拍时的回调
}

/**
 * useConductingSensor Hook
 * 
 * 移植自 AI Studio 早期 Demo 算法：
 * 监听手机加速度计，识别"挥动手柄"或"敲击空气"的动作，并计算 Tap Tempo。
 * 
 * 默认开启！
 */
export function useConductingSensor(options: ConductingSensorOptions = {}) {
  const { threshold = 15.0, debounceMs = 300, onBeat } = options;

  // UI 状态 - 默认全部为 ON
  const [isActive, setIsActive] = useState(true);
  const [hasPermission, _setHasPermission] = useState<boolean | null>(true);
  const [error, _setError] = useState<string | null>(null);
  // (Note: _setHasPermission and _setError are intentionally unused in simplified version)
  void _setHasPermission; void _setError;

  // 用 ref 存储最新的回调，避免闭包陈旧问题
  const onBeatRef = useRef(onBeat);
  const thresholdRef = useRef(threshold);
  const debounceMsRef = useRef(debounceMs);
  
  // 同步更新 ref
  useEffect(() => {
    onBeatRef.current = onBeat;
    thresholdRef.current = threshold;
    debounceMsRef.current = debounceMs;
  }, [onBeat, threshold, debounceMs]);

  // 算法内部状态
  const lastBeatTimeRef = useRef<number>(0);
  const tapHistoryRef = useRef<number[]>([]);
  const isListeningRef = useRef(false);

  /**
   * 核心处理函数（使用 ref 读取最新值，无依赖）
   */
  const handleMotion = useCallback((event: DeviceMotionEvent) => {
    const acc = event.acceleration;
    if (!acc) return;

    const x = acc.x || 0;
    const y = acc.y || 0;
    const z = acc.z || 0;

    const magnitude = Math.sqrt(x * x + y * y + z * z);
    const now = performance.now();

    if (magnitude > thresholdRef.current) {
      if (now - lastBeatTimeRef.current > debounceMsRef.current) {
        
        let calculatedBpm: number | undefined;
        if (lastBeatTimeRef.current > 0) {
          const diff = now - lastBeatTimeRef.current;
          const instantBpm = 60000 / diff;
          
          tapHistoryRef.current.push(instantBpm);
          if (tapHistoryRef.current.length > 3) tapHistoryRef.current.shift();
          
          const avgBpm = tapHistoryRef.current.reduce((a, b) => a + b, 0) / tapHistoryRef.current.length;
          calculatedBpm = Math.round(Math.max(30, Math.min(300, avgBpm)));
        }

        lastBeatTimeRef.current = now;
        
        // 使用 ref 调用最新的回调
        if (onBeatRef.current) {
          onBeatRef.current(calculatedBpm);
        }
      }
    }
  }, []); // 无依赖，函数引用永远稳定

  const startListening = useCallback(() => {
    if (!isListeningRef.current) {
      window.addEventListener('devicemotion', handleMotion);
      isListeningRef.current = true;
      setIsActive(true);
    }
  }, [handleMotion]);

  const stopListening = useCallback(() => {
    window.removeEventListener('devicemotion', handleMotion);
    isListeningRef.current = false;
    setIsActive(false);
  }, [handleMotion]);

  const toggle = useCallback(() => {
    if (isListeningRef.current) {
      stopListening();
    } else {
      startListening();
    }
  }, [startListening, stopListening]);

  // ========== 组件挂载时立即启动监听 ==========
  useEffect(() => {
    // 直接添加监听器（Android 不需要权限）
    window.addEventListener('devicemotion', handleMotion);
    isListeningRef.current = true;
    setIsActive(true);
    
    // 卸载时清理
    return () => {
      window.removeEventListener('devicemotion', handleMotion);
      isListeningRef.current = false;
    };
  }, [handleMotion]);

  return {
    isActive,
    hasPermission,
    error,
    toggle,
    requestPermission: startListening, // 兼容旧接口
  };
}

export default useConductingSensor;
