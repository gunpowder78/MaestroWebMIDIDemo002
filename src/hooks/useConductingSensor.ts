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
 * 监听手机加速度计，识别“挥动手柄”或“敲击空气”的动作，并计算 Tap Tempo。
 */
export function useConductingSensor(options: ConductingSensorOptions = {}) {
  const { threshold = 15.0, debounceMs = 300, onBeat } = options;

  const [isActive, setIsActive] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 算法内部状态
  const lastBeatTimeRef = useRef<number>(0);
  const tapHistoryRef = useRef<number[]>([]);

  /**
   * 核心处理函数：处理加速度数据
   */
  const handleMotion = useCallback((event: DeviceMotionEvent) => {
    const acc = event.acceleration;
    if (!acc) return;

    const x = acc.x || 0;
    const y = acc.y || 0;
    const z = acc.z || 0;

    // 计算三轴合力
    const magnitude = Math.sqrt(x * x + y * y + z * z);
    const now = performance.now();

    // 算法逻辑：超过阈值且不在去抖动时间内
    if (magnitude > threshold) {
      if (now - lastBeatTimeRef.current > debounceMs) {
        
        // 计算 Tap Tempo (最近 3 次的平均值)
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
        
        // 触发回调
        if (onBeat) {
          onBeat(calculatedBpm);
        }
      }
    }
  }, [threshold, debounceMs, onBeat]);

  /**
   * 请求传感器权限
   */
  const requestPermission = useCallback(async () => {
    try {
      // iOS 13+ 需要显式请求权限
      if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
        const response = await (DeviceMotionEvent as any).requestPermission();
        if (response === 'granted') {
          setHasPermission(true);
          startListening();
        } else {
          setHasPermission(false);
          setError('Permission denied');
        }
      } else {
        // Android 和其他旧设备直接尝试监听
        setHasPermission(true);
        startListening();
      }
    } catch (e) {
      console.error('[ConductingSensor] Permission error:', e);
      setError('Sensor not supported or permission failed');
    }
  }, []);

  const startListening = () => {
    window.addEventListener('devicemotion', handleMotion);
    setIsActive(true);
  };

  const stopListening = () => {
    window.removeEventListener('devicemotion', handleMotion);
    setIsActive(false);
  };

  /**
   * 切换监听状态
   */
  const toggle = useCallback(() => {
    if (isActive) {
      stopListening();
    } else {
      requestPermission();
    }
  }, [isActive, requestPermission]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      window.removeEventListener('devicemotion', handleMotion);
    };
  }, [handleMotion]);

  return {
    isActive,
    hasPermission,
    error,
    toggle,
    requestPermission,
  };
}

export default useConductingSensor;
