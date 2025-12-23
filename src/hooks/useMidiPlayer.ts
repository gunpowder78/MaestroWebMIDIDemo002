import { useState, useRef, useCallback } from 'react';
import { Midi } from '@tonejs/midi';

/**
 * Represents a note that needs to be played
 */
interface ScheduledNote {
  time: number;       // Time in seconds
  midi: number;       // MIDI note number (0-127)
  velocity: number;   // Velocity (0-127)
  duration: number;   // Duration in seconds
  channel: number;    // MIDI channel (0-15)
}

/**
 * Represents the state of a currently playing note for note-off tracking
 */
interface ActiveNote {
  noteNumber: number;
  channel: number;
  offTime: number;    // When to send note-off
}

/**
 * useMidiPlayer Hook
 */
export function useMidiPlayer() {
  // --- State ---
  const [isReady, setIsReady] = useState(false);
  const [outputName, setOutputName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableOutputs, setAvailableOutputs] = useState<string[]>([]);

  // --- Refs for non-reactive state ---
  const midiRef = useRef<Midi | null>(null);
  const outputRef = useRef<MIDIOutput | null>(null);
  const scheduledNotesRef = useRef<ScheduledNote[]>([]);
  const activeNotesRef = useRef<ActiveNote[]>([]);
  const lastPlayedIndexRef = useRef(0);

  /**
   * Initialize Web MIDI API and connect to preferred output port
   */
  const connectMidi = useCallback(async (): Promise<MIDIOutput | null> => {
    if (!navigator.requestMIDIAccess) {
      setError('Web MIDI API not supported in this browser');
      return null;
    }

    try {
      console.log('[useMidiPlayer] Requesting MIDI access...');
      const midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      console.log('[useMidiPlayer] MIDI access granted');
      
      const outputs = Array.from(midiAccess.outputs.values());
      setAvailableOutputs(outputs.map(o => o.name || 'Unknown'));

      if (outputs.length === 0) {
        setError('No MIDI output devices found');
        return null;
      }

      // Log all available outputs for debugging
      console.log('[useMidiPlayer] Available MIDI outputs:');
      outputs.forEach((out, idx) => {
        console.log(`  [${idx}] ${out.name} (${out.manufacturer || 'Unknown manufacturer'})`);
      });

      // --- Priority-based port selection ---
      let selectedOutput: MIDIOutput | null = null;

      // Priority 1: Look for "Maestro" in port name
      const maestroPort = outputs.find(out => 
        out.name?.toLowerCase().includes('maestro')
      );
      if (maestroPort) {
        selectedOutput = maestroPort;
        console.log(`[useMidiPlayer] Found preferred port (Maestro): ${maestroPort.name}`);
      }

      // Priority 2: Look for "loopMIDI" in port name
      if (!selectedOutput) {
        const loopMidiPort = outputs.find(out => 
          out.name?.toLowerCase().includes('loopmidi')
        );
        if (loopMidiPort) {
          selectedOutput = loopMidiPort;
          console.log(`[useMidiPlayer] Found preferred port (loopMIDI): ${loopMidiPort.name}`);
        }
      }

      // Priority 3: Fallback to first available port
      if (!selectedOutput) {
        selectedOutput = outputs[0];
        console.log(`[useMidiPlayer] Using default port (first available): ${selectedOutput.name}`);
      }

      // Set the selected output
      outputRef.current = selectedOutput;
      const name = selectedOutput.name || 'Unknown MIDI Device';
      setOutputName(name);
      setIsReady(true);
      
      console.log(`[useMidiPlayer] ✓ Successfully bound to: ${name}`);
      return selectedOutput;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to access MIDI';
      setError(message);
      console.error('[useMidiPlayer] MIDI access error:', err);
      setIsReady(false);
      return null;
    }
  }, []);

  /**
   * Send a safe test note (Middle C) to verify hardware viability
   */
  const sendTestNote = useCallback(() => {
    const output = outputRef.current;
    if (!output || output.state !== 'connected') {
      console.warn('[useMidiPlayer] Cannot test: MIDI not connected');
      return;
    }

    try {
      console.log('[useMidiPlayer] Testing Output Object:', {
        name: output.name,
        manufacturer: output.manufacturer,
        state: output.state,
        type: output.type
      });
      
      console.log('[useMidiPlayer] Sending safe Test Note (Uint8Array)...');
      if (output.state === 'connected') {
        output.send(new Uint8Array([0x90, 60, 100]));
        
        setTimeout(() => {
          if (output.state === 'connected') {
            output.send(new Uint8Array([0x80, 60, 0]));
            console.log('[useMidiPlayer] Test Note Off sent');
          }
        }, 500);
      } else {
        console.error('[useMidiPlayer] Output port is not in connected state');
      }
    } catch (e) {
      console.error('[useMidiPlayer] JS-LEVEL EXCEPTION CAUGHT:', e);
    }
  }, []);


  /**
   * Load a MIDI file from URL and prepare it for playback
   */
  const loadSong = useCallback(async (url: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    setIsReady(false);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch MIDI file: ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();

      const midi = new Midi(arrayBuffer);
      midiRef.current = midi;

      console.log(`[useMidiPlayer] Loaded: ${midi.name || url}`);
      console.log(`[useMidiPlayer] Tracks: ${midi.tracks.length}, Duration: ${midi.duration.toFixed(2)}s`);

      const allNotes: ScheduledNote[] = [];

      midi.tracks.forEach((track, trackIndex) => {
        const channel = (track.channel !== undefined && track.channel >= 0)
          ? track.channel
          : trackIndex % 16;

        track.notes.forEach((note) => {
          const velocity = Math.round(note.velocity * 127);
          if (velocity < 10) return;

          allNotes.push({
            time: note.time,
            midi: note.midi,
            velocity,
            duration: note.duration,
            channel,
          });
        });
      });

      allNotes.sort((a, b) => a.time - b.time);
      scheduledNotesRef.current = allNotes;
      lastPlayedIndexRef.current = 0;
      activeNotesRef.current = [];

      console.log(`[useMidiPlayer] Prepared ${allNotes.length} notes for playback`);
      
      setIsLoading(false);
      return true;

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load MIDI';
      setError(message);
      console.error('[useMidiPlayer] Load error:', err);
      setIsLoading(false);
      return false;
    }
  }, []);

  /**
   * Play notes at the current time position
   */
  const playTick = useCallback((currentTime: number) => {
    const output = outputRef.current;
    const notes = scheduledNotesRef.current;

    if (!output || notes.length === 0) return;

    // --- Process Note-Offs for active notes ---
    const stillActive: ActiveNote[] = [];
    for (const active of activeNotesRef.current) {
      if (currentTime >= active.offTime) {
        try {
          if (output.state === 'connected' && active.noteNumber >= 0 && active.noteNumber <= 127) {
            output.send(new Uint8Array([0x80 + (active.channel % 16), active.noteNumber, 0]));
          }
        } catch (e) {
          console.warn('[useMidiPlayer] Failed to send note-off:', e);
        }
      } else {
        stillActive.push(active);
      }
    }
    activeNotesRef.current = stillActive;

    // --- Find and play notes at current time ---
    const lookahead = 0.05;
    const playUntil = currentTime + lookahead;

    let index = lastPlayedIndexRef.current;

    while (index < notes.length) {
      const note = notes[index];
      if (note.time > playUntil) break;

      if (note.time >= currentTime - 0.1) {
        try {
          if (output.state === 'connected') {
            const safeChannel = note.channel % 16;
            const safeMidi = Math.max(0, Math.min(127, note.midi));
            const safeVelocity = Math.max(0, Math.min(127, note.velocity));
            
            output.send(new Uint8Array([0x90 + safeChannel, safeMidi, safeVelocity]));

            activeNotesRef.current.push({
              noteNumber: safeMidi,
              channel: safeChannel,
              offTime: note.time + note.duration,
            });
          }
        } catch (e) {
          console.warn('[useMidiPlayer] Failed to send note-on:', e);
        }
      }
      index++;
    }

    lastPlayedIndexRef.current = index;
  }, []);

  /**
   * Reset playback position to the beginning
   */
  const reset = useCallback(() => {
    lastPlayedIndexRef.current = 0;
    
    const output = outputRef.current;
    if (output) {
      for (let ch = 0; ch < 16; ch++) {
        try {
          output.send(new Uint8Array([0xB0 + ch, 123, 0]));
        } catch (e) {
        }
      }
    }
    
    activeNotesRef.current = [];
  }, []);

  /**
   * Seek to a specific time position
   */
  const seek = useCallback((time: number) => {
    const notes = scheduledNotesRef.current;
    
    let index = 0;
    for (let i = 0; i < notes.length; i++) {
      if (notes[i].time >= time) {
        index = i;
        break;
      }
      index = i + 1;
    }
    
    lastPlayedIndexRef.current = index;
    activeNotesRef.current = [];
    reset();
    lastPlayedIndexRef.current = index;
  }, [reset]);

  /**
   * Get the total duration of the loaded MIDI
   */
  const getDuration = useCallback((): number => {
    return midiRef.current?.duration || 0;
  }, []);

  return {
    loadSong,
    playTick,
    reset,
    seek,
    getDuration,
    isReady,
    isLoading,
    connectMidi,
    sendTestNote,
    availableOutputs,
    error,
    outputName,
  };
}

export default useMidiPlayer;
