import React from 'react';

interface SheetMusicProps {
  /**
   * Current measure position (float). 
   * Controls the horizontal scroll via CSS transform translateX.
   */
  measure: number;
  /**
   * Pixels per measure for scaling the scroll speed.
   */
  pixelsPerMeasure?: number;
  /**
   * Initial horizontal offset to align the first note with the red pointer.
   */
  scoreOffset?: number;
}

/**
 * SheetMusic Component (Real SVG Edition)
 * Renders a scrollable real SVG score image.
 * The score scrolls based on the `measure` prop value and `pixelsPerMeasure`.
 */
export const SheetMusic: React.FC<SheetMusicProps> = ({ 
  measure, 
  pixelsPerMeasure = 300,
  scoreOffset = 0
}) => {
  // Calculate the horizontal offset
  // We subtract the initial scoreOffset to push the image left/right at the start
  const translateX = (-1 * measure * pixelsPerMeasure) + scoreOffset;

  return (
    <div className="w-full h-[770px] overflow-hidden relative border-y border-zinc-800 bg-black shadow-inner flex items-center">
      {/* 
        Red Playback Pointer (Centered)
        This is the "now" line where the notes being played should cross.
      */}
      <div 
        className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-red-500 z-20 opacity-50 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
        aria-hidden="true"
      />

      {/* 
        Scroll Container
        We use 'absolute left-1/2' to anchor the start of the score to the center line.
        Then translateX moves it based on the current measure.
      */}
      <div
        className="absolute left-1/2 h-full will-change-transform flex items-center"
        style={{
          transform: `translateX(${translateX}px)`,
          transition: 'transform 0.1s linear',
        }}
      >
        <img 
          src="/snow_visual.svg" 
          alt="Musical Score" 
          className="h-full w-auto max-w-none block"
          style={{ 
            imageRendering: 'auto',
            filter: 'invert(1) brightness(2)',
            objectFit: 'contain'
          }}
        />
      </div>

      {/* Edge Fades for better aesthetic depth */}
      <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-black to-transparent pointer-events-none z-30" />
      <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-black to-transparent pointer-events-none z-30" />
    </div>
  );
};

export default SheetMusic;
