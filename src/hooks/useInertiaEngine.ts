import { useRef, useCallback, useEffect, useState } from 'react';

/**
 * Physics & BPM constants
 */
const FRICTION = 0.98;         // Damping factor per frame
const MIN_SPEED = 0.01;        // Velocity threshold for playing state
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
    // Always apply friction monitoring
    velocityRef.current *= FRICTION;

    // 2. Playback State Determination
    // Logic: If velocity > 0.01, we are "playing".
    const isActive = velocityRef.current > MIN_SPEED;

    if (isActive) {
      // --- BPM Update ---
      // Smoothly transition currentBpm to targetBpm
      currentBpmRef.current = lerp(currentBpmRef.current, targetBpmRef.current, 0.1);

      // --- Time Update ---
      // Formula: time += (currentBpm / 60) * delta
      // This calculates the number of beats elapsed in this frame
      const beatsDelta = (currentBpmRef.current / 60) * deltaTime;

      // Update Measure (beats / 4)
      measureRef.current += beatsDelta / BEATS_PER_MEASURE;

      // Update Seconds
      // Use the speed ratio (currentBpm / Default) to scale "musical time"
      // or simply accumulate real-time if we want a stopwatch.
      // Based on context of "Project Maestro", this likely drives a cursor that should match the audio.
      // Scaling time by playback speed is standard.
      const timeScale = currentBpmRef.current / BPM_DEFAULT;
      currentSecondsRef.current += deltaTime * timeScale;
    } else {
      // Stopped
      velocityRef.current = 0;
    }

    // --- Update External State (Throttled to ~20fps) ---
    const now = performance.now();
    if (!lastUpdateRef.current || now - lastUpdateRef.current > 50) {
      lastUpdateRef.current = now;
      setState({
        velocity: Math.abs(velocityRef.current) < 0.001 ? 0 : velocityRef.current,
        measure: measureRef.current,
        currentSeconds: currentSecondsRef.current,
        isPlaying: isActive,
        currentBpm: Math.round(currentBpmRef.current),
      });
    }

    // --- Loop Continuation ---
    if (isActive || velocityRef.current > 0.001) {
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
   * Does NOT increase speed/bpm.
   */
  const triggerImpulse = useCallback(() => {
    velocityRef.current = 1.0;
    startLoop();
  }, [startLoop]);

  /**
   * Action: Toggle Play/Pause
   */
  const togglePlay = useCallback(() => {
    // Check if currently playing based on velocity threshold or active loop
    if (velocityRef.current > MIN_SPEED) {
      // Stop
      velocityRef.current = 0;
    } else {
      // Start
      velocityRef.current = 1.0;
      startLoop();
    }
  }, [startLoop]);

  /**
   * Action: Stop
   */
  const stop = useCallback(() => {
    velocityRef.current = 0;
    measureRef.current = 0;
    currentSecondsRef.current = 0;
    // We let the loop run one last time to update state to 0/false then die
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
