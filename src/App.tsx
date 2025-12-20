import { useEffect, useRef, useState } from 'react';
import { SheetMusic, FlywheelButton } from './components';
import { useInertiaEngine, useMidiPlayer } from './hooks';

/**
 * Main Application Component
 * 
 * Orchestrates the flywheel physics engine with MIDI playback.
 * - SheetMusic displays scrolling notation based on current measure
 * - FlywheelButton triggers impulses to drive playback
 * - MIDI notes are triggered based on currentSeconds from physics
 */
function App() {
  // --- Hooks ---
  const physics = useInertiaEngine();
  const midi = useMidiPlayer();

  // Pixels Per Measure (for visual score calibration)
  const [ppm, setPpm] = useState(300);

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
    midi.playTick(physics.currentSeconds);
  }, [physics.currentSeconds, physics.isPlaying, midi.isReady, midi]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-between overflow-hidden relative selection:bg-purple-500 selection:text-white">
      
      {/* Background Gradient Ambience */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-purple-900/10 to-transparent pointer-events-none" />
      
      {/* Debug Panel - Top Left */}
      <div className="fixed top-4 left-4 z-50 bg-zinc-900/80 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3 text-xs font-mono space-y-1 shadow-lg">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${midi.isReady ? 'bg-green-500' : midi.isLoading ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-gray-400">
            MIDI: {midi.isReady ? midi.outputName || 'Ready' : midi.isLoading ? 'Loading...' : midi.error || 'Not connected'}
          </span>
        </div>
        <div className="text-gray-500">
          Velocity: <span className="text-purple-400 font-bold">{physics.velocity.toFixed(2)}</span>
        </div>
        <div className="text-gray-500">
          Measure: <span className="text-blue-400 font-bold">{physics.measure.toFixed(1)}</span>
        </div>
        <div className="text-gray-500">
          Time: <span className="text-green-400 font-bold">{physics.currentSeconds.toFixed(2)}s</span>
        </div>
        <div className="text-gray-500">
          PPM: <span className="text-orange-400 font-bold">{ppm}</span>
        </div>
      </div>

      {/* Header / Song Info */}
      <header className="w-full max-w-lg pt-6 px-6 text-center z-10">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-1 text-white">
          Maestro
        </h1>
        <p className="text-sm md:text-base text-gray-400 font-medium">
          Flywheel MIDI Player
        </p>
      </header>

      {/* Sheet Music Visualizer - Center */}
      <section className="flex-1 w-full max-w-4xl flex items-center justify-center z-10 my-4 overflow-hidden">
        <SheetMusic measure={physics.measure} pixelsPerMeasure={ppm} />
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

            {/* Right: Measure Display */}
            <div className="flex flex-col items-center justify-center w-24">
              <span className="text-xs text-gray-500 font-bold tracking-wider mb-1">MEASURE</span>
              <span className="text-3xl md:text-4xl font-light tabular-nums text-white">
                {physics.measure.toFixed(1)}
              </span>
            </div>

          </div>
          
          {/* Top highlight line */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-50 pointer-events-none rounded-t-3xl" />
        </div>

        {/* Calibration Slider */}
        <div className="bg-zinc-900/50 backdrop-blur-sm border border-white/5 rounded-2xl p-4 flex flex-col gap-2">
          <div className="flex justify-between items-center text-[10px] uppercase tracking-widest text-gray-500 font-bold">
            <span>Score Speed Calibration (PPM)</span>
            <span className="text-purple-400">{ppm}px</span>
          </div>
          <input 
            type="range" 
            min="100" 
            max="1000" 
            step="1"
            value={ppm} 
            onChange={(e) => setPpm(Number(e.target.value))}
            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />
        </div>
      </footer>

    </div>
  );
}

export default App;
