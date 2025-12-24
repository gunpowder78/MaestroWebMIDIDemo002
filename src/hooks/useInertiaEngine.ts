import { useRef, useCallback, useEffect, useState } from 'react';

/**
 * Physics constants for v1.02 - Conducting Mode Enhancement
 */
const FRICTION = 0.98;           // Damping factor per frame (for visual effects only now)
const MIN_SPEED = 0.05;          // Cruise control minimum speed
const MAX_VELOCITY = 1.5;        // Maximum velocity cap (reduced, velocity is now just for animation)
const BPM_DEFAULT = 120;         // Default beats per minute
const BEATS_PER_MEASURE = 4;     // Beats per measure (4/4 time assumed)
const BPM_LERP_FACTOR = 0.08;    // How fast BPM transitions to target (0.08 = smooth, 0.3 = fast)

interface InertiaEngineState {
  /** Current velocity of the flywheel (0 to MAX_VELOCITY) - now mainly for visual effects */
  velocity: number;
  /** Current measure position (float) */
  measure: number;
  /** Current playback time in seconds */
  currentSeconds: number;
  /** Whether the engine is currently playing */
  isPlaying: boolean;
  /** Current actual BPM (smoothly interpolated) */
  currentBpm: number;
}

interface InertiaEngineActions {
  /** Trigger an impulse to add momentum (legacy, now just visual) */
  triggerImpulse: () => void;
  /** Toggle play/pause state */
  togglePlay: () => void;
  /** Stop the engine and reset */
  stop: () => void;
  /** Set immediate BPM (used internally) */
  setBpm: (bpm: number) => void;
  /** Set target BPM for smooth interpolation (called by conducting sensor) */
  setTargetBpm: (bpm: number) => void;
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
  const measureRef = useRef(0);
  const currentSecondsRef = useRef(0);
  const bpmRef = useRef(BPM_DEFAULT);           // currentBpm - actual playback speed
  const targetBpmRef = useRef(BPM_DEFAULT);     // targetBpm - user's desired speed (from conducting)
  const isPlayingRef = useRef(false);
  
  // --- Animation Frame Management ---
  const reqIdRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef(0);
  const lastUpdateRef = useRef(0);

  // --- External State (for component re-rendering) ---
  // We use a single state object to batch updates
  const [state, setState] = useState<InertiaEngineState>({
    velocity: 0,
    measure: 0,
    currentSeconds: 0,
    isPlaying: false,
    currentBpm: BPM_DEFAULT,
  });

  /**
   * Core physics update loop
   * Called every animation frame via requestAnimationFrame
   */
  const updatePhysics = useCallback((currentTime: number) => {
    // Calculate delta time
    if (!lastFrameTimeRef.current) {
      lastFrameTimeRef.current = currentTime;
    }
    const deltaTime = (currentTime - lastFrameTimeRef.current) / 1000;
    lastFrameTimeRef.current = currentTime;

    // --- BPM Lerp Interpolation (v1.0.2 Core Logic) ---
    // Smoothly transition currentBpm towards targetBpm when playing
    if (isPlayingRef.current) {
      bpmRef.current = bpmRef.current + (targetBpmRef.current - bpmRef.current) * BPM_LERP_FACTOR;
    }

    // --- Apply Friction (Damping) - now mainly for visual flywheel effect ---
    velocityRef.current *= FRICTION;

    // --- Cruise Control ---
    // If we're playing, maintain minimum visual velocity for flywheel animation
    if (isPlayingRef.current && velocityRef.current < MIN_SPEED) {
      velocityRef.current = MIN_SPEED;
    }

    // --- Stop threshold ---
    if (!isPlayingRef.current && velocityRef.current < 0.001) {
      velocityRef.current = 0;
    }

    // --- Update Position ---
    if (velocityRef.current > 0.001) {
      // Calculate measures per second based on BPM
      const beatsPerSecond = bpmRef.current / 60;
      const measuresPerSecond = beatsPerSecond / BEATS_PER_MEASURE;

      // Update measure position
      measureRef.current += measuresPerSecond * deltaTime * velocityRef.current;

      // --- CRITICAL FIX: Playback Speed scaling ---
      // We scale the progression of time based on how current BPM relates to the default
      // This ensures that gestural BPM changes actually speed up the MIDI playback.
      const timeScale = bpmRef.current / BPM_DEFAULT;
      currentSecondsRef.current += deltaTime * velocityRef.current * timeScale;
    }

    // --- Update External State (Throttled to 20fps / 50ms) ---
    const now = performance.now();
    if (!lastUpdateRef.current || now - lastUpdateRef.current > 50) {
      lastUpdateRef.current = now;
      setState({
        velocity: velocityRef.current,
        measure: measureRef.current,
        currentSeconds: currentSecondsRef.current,
        isPlaying: isPlayingRef.current,
        currentBpm: Math.round(bpmRef.current),
      });
    }

    // --- Continue Loop ---
    if (isPlayingRef.current || velocityRef.current > 0.001) {
      reqIdRef.current = requestAnimationFrame(updatePhysics);
    } else {
      // Engine has stopped
      reqIdRef.current = null;
      lastFrameTimeRef.current = 0;
    }
  }, []);

  /**
   * Start the animation loop if not already running
   */
  const startLoop = useCallback(() => {
    if (!reqIdRef.current) {
      lastFrameTimeRef.current = performance.now();
      reqIdRef.current = requestAnimationFrame(updatePhysics);
    }
  }, [updatePhysics]);

  /**
   * Trigger an impulse - adds visual momentum to the flywheel
   * v1.0.2: Now only for visual feedback, BPM is controlled via setTargetBpm
   */
  const triggerImpulse = useCallback(() => {
    // Visual impulse: briefly boost velocity for flywheel animation
    const VISUAL_IMPULSE = 0.15;
    velocityRef.current = Math.min(velocityRef.current + VISUAL_IMPULSE, MAX_VELOCITY);

    // Ensure loop is running if playing
    if (isPlayingRef.current) {
      startLoop();
    }
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
   * Set immediate BPM (used for initialization or forced override)
   */
  const setBpm = useCallback((bpm: number) => {
    const clampedBpm = Math.max(30, Math.min(300, bpm));
    bpmRef.current = clampedBpm;
    targetBpmRef.current = clampedBpm;
  }, []);

  /**
   * Set target BPM for smooth interpolation (v1.0.2 conducting mode)
   * The physics loop will lerp currentBpm towards this target
   */
  const setTargetBpm = useCallback((bpm: number) => {
    targetBpmRef.current = Math.max(30, Math.min(300, bpm));
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
    currentBpm: state.currentBpm,
    triggerImpulse,
    togglePlay,
    stop,
    setBpm,
    setTargetBpm,
  };
}

export default useInertiaEngine;
