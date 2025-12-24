import { useState, useRef, useCallback, useEffect } from 'react';
import { Midi } from '@tonejs/midi';

/**
 * Represents a note that needs to be played
 */
interface ScheduledNote {
  time: number;
  midi: number;
  velocity: number;
  duration: number;
  channel: number;
}

interface ActiveNote {
  noteNumber: number;
  channel: number;
  offTime: number;
}

/**
 * useWifiMidiPlayer Hook
 * 
 * Sends MIDI data over WebSocket to a bridge server on the local network.
 * The bridge server forwards MIDI to loopMIDI on the PC.
 */
export function useWifiMidiPlayer() {
  const [isReady, setIsReady] = useState(false);
  const [serverAddress, setServerAddress] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');

  const midiRef = useRef<Midi | null>(null);
  const scheduledNotesRef = useRef<ScheduledNote[]>([]);
  const activeNotesRef = useRef<ActiveNote[]>([]);
  const lastPlayedIndexRef = useRef(0);
  const wsRef = useRef<WebSocket | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  /**
   * Connect to WiFi MIDI Bridge server
   */
  const connectMidi = useCallback(async (address?: string) => {
    const targetAddress = address || serverAddress;
    
    if (!targetAddress) {
      setError('Please enter server address');
      return;
    }

    // Format address
    let wsUrl = targetAddress;
    if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) {
      wsUrl = `ws://${wsUrl}`;
    }
    if (!wsUrl.includes(':')) {
      wsUrl = `${wsUrl}:3030`;
    }

    setIsLoading(true);
    setError(null);
    setConnectionStatus('connecting');

    try {
      // Close existing connection
      if (wsRef.current) {
        wsRef.current.close();
      }

      console.log(`[useWifiMidiPlayer] Connecting to ${wsUrl}...`);

      const ws = new WebSocket(wsUrl);
      
      // Set timeout for connection
      const timeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          setError('Connection timeout');
          setConnectionStatus('disconnected');
          setIsLoading(false);
        }
      }, 5000);

      ws.onopen = () => {
        clearTimeout(timeout);
        console.log('[useWifiMidiPlayer] Connected!');
        wsRef.current = ws;
        setServerAddress(targetAddress);
        setIsReady(true);
        setConnectionStatus('connected');
        setIsLoading(false);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'welcome') {
            console.log('[useWifiMidiPlayer] Server:', data.message);
          }
        } catch (e) {
          // Ignore parse errors
        }
      };

      ws.onerror = (event) => {
        clearTimeout(timeout);
        console.error('[useWifiMidiPlayer] WebSocket error');
        setError('Connection failed');
        setConnectionStatus('disconnected');
        setIsLoading(false);
      };

      ws.onclose = () => {
        console.log('[useWifiMidiPlayer] Disconnected');
        setIsReady(false);
        setConnectionStatus('disconnected');
        wsRef.current = null;
      };

    } catch (e) {
      const message = e instanceof Error ? e.message : 'Connection failed';
      setError(message);
      setConnectionStatus('disconnected');
      setIsLoading(false);
    }
  }, [serverAddress]);

  /**
   * Disconnect from server
   */
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsReady(false);
    setConnectionStatus('disconnected');
  }, []);

  /**
   * Send MIDI data over WebSocket
   */
  const sendMidi = useCallback((data: number[]) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      wsRef.current.send(JSON.stringify({
        type: 'midi',
        data: data,
        timestamp: Date.now()
      }));
    } catch (e) {
      // Silently fail
    }
  }, []);

  /**
   * Send test note
   */
  const sendTestNote = useCallback(() => {
    if (!isReady) {
      console.warn('[useWifiMidiPlayer] Not connected');
      return;
    }

    console.log('[useWifiMidiPlayer] Sending test note...');
    
    // Note On
    sendMidi([0x90, 60, 100]);
    
    // Note Off after 500ms
    setTimeout(() => {
      sendMidi([0x80, 60, 0]);
    }, 500);
  }, [isReady, sendMidi]);

  /**
   * Load a MIDI file
   */
  const loadSong = useCallback(async (url: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const midi = new Midi(arrayBuffer);
      midiRef.current = midi;

      console.log(`[useWifiMidiPlayer] Loaded: ${midi.name || url}, Duration: ${midi.duration.toFixed(2)}s`);

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

      console.log(`[useWifiMidiPlayer] Prepared ${allNotes.length} notes`);
      setIsLoading(false);
      return true;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load';
      setError(message);
      setIsLoading(false);
      return false;
    }
  }, []);

  /**
   * Play tick - call this from animation loop
   */
  const playTick = useCallback((currentTime: number) => {
    if (!isReady) return;

    const notes = scheduledNotesRef.current;
    if (notes.length === 0) return;

    // Process Note-Offs
    const stillActive: ActiveNote[] = [];
    for (const active of activeNotesRef.current) {
      if (currentTime >= active.offTime) {
        sendMidi([0x80 + (active.channel % 16), active.noteNumber, 0]);
      } else {
        stillActive.push(active);
      }
    }
    activeNotesRef.current = stillActive;

    // Find and play notes
    const lookahead = 0.05;
    const playUntil = currentTime + lookahead;
    let index = lastPlayedIndexRef.current;

    while (index < notes.length) {
      const note = notes[index];
      if (note.time > playUntil) break;

      if (note.time >= currentTime - 0.1) {
        const safeChannel = note.channel % 16;
        const safeMidi = Math.max(0, Math.min(127, note.midi));
        const safeVelocity = Math.max(0, Math.min(127, note.velocity));

        sendMidi([0x90 + safeChannel, safeMidi, safeVelocity]);

        activeNotesRef.current.push({
          noteNumber: safeMidi,
          channel: safeChannel,
          offTime: note.time + note.duration,
        });
      }
      index++;
    }

    lastPlayedIndexRef.current = index;
  }, [isReady, sendMidi]);

  /**
   * Reset playback
   */
  const reset = useCallback(() => {
    lastPlayedIndexRef.current = 0;
    
    // Send all notes off
    for (let ch = 0; ch < 16; ch++) {
      sendMidi([0xB0 + ch, 123, 0]);
    }
    
    activeNotesRef.current = [];
  }, [sendMidi]);

  return {
    // State
    isReady,
    isLoading,
    error,
    serverAddress,
    connectionStatus,
    
    // Methods
    setServerAddress,
    connectMidi,
    disconnect,
    sendTestNote,
    sendMidi,
    loadSong,
    playTick,
    reset,
  };
}

export default useWifiMidiPlayer;
