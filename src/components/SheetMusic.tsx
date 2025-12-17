import React from 'react';

/**
 * SheetMusicSvg - The inline SVG representing a single measure segment.
 * Contains staff lines, clefs, key signatures, time signature, and notes.
 */
const SheetMusicSvg: React.FC = () => (
  <svg
    viewBox="0 0 800 300"
    className="w-[800px] h-[300px] flex-shrink-0 text-white"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
  >
    {/* Staff Lines - Top (Treble) */}
    <g opacity={0.8}>
      <line x1={50} y1={50} x2={750} y2={50} />
      <line x1={50} y1={70} x2={750} y2={70} />
      <line x1={50} y1={90} x2={750} y2={90} />
      <line x1={50} y1={110} x2={750} y2={110} />
      <line x1={50} y1={130} x2={750} y2={130} />

      {/* Clef (Stylized Treble) */}
      <path
        d="M80 140 C 60 140, 60 100, 80 90 C 100 80, 100 60, 90 50 C 80 40, 70 60, 70 90 L 70 150 C 70 170, 90 170, 100 160"
        strokeWidth={3}
      />

      {/* Key Signature (Flats) */}
      <text x={110} y={100} fontSize={30} fill="currentColor" stroke="none">♭</text>
      <text x={125} y={70} fontSize={30} fill="currentColor" stroke="none">♭</text>
      <text x={140} y={110} fontSize={30} fill="currentColor" stroke="none">♭</text>
      <text x={155} y={80} fontSize={30} fill="currentColor" stroke="none">♭</text>
      <text x={170} y={120} fontSize={30} fill="currentColor" stroke="none">♭</text>

      {/* Time Signature 9/8 */}
      <text x={200} y={85} fontSize={30} fontWeight="bold" fill="currentColor" stroke="none">9</text>
      <text x={200} y={125} fontSize={30} fontWeight="bold" fill="currentColor" stroke="none">8</text>
    </g>

    {/* Staff Lines - Bottom (Bass) */}
    <g opacity={0.8} transform="translate(0, 140)">
      <line x1={50} y1={50} x2={750} y2={50} />
      <line x1={50} y1={70} x2={750} y2={70} />
      <line x1={50} y1={90} x2={750} y2={90} />
      <line x1={50} y1={110} x2={750} y2={110} />
      <line x1={50} y1={130} x2={750} y2={130} />
      
      {/* Clef (Stylized Bass) */}
      <path
        d="M80 70 C 90 60, 100 70, 90 80 C 70 100, 70 110, 90 120"
        strokeWidth={3}
      />
      <circle cx={105} cy={70} r={3} fill="currentColor" stroke="none" />
      <circle cx={105} cy={85} r={3} fill="currentColor" stroke="none" />

      {/* Key Signature (Flats) - Bass */}
      <text x={110} y={90} fontSize={30} fill="currentColor" stroke="none">♭</text>
      <text x={125} y={60} fontSize={30} fill="currentColor" stroke="none">♭</text>
      <text x={140} y={100} fontSize={30} fill="currentColor" stroke="none">♭</text>
      <text x={155} y={70} fontSize={30} fill="currentColor" stroke="none">♭</text>
      <text x={170} y={110} fontSize={30} fill="currentColor" stroke="none">♭</text>
    </g>

    {/* Notes Mockup (Clair de Lune-ish arpeggios) */}
    <g fill="currentColor" stroke="currentColor">
      {/* Measure 1 Bar Line */}
      <line x1={300} y1={50} x2={300} y2={280} strokeWidth={1} opacity={0.5} />

      {/* Treble Notes */}
      <ellipse cx={240} cy={110} rx={8} ry={6} fill="currentColor" />
      <line x1={248} y1={110} x2={248} y2={70} strokeWidth={2} />

      <ellipse cx={270} cy={100} rx={8} ry={6} fill="currentColor" />
      <line x1={278} y1={100} x2={278} y2={60} strokeWidth={2} />
      <line x1={248} y1={70} x2={278} y2={60} strokeWidth={4} /> {/* Beam */}

      {/* Bass Notes - Arpeggios */}
      <ellipse cx={240} cy={240} rx={8} ry={6} fill="currentColor" />
      <line x1={248} y1={240} x2={248} y2={200} strokeWidth={2} />

      <ellipse cx={270} cy={230} rx={8} ry={6} fill="currentColor" />
      <line x1={278} y1={230} x2={278} y2={190} strokeWidth={2} />
      <line x1={248} y1={200} x2={278} y2={190} strokeWidth={4} />

      {/* Slurs */}
      <path d="M240 250 Q 350 280 450 250" fill="none" strokeWidth={1.5} />
      <path d="M240 120 Q 350 150 450 120" fill="none" strokeWidth={1.5} />

      {/* Dynamic Marking */}
      <text x={240} y={170} fontSize={24} fontStyle="italic" fontWeight="bold" stroke="none" fill="white">pp</text>

      {/* Measure 2 Bar Line */}
      <line x1={500} y1={50} x2={500} y2={280} strokeWidth={1} opacity={0.5} />
      <ellipse cx={400} cy={90} rx={8} ry={6} fill="white" stroke="white" />
      <line x1={408} y1={90} x2={408} y2={50} strokeWidth={2} />

      <ellipse cx={450} cy={80} rx={8} ry={6} fill="white" stroke="white" />
      <line x1={458} y1={80} x2={458} y2={40} strokeWidth={2} />
      <line x1={408} y1={50} x2={458} y2={40} strokeWidth={4} />
    </g>
  </svg>
);

interface SheetMusicProps {
  /**
   * Current measure position (float). 
   * Controls the horizontal scroll via CSS transform translateX.
   */
  measure: number;
}

/**
 * SheetMusic Component
 * Renders a scrollable staff with sheet music notation.
 * The score scrolls based on the `measure` prop value.
 */
export const SheetMusic: React.FC<SheetMusicProps> = ({ measure }) => {
  const PATTERN_WIDTH = 800;  // Width of one SVG pattern
  const PX_PER_MEASURE = 200; // Pixels per musical measure
  const NUM_PATTERNS = 8;     // Number of repeated SVG patterns

  // Calculate the transform for infinite scrolling effect
  const calculateTransform = (): string => {
    // Loop position within a single pattern width
    const loopPosition = (measure * PX_PER_MEASURE) % PATTERN_WIDTH;
    // Anchor from screen center
    const translateX = -(PATTERN_WIDTH + loopPosition);
    return `translateX(calc(50vw + ${translateX}px))`;
  };

  return (
    <div className="relative w-full h-80 overflow-hidden">
      {/* Red Playhead Line (Centered) */}
      <div 
        className="absolute left-1/2 top-0 bottom-0 w-0.5 z-20 -translate-x-1/2 pointer-events-none"
        style={{
          backgroundColor: 'rgba(239, 68, 68, 0.8)',
          boxShadow: '0 0 12px rgba(239, 68, 68, 1)',
        }}
      />

      {/* Gradient Masks for Fade effect at edges */}
      <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none" />

      {/* Scrolling Track Container */}
      <div
        className="flex flex-row absolute top-0 left-0 h-full will-change-transform opacity-90"
        style={{
          width: 'max-content',
          transform: calculateTransform(),
        }}
      >
        {/* Duplicate SVG patterns for long scrolling effect */}
        {Array.from({ length: NUM_PATTERNS }, (_, i) => (
          <SheetMusicSvg key={i} />
        ))}
      </div>
    </div>
  );
};

export default SheetMusic;
