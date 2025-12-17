import React, { useRef, useEffect } from 'react';

interface FlywheelButtonProps {
  /**
   * Current velocity value (0 to ~3+).
   * Controls the glow intensity - higher velocity = stronger glow.
   */
  velocity: number;
  
  /**
   * Callback triggered when the button is clicked.
   */
  onClick: () => void;
}

/**
 * FlywheelButton Component
 * A stylized play button with dynamic glow effects based on velocity.
 * Features:
 * - Outer ring pulse effect
 * - Inner glow that scales and intensifies with velocity
 * - Click-to-scale animation
 */
export const FlywheelButton: React.FC<FlywheelButtonProps> = ({ velocity, onClick }) => {
  const glowRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  // Update glow visuals based on velocity changes
  useEffect(() => {
    if (!glowRef.current || !ringRef.current) return;

    // Calculate visual intensity (capped at 1.0)
    const visualIntensity = Math.min(velocity * 0.6, 1.0);

    // Glow opacity and scale
    glowRef.current.style.opacity = visualIntensity.toFixed(3);
    const glowScale = 1 + Math.min(velocity, 2.0) * 0.3;
    glowRef.current.style.transform = `scale(${glowScale})`;

    // Ring opacity and scale
    ringRef.current.style.opacity = (visualIntensity * 0.5).toFixed(3);
    ringRef.current.style.transform = `scale(${1 + velocity * 0.15})`;
  }, [velocity]);

  return (
    <div className="relative flex items-center justify-center w-32 h-32">
      {/* Outer Ring - Expanding pulse effect */}
      <div
        ref={ringRef}
        className="absolute inset-0 rounded-full border border-purple-500 will-change-transform transition-transform duration-150"
        style={{ opacity: 0 }}
      />

      {/* Inner Glow - Purple blur that scales with velocity */}
      <div
        ref={glowRef}
        className="absolute w-24 h-24 rounded-full bg-purple-600 blur-xl will-change-transform transition-transform duration-150"
        style={{ opacity: 0 }}
      />

      {/* Main Button */}
      <button
        onClick={onClick}
        className="relative z-10 w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-2xl active:scale-95 transition-transform duration-100 cursor-pointer group hover:shadow-purple-500/20"
        aria-label="Play / Tap Tempo"
      >
        {/* Play Icon */}
        <svg
          width={28}
          height={32}
          viewBox="0 0 28 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="ml-1 fill-black group-hover:fill-purple-600 transition-colors duration-200"
        >
          <path d="M26.5 13.4019C28.5 14.5566 28.5 17.4434 26.5 18.5981L4.75 31.1555C2.75 32.3102 0.250001 30.8668 0.250001 28.5574L0.250002 3.44263C0.250002 1.13323 2.75 -0.31017 4.75 0.84453L26.5 13.4019Z" />
        </svg>
      </button>
    </div>
  );
};

export default FlywheelButton;
