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
  const measureRef = useRef(0);
  const currentSecondsRef = useRef(0);
  const bpmRef = useRef(BPM_DEFAULT);
  const isPlayingRef = useRef(false);
  
  // --- Animation Frame Management ---
  const reqIdRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef(0);

  // --- External State (for component re-rendering) ---
  // We use a single state object to batch updates
  const [state, setState] = useState<InertiaEngineState>({
    velocity: 0,
    measure: 0,
    currentSeconds: 0,
    isPlaying: false,
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

    // --- Apply Friction (Damping) ---
    velocityRef.current *= FRICTION;

    // --- Cruise Control ---
    // If we're playing and velocity drops below minimum, maintain cruise speed
    if (isPlayingRef.current && velocityRef.current < MIN_SPEED && velocityRef.current > 0.001) {
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

      // Update current time in seconds
      currentSecondsRef.current += deltaTime * velocityRef.current;
    }

    // --- Update External State ---
    // Batch update to minimize re-renders
    setState({
      velocity: velocityRef.current,
      measure: measureRef.current,
      currentSeconds: currentSecondsRef.current,
      isPlaying: isPlayingRef.current,
    });

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
   * Trigger an impulse - adds momentum to the flywheel
   * This is the main interaction point for user clicks
   */
  const triggerImpulse = useCallback(() => {
    // Mark as playing
    isPlayingRef.current = true;

    // Apply impulse with velocity cap
    velocityRef.current += IMPULSE;
    if (velocityRef.current > MAX_VELOCITY) {
      velocityRef.current = MAX_VELOCITY;
    }

    // Ensure loop is running
    startLoop();
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
    stop,
    setBpm,
  };
}

export default useInertiaEngine;
