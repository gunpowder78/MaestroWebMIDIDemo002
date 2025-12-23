import { useEffect, useRef, useState, useMemo } from 'react';
import { SheetMusic, FlywheelButton } from './components';
import { useInertiaEngine, useMidiPlayer } from './hooks';
import { RAW_TIMING_DATA, parseTimingData } from './config/snow_timing';

/**
 * Main Application Component
 * 
 * Orchestrates the flywheel physics engine with MIDI playback.
 * - SheetMusic displays scrolling notation based on high-precision timing table
 * - FlywheelButton triggers impulses to drive playback
 * - MIDI notes are triggered based on currentSeconds from physics
 */
function App() {
  // --- Hooks ---
  const physics = useInertiaEngine();
  const midi = useMidiPlayer();

  // 解析时间映射表
  const parsedTiming = useMemo(() => parseTimingData(RAW_TIMING_DATA), []);

  // Initial Score Offset (用户校准值)
  const [scoreOffset, setScoreOffset] = useState(-60);

  // Track previous seconds to avoid duplicate calls
  const prevSecondsRef = useRef(0);

  // --- Load MIDI on mount ---
  useEffect(() => {
    midi.loadSong('/snow_longstripe.mid');
  }, []);

  // --- Drive MIDI playback from physics engine ---
  useEffect(() => {
    // Only play when physics is active and MIDI is ready
    if (!physics.isPlaying || !midi.isReady) return;

    // Avoid calling playTick if time hasn't changed
    if (physics.currentSeconds === prevSecondsRef.current) return;
    prevSecondsRef.current = physics.currentSeconds;

    // Trigger MIDI notes at current time
    if (midi.isReady) {
      midi.playTick(physics.currentSeconds);
    }
  }, [physics.currentSeconds, physics.isPlaying, midi.isReady, midi]);

  return (
    <div className="h-full w-full bg-black text-white flex flex-col items-center justify-between overflow-hidden relative selection:bg-purple-500 selection:text-white">
      
      {/* Background Gradient Ambience */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-purple-900/10 to-transparent pointer-events-none" />
      
      {/* Debug Panel - Top Left */}
      <div className="fixed top-4 left-4 z-50 bg-zinc-900/80 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3 text-xs font-mono space-y-1 shadow-lg">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${midi.isReady ? 'bg-green-500' : midi.isLoading ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`} />
          
          {!midi.isReady ? (
            <button 
              onClick={() => midi.connectMidi()}
              disabled={midi.isLoading}
              className="text-gray-300 hover:text-white underline decoration-dotted underline-offset-4 disabled:opacity-50 transition-colors"
            >
              {midi.isLoading ? 'Connecting...' : 'Tap to Connect MIDI'}
            </button>
          ) : (
            <span className="text-gray-400">
              MIDI: {midi.outputName || 'Ready'}
            </span>
          )}
        </div>
        {midi.error && (
          <div className="text-red-500 text-[10px] bg-red-900/20 p-1 rounded border border-red-900/50">
            {midi.error}
          </div>
        )}
        <div className="text-gray-500">
          Velocity: <span className="text-purple-400 font-bold">{physics.velocity.toFixed(2)}</span>
        </div>
        <div className="text-gray-500">
          Time: <span className="text-green-400 font-bold">{physics.currentSeconds.toFixed(2)}s</span>
        </div>
      </div>

      {/* Header / Song Info */}
      <header className="w-full max-w-lg pt-4 px-6 text-center z-10">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-0.5 text-white">
          Maestro (Full Screen)
        </h1>
        <p className="text-xs md:text-sm text-gray-400 font-medium font-mono uppercase tracking-[0.2em]">
          Flywheel MIDI Player
        </p>
      </header>

      {/* Sheet Music Visualizer - Center */}
      <section className="flex-1 w-full max-w-6xl flex items-center justify-center z-10 my-0 overflow-hidden">
        <SheetMusic 
          currentSeconds={physics.currentSeconds}
          timingData={parsedTiming}
          scoreOffset={scoreOffset}
        />
      </section>

      {/* Bottom Control Panel */}
      <footer className="w-full max-w-lg z-20 pb-8 px-6 space-y-6">
        <div className="relative group">
          {/* Glow Background */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-900 to-purple-800 rounded-3xl blur opacity-30 group-hover:opacity-50 transition duration-1000" />
          
          {/* Control Card */}
          <div className="relative bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 flex items-center justify-between shadow-2xl">
            
            {/* Left: Velocity Display */}
            <div className="flex flex-col items-center justify-center w-24">
              <span className="text-xs text-gray-500 font-bold tracking-wider mb-1">VELOCITY</span>
              <span className="text-3xl md:text-4xl font-light tabular-nums text-white">
                {physics.velocity.toFixed(1)}
              </span>
            </div>

            {/* Center: Flywheel Button */}
            <div className="flex-shrink-0 -mt-8 mb-[-1rem]">
              <FlywheelButton 
                velocity={physics.velocity} 
                onClick={physics.triggerImpulse} 
              />
            </div>

            {/* Right: Time Display */}
            <div className="flex flex-col items-center justify-center w-24">
              <span className="text-xs text-gray-500 font-bold tracking-wider mb-1">TIME</span>
              <span className="text-3xl md:text-4xl font-light tabular-nums text-white">
                {physics.currentSeconds.toFixed(1)}s
              </span>
            </div>

          </div>
          
          {/* Top highlight line */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-50 pointer-events-none rounded-t-3xl" />
        </div>

        {/* Calibration Panel */}
        <div className="bg-zinc-900/50 backdrop-blur-sm border border-white/5 rounded-2xl p-4 space-y-4">
          {/* Offset Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-[10px] uppercase tracking-widest text-gray-500 font-bold">
              <span>Start Alignment (Global Offset)</span>
              <span className="text-orange-400">{scoreOffset}px</span>
            </div>
            <input 
              type="range" 
              min="-1000" 
              max="1000" 
              step="1"
              value={scoreOffset} 
              onChange={(e) => setScoreOffset(Number(e.target.value))}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
            />
          </div>
        </div>
      </footer>

    </div>
  );
}

export default App;
