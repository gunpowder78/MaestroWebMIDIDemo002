import { useEffect, useRef, useState, useMemo } from 'react';
import { SheetMusic, FlywheelButton } from './components';
import { useInertiaEngine, useConductingSensor } from './hooks';
import { useWifiMidiPlayer } from './hooks/useWifiMidiPlayer';
import { RAW_TIMING_DATA, parseTimingData } from './config/snow_timing';

/**
 * Main Application Component
 * 
 * Orchestrates the flywheel physics engine with MIDI playback via WiFi.
 * - SheetMusic displays scrolling notation based on high-precision timing table
 * - FlywheelButton triggers impulses to drive playback
 * - MIDI notes are sent over WebSocket to bridge server
 */
function App() {
  // --- Hooks ---
  const physics = useInertiaEngine();
  const midi = useWifiMidiPlayer();

  // --- Conducting Mode (AI Studio Feedback Algo) ---
  const [isConductingVisualActive, setIsConductingVisualActive] = useState(false);
  const sensor = useConductingSensor({
    onBeat: (bpm) => {
      // 1. 物理冲量
      physics.triggerImpulse();
      
      // 2. 动态调整 BPM
      if (bpm) {
        physics.setBpm(bpm);
      }

      // 3. 视觉反馈
      setIsConductingVisualActive(true);
      setTimeout(() => setIsConductingVisualActive(false), 200);
    }
  });

  // 解析时间映射表
  const parsedTiming = useMemo(() => parseTimingData(RAW_TIMING_DATA), []);

  // Initial Score Offset (用户校准值)
  const [scoreOffset, setScoreOffset] = useState(-60);

  // Server IP input
  const [serverInput, setServerInput] = useState('');

  // Track previous seconds to avoid duplicate calls
  const prevSecondsRef = useRef(0);

  // --- Load MIDI on mount ---
  useEffect(() => {
    midi.loadSong('/snow_longstripe.mid');
  }, []);

  // --- Drive MIDI playback from physics engine ---
  useEffect(() => {
    // CRITICAL: Only attempt MIDI calls if:
    // 1. MIDI is fully connected and ready
    // 2. Physics is actively playing
    // 3. We are NOT at the very beginning (0s) to avoid initialization hiccups
    if (!midi.isReady || !physics.isPlaying || physics.currentSeconds <= 0.001) return;

    // Avoid calling playTick if time hasn't changed
    if (physics.currentSeconds === prevSecondsRef.current) return;
    prevSecondsRef.current = physics.currentSeconds;

    // Trigger MIDI notes at current time
    midi.playTick(physics.currentSeconds);
  }, [physics.currentSeconds, physics.isPlaying, midi.isReady, midi]);

  return (
    <div className="h-full w-full bg-black text-white flex flex-col items-center justify-between overflow-hidden relative selection:bg-purple-500 selection:text-white">
      
      {/* Background Gradient Ambience */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-purple-900/10 to-transparent pointer-events-none" />
      
      {/* Debug Panel - Top Left */}
      <div className="fixed top-4 left-4 z-50 bg-zinc-900/80 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3 text-xs font-mono space-y-2 shadow-lg max-w-xs">
        
        {/* Connection Status */}
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${
            midi.connectionStatus === 'connected' ? 'bg-green-500' : 
            midi.connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : 
            'bg-red-500'
          }`} />
          <span className="text-gray-400 text-[10px]">
            WiFi MIDI: {midi.connectionStatus}
          </span>
        </div>

        {/* Server Input */}
        {midi.connectionStatus !== 'connected' && (
          <div className="flex flex-col gap-1">
            <input
              type="text"
              placeholder="Server IP (e.g., 192.168.1.100)"
              value={serverInput}
              onChange={(e) => setServerInput(e.target.value)}
              className="w-full px-2 py-1.5 bg-black/50 border border-white/20 rounded text-white text-xs placeholder:text-gray-500 focus:outline-none focus:border-purple-500"
            />
            <button 
              onClick={() => midi.connectMidi(serverInput)}
              disabled={midi.isLoading || !serverInput}
              className="w-full px-2 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded text-xs transition-colors"
            >
              {midi.isLoading ? 'Connecting...' : 'Connect to Server'}
            </button>
          </div>
        )}

        {/* Connected State */}
        {midi.connectionStatus === 'connected' && (
          <div className="flex items-center gap-2">
            <span className="text-green-400 text-[10px]">
              Connected: {midi.serverAddress}
            </span>
            <button 
              onClick={() => midi.sendTestNote()}
              className="px-1.5 py-0.5 bg-green-500/20 hover:bg-green-500/40 text-green-400 rounded text-[10px] border border-green-500/30 transition-colors cursor-pointer"
            >
              🔊 Ping
            </button>
            <button 
              onClick={() => midi.disconnect()}
              className="px-1.5 py-0.5 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded text-[10px] border border-red-500/30 transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Error Display */}
        {midi.error && (
          <div className="text-red-400 text-[10px] bg-red-500/10 px-2 py-1 rounded border border-red-500/20">
            {midi.error}
          </div>
        )}

        {/* Physics Info */}
        <div className="text-gray-500 pt-1 border-t border-white/10">
          <div>Velocity: <span className="text-cyan-400">{physics.velocity.toFixed(2)}</span></div>
          <div>Time: <span className="text-cyan-400">{physics.currentSeconds.toFixed(2)}s</span></div>
        </div>
          
        {/* Conducting Mode Toggle */}
        <div className="pt-2 border-t border-white/10">
          <button
            onClick={() => sensor.toggle()}
            className={`w-full px-3 py-2 rounded-lg flex items-center justify-between transition-all ${
              sensor.isActive 
                ? 'bg-purple-600/30 border border-purple-500/50 text-purple-300' 
                : 'bg-zinc-800 border border-white/5 text-gray-500'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${sensor.isActive ? 'bg-purple-400 animate-pulse' : 'bg-gray-600'}`} />
              <span className="text-[10px] font-bold tracking-wider">CONDUCTING MODE</span>
            </div>
            <span className="text-[10px]">{sensor.isActive ? 'ON' : 'OFF'}</span>
          </button>
          {sensor.error && <p className="text-[9px] text-red-500 mt-1">{sensor.error}</p>}
        </div>
      </div>
      
      {/* --- Main Content Area --- */}
      <div className="flex-1 w-full flex flex-col items-center justify-start pt-16 pb-4 relative">
        {/* Visual Pulse for Conducting Beat */}
        <div className={`fixed inset-0 pointer-events-none transition-opacity duration-300 ${
          isConductingVisualActive ? 'bg-purple-500/10 opacity-100' : 'opacity-0'
        }`} />

        {/* Title */}
        <div className="text-center mb-4 z-10">
          <h1 className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400">
            Maestro (Full Screen)
          </h1>
          <p className="text-xs text-gray-500 tracking-widest uppercase">
            WiFi MIDI Player
          </p>
        </div>

        {/* Sheet Music */}
        <div className="w-full flex-1 min-h-0 overflow-hidden relative">
          <SheetMusic 
            currentSeconds={physics.currentSeconds}
            isPlaying={physics.isPlaying}
            timingData={parsedTiming}
            scoreOffset={scoreOffset}
          />
        </div>
      </div>

      {/* --- Control Panel --- */}
      <div className="w-full flex flex-col items-center pb-safe-bottom pb-6 z-10">
        {/* Flywheel Control */}
        <FlywheelButton
          velocity={physics.velocity}
          currentSeconds={physics.currentSeconds}
          isPlaying={physics.isPlaying}
          onTrigger={physics.togglePlay}
        />

        {/* Score Offset Calibration */}
        <div className="mt-4 w-72 px-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Start Alignment (Global Offset)</span>
            <span className="text-purple-400">{scoreOffset}PX</span>
          </div>
          <input
            type="range"
            min="-200"
            max="100"
            step="1"
            value={scoreOffset}
            onChange={(e) => setScoreOffset(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
          />
        </div>
      </div>
    </div>
  );
}

export default App;
