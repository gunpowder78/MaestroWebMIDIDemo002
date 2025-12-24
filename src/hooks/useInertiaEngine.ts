import { useRef, useCallback, useEffect, useState } from 'react';

/**
 * Physics & BPM constants
 */
const FRICTION = 0.98;         // Damping factor per frame
const BPM_DEFAULT = 80;        // Default beats per minute
const BEATS_PER_MEASURE = 4;   // Beats per measure (4/4 time assumed)

/**
 * Linear interpolation helper
 */
const lerp = (start: number, end: number, t: number) => {
  return start * (1 - t) + end * t;
};

export interface InertiaEngineState {
  velocity: number;
  measure: number;
  currentSeconds: number;
  isPlaying: boolean;
  currentBpm: number;
}

export interface InertiaEngineActions {
  triggerImpulse: () => void;
  togglePlay: () => void;
  stop: () => void;
  setTargetBpm: (bpm: number) => void;
}

export function useInertiaEngine(): InertiaEngineState & InertiaEngineActions {
  // --- Internal Physics State ---
  const velocityRef = useRef(0);
  const measureRef = useRef(0);
  const currentSecondsRef = useRef(0);
  const isPlayingInternalRef = useRef(false);
  
  // --- BPM State ---
  const targetBpmRef = useRef(BPM_DEFAULT);
  const currentBpmRef = useRef(BPM_DEFAULT);
  
  // --- Loop State ---
  const reqIdRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef(0);
  const lastUpdateRef = useRef(0);

  // --- External State (for React rendering) ---
  const [state, setState] = useState<InertiaEngineState>({
    velocity: 0,
    measure: 0,
    currentSeconds: 0,
    isPlaying: false,
    currentBpm: BPM_DEFAULT,
  });

  /**
   * Core update loop
   */
  const updatePhysics = useCallback((currentTime: number) => {
    if (!lastFrameTimeRef.current) {
      lastFrameTimeRef.current = currentTime;
    }
    const deltaTime = (currentTime - lastFrameTimeRef.current) / 1000;
    lastFrameTimeRef.current = currentTime;

    // 1. Velocity Update (Friction)
    // Velocity is now purely for visual feedback (conductor intensity)
    velocityRef.current *= FRICTION;
    if (velocityRef.current < 0.001) velocityRef.current = 0;

    // 2. Playback Logic
    // Even if velocity is 0, we continue playing if isPlayingInternalRef is true
    // There should be NO logic here that sets isPlayingInternalRef.current = false
    const isPlaying = isPlayingInternalRef.current;

    if (isPlaying) {
      // --- BPM Update ---
      // Smoothly transition currentBpm to targetBpm
      currentBpmRef.current = lerp(currentBpmRef.current, targetBpmRef.current, 0.1);

      // --- Time Update ---
      const beatsDelta = (currentBpmRef.current / 60) * deltaTime;
      measureRef.current += beatsDelta / BEATS_PER_MEASURE;

      const timeScale = currentBpmRef.current / BPM_DEFAULT;
      currentSecondsRef.current += deltaTime * timeScale;
    }

    // --- Update External State (Throttled to ~20fps) ---
    const now = performance.now();
    if (!lastUpdateRef.current || now - lastUpdateRef.current > 50) {
      lastUpdateRef.current = now;
      setState({
        velocity: velocityRef.current,
        measure: measureRef.current,
        currentSeconds: currentSecondsRef.current,
        isPlaying: isPlaying,
        currentBpm: Math.round(currentBpmRef.current),
      });
    }

    // --- Loop Continuation (CRUISE CONTROL FIX v1.0.5) ---
    // CRITICAL: 定速巡航模式的关键逻辑
    // 循环必须在 isPlayingInternalRef 为 true 时永远运行
    // velocity 归零只影响视觉效果，不应导致循环停止
    // 使用 isPlayingInternalRef.current（而非局部变量 isPlaying）确保读取最新状态
    if (isPlayingInternalRef.current || velocityRef.current > 0.001) {
      reqIdRef.current = requestAnimationFrame(updatePhysics);
    } else {
      reqIdRef.current = null;
      lastFrameTimeRef.current = 0;
    }
  }, []);

  const startLoop = useCallback(() => {
    if (!reqIdRef.current) {
      lastFrameTimeRef.current = performance.now();
      reqIdRef.current = requestAnimationFrame(updatePhysics);
    }
  }, [updatePhysics]);

  /**
   * Action: Trigger Impulse
   * Logic: Reset velocity to 1.0 (Activator)
   * Also ensures playback is active.
   */
  const triggerImpulse = useCallback(() => {
    velocityRef.current = 1.0;
    isPlayingInternalRef.current = true;
    startLoop();
  }, [startLoop]);

  /**
   * Action: Toggle Play/Pause
   */
  const togglePlay = useCallback(() => {
    if (isPlayingInternalRef.current) {
      // Stop/Pause
      isPlayingInternalRef.current = false;
      velocityRef.current = 0;
    } else {
      // Start
      isPlayingInternalRef.current = true;
      velocityRef.current = 1.0;
      startLoop();
    }
  }, [startLoop]);

  /**
   * Action: Stop
   */
  const stop = useCallback(() => {
    isPlayingInternalRef.current = false;
    velocityRef.current = 0;
    measureRef.current = 0;
    currentSecondsRef.current = 0;
  }, []);

  /**
   * Action: Set Target BPM
   */
  const setTargetBpm = useCallback((bpm: number) => {
    // Clamp securely
    const clamped = Math.max(30, Math.min(300, bpm));
    targetBpmRef.current = clamped;
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (reqIdRef.current) {
        cancelAnimationFrame(reqIdRef.current);
      }
    };
  }, []);

  return {
    velocity: state.velocity,
    measure: state.measure,
    currentSeconds: state.currentSeconds,
    isPlaying: state.isPlaying,
    currentBpm: state.currentBpm,
    triggerImpulse,
    togglePlay,
    stop,
    setTargetBpm,
  };
}

export default useInertiaEngine;
