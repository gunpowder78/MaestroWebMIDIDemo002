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
 * 
 * Handles MIDI file loading, Web MIDI connection, and playback.
 * 
 * Features:
 * - Loads MIDI files via fetch + @tonejs/midi parsing
 * - Connects to first available Web MIDI output
 * - Channel auto-mapping: uses track.channel or trackIndex % 16
 * - Velocity debounce: ignores notes with velocity < 10
 * - Precise timing with performance.now() offset
 */
export function useMidiPlayer() {
  // --- State ---
  const [isReady, setIsReady] = useState(false);
  const [outputName, setOutputName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Refs for non-reactive state ---
  const midiRef = useRef<Midi | null>(null);
  const outputRef = useRef<MIDIOutput | null>(null);
  const scheduledNotesRef = useRef<ScheduledNote[]>([]);
  const activeNotesRef = useRef<ActiveNote[]>([]);
  const lastPlayedIndexRef = useRef(0);

  /**
   * Initialize Web MIDI API and get the first output port
   */
  const initMidiOutput = useCallback(async (): Promise<MIDIOutput | null> => {
    if (!navigator.requestMIDIAccess) {
      setError('Web MIDI API not supported in this browser');
      return null;
    }

    try {
      const midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      const outputs = Array.from(midiAccess.outputs.values());

      if (outputs.length === 0) {
        setError('No MIDI output devices found');
        return null;
      }

      // Use the first available output
      const output = outputs[0];
      outputRef.current = output;
      setOutputName(output.name || 'Unknown MIDI Device');
      
      console.log(`[useMidiPlayer] Connected to MIDI output: ${output.name}`);
      return output;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to access MIDI';
      setError(message);
      console.error('[useMidiPlayer] MIDI access error:', err);
      return null;
    }
  }, []);

  /**
   * Load a MIDI file from URL and prepare it for playback
   * @param url - Path to the MIDI file (e.g., '/song1.mid')
   */
  const loadSong = useCallback(async (url: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    setIsReady(false);

    try {
      // 1. Fetch the MIDI file as ArrayBuffer
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch MIDI file: ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();

      // 2. Parse with @tonejs/midi
      const midi = new Midi(arrayBuffer);
      midiRef.current = midi;

      console.log(`[useMidiPlayer] Loaded: ${midi.name || url}`);
      console.log(`[useMidiPlayer] Tracks: ${midi.tracks.length}, Duration: ${midi.duration.toFixed(2)}s`);

      // 3. Flatten all notes with channel mapping
      const allNotes: ScheduledNote[] = [];

      midi.tracks.forEach((track, trackIndex) => {
        // Channel auto-mapping:
        // - Use track.channel if it exists
        // - Otherwise use trackIndex % 16
        const channel = (track.channel !== undefined && track.channel >= 0)
          ? track.channel
          : trackIndex % 16;

        track.notes.forEach((note) => {
          // Velocity debounce: ignore notes with velocity < 10
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

      // 4. Sort by time for efficient playback
      allNotes.sort((a, b) => a.time - b.time);
      scheduledNotesRef.current = allNotes;
      lastPlayedIndexRef.current = 0;
      activeNotesRef.current = [];

      console.log(`[useMidiPlayer] Prepared ${allNotes.length} notes for playback`);

      // 5. Initialize MIDI output if not already done
      if (!outputRef.current) {
        await initMidiOutput();
      }

      setIsReady(true);
      setIsLoading(false);
      return true;

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load MIDI';
      setError(message);
      console.error('[useMidiPlayer] Load error:', err);
      setIsLoading(false);
      return false;
    }
  }, [initMidiOutput]);

  /**
   * Play notes at the current time position
   * @param currentTime - Current playback time in seconds
   */
  const playTick = useCallback((currentTime: number) => {
    const output = outputRef.current;
    const notes = scheduledNotesRef.current;

    if (!output || notes.length === 0) return;

    const now = performance.now();
    const timestampOffset = 20; // 20ms ahead for precise timing

    // --- Process Note-Offs for active notes ---
    const stillActive: ActiveNote[] = [];
    for (const active of activeNotesRef.current) {
      if (currentTime >= active.offTime) {
        // Send Note-Off: 0x80 + channel, note, 0
        try {
          output.send([0x80 + active.channel, active.noteNumber, 0], now + timestampOffset);
        } catch (e) {
          console.warn('[useMidiPlayer] Failed to send note-off:', e);
        }
      } else {
        stillActive.push(active);
      }
    }
    activeNotesRef.current = stillActive;

    // --- Find and play notes at current time ---
    // Use a small lookahead window (50ms) for smooth playback
    const lookahead = 0.05;
    const playUntil = currentTime + lookahead;

    let index = lastPlayedIndexRef.current;

    while (index < notes.length) {
      const note = notes[index];

      // If note is in the future beyond our window, stop
      if (note.time > playUntil) {
        break;
      }

      // If note is in our window and hasn't been skipped (past)
      if (note.time >= currentTime - 0.1) {
        // Send Note-On: 0x90 + channel, note, velocity
        try {
          output.send([0x90 + note.channel, note.midi, note.velocity], now + timestampOffset);

          // Track this note for note-off
          activeNotesRef.current.push({
            noteNumber: note.midi,
            channel: note.channel,
            offTime: note.time + note.duration,
          });
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
    
    // Send all-notes-off on all channels
    const output = outputRef.current;
    if (output) {
      for (let ch = 0; ch < 16; ch++) {
        // All Notes Off (CC 123)
        try {
          output.send([0xB0 + ch, 123, 0]);
        } catch (e) {
          // Ignore
        }
      }
    }
    
    activeNotesRef.current = [];
  }, []);

  /**
   * Seek to a specific time position
   * @param time - Time in seconds to seek to
   */
  const seek = useCallback((time: number) => {
    const notes = scheduledNotesRef.current;
    
    // Find the first note at or after the target time
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
    
    // Send all-notes-off
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
    error,
    outputName,
  };
}

export default useMidiPlayer;
