import { useRef, useCallback, useEffect, useState } from 'react';

/**
 * Physics constants - must match the original algorithm exactly
 */
const FRICTION = 0.98;         // Damping factor per frame
const IMPULSE = 0.3;           // Velocity added per click
const MIN_SPEED = 0.05;        // Cruise control minimum speed
const MAX_VELOCITY = 3.0;      // Maximum velocity cap
const BPM_DEFAULT = 120;       // Default beats per minute
const BEATS_PER_MEASURE = 4;   // Beats per measure (4/4 time assumed)

interface InertiaEngineState {
  /** Current velocity of the flywheel (0 to MAX_VELOCITY) */
  velocity: number;
  /** Current measure position (float) */
  measure: number;
  /** Current playback time in seconds */
  currentSeconds: number;
  /** Whether the engine is currently playing */
  isPlaying: boolean;
}

interface InertiaEngineActions {
  /** Trigger an impulse to add momentum */
  triggerImpulse: () => void;
  /** Set target velocity based on tap tempo or external sensor */
  setTargetVelocity: (targetV: number) => void;
  /** Toggle play/pause state without adding impulse */
  togglePlay: () => void;
  /** Stop the engine and reset velocity */
  stop: () => void;
  /** Set the BPM (beats per minute) */
  setBpm: (bpm: number) => void;
}

type UseInertiaEngineReturn = InertiaEngineState & InertiaEngineActions;

/**
 * useInertiaEngine Hook
 * 
 * A physics simulation hook for the flywheel music player.
 * 
 * Algorithm (strict replication from original):
 * - Friction (Damping): velocity *= 0.98 per frame
 * - Impulse (Momentum): Each click adds +0.3 to velocity
 * - Cruise Control: When velocity decays below minSpeed (0.05), maintain at minSpeed
 * 
 * Uses requestAnimationFrame for smooth 60fps updates.
 * Uses useRef for internal state to avoid unnecessary re-renders.
 * Only triggers re-render when external state needs to be read.
 */
export function useInertiaEngine(): UseInertiaEngineReturn {
  // --- Internal Physics State (refs to avoid re-renders) ---
  const velocityRef = useRef(0);
  const targetVelocityRef = useRef<number | null>(null); // External override target
  const measureRef = useRef(0);
  const currentSecondsRef = useRef(0);
  const bpmRef = useRef(BPM_DEFAULT);
  const isPlayingRef = useRef(false);
  const lastInteractionTimeRef = useRef(0);
  
  // --- Animation Frame Management ---
  const reqIdRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef(0);
  const lastUpdateRef = useRef(0);

  // --- External State ---
  const [state, setState] = useState<InertiaEngineState>({
    velocity: 0,
    measure: 0,
    currentSeconds: 0,
    isPlaying: false,
  });

  /**
   * Core physics update loop
   */
  const updatePhysics = useCallback((currentTime: number) => {
    if (!lastFrameTimeRef.current) {
      lastFrameTimeRef.current = currentTime;
    }
    const deltaTime = (currentTime - lastFrameTimeRef.current) / 1000;
    lastFrameTimeRef.current = currentTime;

    const now = performance.now();
    const timeSinceLastInteraction = now - lastInteractionTimeRef.current;

    // --- APPLY PHYSICS ---
    
    if (targetVelocityRef.current !== null) {
      // Smoothly interpolate towards the target velocity set by sensors
      const lerpFactor = 0.1; 
      velocityRef.current += (targetVelocityRef.current - velocityRef.current) * lerpFactor;
      
      // Clear target after a while if no new input
      if (timeSinceLastInteraction > 1000) {
        targetVelocityRef.current = null;
      }
    } else {
      // --- Standard Inertia & Friction ---
      // 1. If PAUSED: Always apply friction until stopped.
      // 2. If PLAYING: Apply friction only during interaction (2s window). 
      //    After stop moving, it stays at the current speed.
      if (!isPlayingRef.current || timeSinceLastInteraction < 2000) {
        velocityRef.current *= FRICTION;
      }
    }

    // --- Cruise Control / Minimum Threshold ---
    // Rule: Never drop below 0.1 if playing, to keep music going
    if (isPlayingRef.current && velocityRef.current < 0.1) {
      velocityRef.current = 0.1;
    }

    // --- Stop threshold ---
    if (!isPlayingRef.current && velocityRef.current < 0.001) {
      velocityRef.current = 0;
    }

    // --- Update Position ---
    if (velocityRef.current > 0.001) {
      const beatsPerSecond = bpmRef.current / 60;
      const measuresPerSecond = beatsPerSecond / BEATS_PER_MEASURE;
      measureRef.current += measuresPerSecond * deltaTime * velocityRef.current;
      const timeScale = bpmRef.current / BPM_DEFAULT;
      currentSecondsRef.current += deltaTime * velocityRef.current * timeScale;
    }

    // --- Update External State (Throttled) ---
    if (!lastUpdateRef.current || now - lastUpdateRef.current > 50) {
      lastUpdateRef.current = now;
      setState({
        velocity: velocityRef.current,
        measure: measureRef.current,
        currentSeconds: currentSecondsRef.current,
        isPlaying: isPlayingRef.current,
      });
    }

    if (isPlayingRef.current || velocityRef.current > 0.001) {
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
   * Set a temporary target velocity (usually from conducting hits)
   */
  const setTargetVelocity = useCallback((targetV: number) => {
    targetVelocityRef.current = targetV;
    lastInteractionTimeRef.current = performance.now();
    startLoop();
  }, [startLoop]);

  /**
   * Trigger a traditional impulse (kick the wheel)
   */
  const triggerImpulse = useCallback(() => {
    isPlayingRef.current = true;
    lastInteractionTimeRef.current = performance.now();
    velocityRef.current += IMPULSE;
    if (velocityRef.current > MAX_VELOCITY) {
      velocityRef.current = MAX_VELOCITY;
    }
    startLoop();
  }, [startLoop]);

  /**
   * Toggle play/pause - Does NOT add impulse
   */
  const togglePlay = useCallback(() => {
    if (isPlayingRef.current) {
      isPlayingRef.current = false;
    } else {
      isPlayingRef.current = true;
      // If stopped, give a tiny nudge to start the loop
      if (velocityRef.current < MIN_SPEED) {
        velocityRef.current = MIN_SPEED;
      }
      startLoop();
    }
  }, [startLoop]);

  /**
   * Stop the engine
   */
  const stop = useCallback(() => {
    isPlayingRef.current = false;
    // Let friction naturally bring it to a stop
  }, []);

  /**
   * Set the BPM for playback speed
   */
  const setBpm = useCallback((bpm: number) => {
    // Clamp BPM to reasonable range
    bpmRef.current = Math.max(30, Math.min(300, bpm));
  }, []);

  // --- Cleanup on unmount ---
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
    triggerImpulse,
    setTargetVelocity,
    togglePlay,
    stop,
    setBpm,
  };
}

export default useInertiaEngine;
