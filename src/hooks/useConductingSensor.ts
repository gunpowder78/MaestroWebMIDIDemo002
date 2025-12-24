import { useState, useEffect, useRef, useCallback } from 'react';

// v1.0.2: 超时锁定常量 - 停止挥动后多久认为用户已停止指挥
const IDLE_TIMEOUT = 1500; // 1.5 秒

interface ConductingSensorOptions {
  threshold?: number;       // 加速度阈值 (默认 15.0)
  debounceMs?: number;      // 最小间隔 (默认 300ms)
  onBeat?: (bpm?: number) => void; // 检测到节拍时的回调
  onConductingChange?: (isConducting: boolean) => void; // 指挥状态变化回调
}

/**
 * useConductingSensor Hook
 * 
 * 移植自 AI Studio 早期 Demo 算法：
 * 监听手机加速度计，识别"挥动手柄"或"敲击空气"的动作，并计算 Tap Tempo。
 * 
 * v1.0.2 新增：isConducting 状态和超时锁定机制
 * - 检测到节拍时 isConducting = true
 * - 超过 IDLE_TIMEOUT 无新节拍时 isConducting = false (速度锁定)
 * 
 * 默认开启！
 */
export function useConductingSensor(options: ConductingSensorOptions = {}) {
  const { threshold = 15.0, debounceMs = 300, onBeat, onConductingChange } = options;

  // UI 状态 - 默认全部为 ON
  const [isActive, setIsActive] = useState(true);
  const [isConducting, setIsConducting] = useState(false); // v1.0.2: 是否正在指挥
  const [hasPermission, _setHasPermission] = useState<boolean | null>(true);
  const [error, _setError] = useState<string | null>(null);
  // (Note: _setHasPermission and _setError are intentionally unused in simplified version)
  void _setHasPermission; void _setError;

  // 用 ref 存储最新的回调，避免闭包陈旧问题
  const onBeatRef = useRef(onBeat);
  const onConductingChangeRef = useRef(onConductingChange);
  const thresholdRef = useRef(threshold);
  const debounceMsRef = useRef(debounceMs);
  
  // 同步更新 ref
  useEffect(() => {
    onBeatRef.current = onBeat;
    onConductingChangeRef.current = onConductingChange;
    thresholdRef.current = threshold;
    debounceMsRef.current = debounceMs;
  }, [onBeat, onConductingChange, threshold, debounceMs]);

  // 算法内部状态
  const lastBeatTimeRef = useRef<number>(0);
  const tapHistoryRef = useRef<number[]>([]);
  const isListeningRef = useRef(false);
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // v1.0.2: 超时计时器

  /**
   * 设置指挥状态并触发回调
   */
  const updateConductingState = useCallback((newState: boolean) => {
    setIsConducting(prev => {
      if (prev !== newState) {
        onConductingChangeRef.current?.(newState);
        return newState;
      }
      return prev;
    });
  }, []);

  /**
   * 重置超时计时器 - 每次检测到节拍时调用
   */
  const resetIdleTimeout = useCallback(() => {
    // 清除现有计时器
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
    }
    
    // 设置新的超时计时器
    idleTimeoutRef.current = setTimeout(() => {
      updateConductingState(false); // 超时，锁定速度
    }, IDLE_TIMEOUT);
  }, [updateConductingState]);

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
        
        // v1.0.2: 设置指挥状态为 true 并重置超时
        updateConductingState(true);
        resetIdleTimeout();
        
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
  }, [updateConductingState, resetIdleTimeout]); // v1.0.2: 添加依赖

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
      // v1.0.2: 清理超时计时器
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
      }
    };
  }, [handleMotion]);

  return {
    isActive,
    isConducting, // v1.0.2: 是否正在指挥（用于 UI 显示速度锁定状态）
    hasPermission,
    error,
    toggle,
    requestPermission: startListening, // 兼容旧接口
  };
}

export default useConductingSensor;
