/**
 * MIDI Bridge Server
 * 
 * WebSocket server that receives MIDI messages from the mobile app
 * and forwards them to a local MIDI port (e.g., loopMIDI).
 * 
 * Usage:
 *   1. Install dependencies: npm install
 *   2. Run: npm start
 *   3. Connect from mobile app to ws://<your-ip>:3030
 */

const WebSocket = require('ws');
const easymidi = require('easymidi');
const os = require('os');

// Configuration
const WS_PORT = 3030;
const TARGET_MIDI_PORT_NAME = 'Maestro'; // Will search for ports containing this string

// Find and open MIDI port
function findAndOpenMidiPort() {
  const outputs = easymidi.getOutputs();
  console.log(`\nFound ${outputs.length} MIDI output port(s):`);
  
  outputs.forEach((port, i) => {
    console.log(`  [${i}] ${port}`);
  });

  // Try to find a port matching the target name
  for (const portName of outputs) {
    if (portName.toLowerCase().includes(TARGET_MIDI_PORT_NAME.toLowerCase())) {
      console.log(`\n✓ Connecting to MIDI port: ${portName}`);
      return new easymidi.Output(portName);
    }
  }

  // If no match, try to open the first port
  if (outputs.length > 0) {
    console.log(`\n⚠ Using first available port: ${outputs[0]}`);
    return new easymidi.Output(outputs[0]);
  }

  console.error('\n✗ No MIDI output ports found!');
  console.error('  Please install loopMIDI and create a virtual port.');
  return null;
}

// Get local IP addresses
function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  
  return ips;
}

// Initialize MIDI
const midiOutput = findAndOpenMidiPort();
if (!midiOutput) {
  process.exit(1);
}

// Create WebSocket server
const wss = new WebSocket.Server({ port: WS_PORT });

console.log(`\n========================================`);
console.log(`   MIDI Bridge Server Running`);
console.log(`========================================`);
console.log(`\nWebSocket Port: ${WS_PORT}`);
console.log(`\nConnect from mobile app using one of these addresses:`);
getLocalIPs().forEach(ip => {
  console.log(`  ws://${ip}:${WS_PORT}`);
});
console.log(`\nWaiting for connections...`);

// Track connected clients
let clientCount = 0;

// Parse MIDI message and send via easymidi
function sendMidiMessage(data) {
  if (!Array.isArray(data) || data.length < 1) return;

  const status = data[0];
  const msgType = status & 0xF0;
  const channel = status & 0x0F;

  switch (msgType) {
    case 0x90: // Note On
      if (data.length >= 3) {
        midiOutput.send('noteon', {
          note: data[1],
          velocity: data[2],
          channel: channel
        });
        console.log(`♪ Note ON:  ch:${channel} note:${data[1]} vel:${data[2]}`);
      }
      break;

    case 0x80: // Note Off
      if (data.length >= 3) {
        midiOutput.send('noteoff', {
          note: data[1],
          velocity: data[2],
          channel: channel
        });
        console.log(`♪ Note OFF: ch:${channel} note:${data[1]}`);
      }
      break;

    case 0xB0: // Control Change
      if (data.length >= 3) {
        midiOutput.send('cc', {
          controller: data[1],
          value: data[2],
          channel: channel
        });
      }
      break;

    case 0xC0: // Program Change
      if (data.length >= 2) {
        midiOutput.send('program', {
          number: data[1],
          channel: channel
        });
      }
      break;

    default:
      // Raw send for other messages
      console.log(`Raw MIDI: ${data.map(b => b.toString(16)).join(' ')}`);
  }
}

wss.on('connection', (ws, req) => {
  clientCount++;
  const clientIP = req.socket.remoteAddress;
  console.log(`\n[+] Client connected from ${clientIP} (total: ${clientCount})`);

  ws.on('message', (rawData) => {
    try {
      const message = JSON.parse(rawData);
      
      if (message.type === 'midi') {
        sendMidiMessage(message.data);
      } else if (message.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      }
    } catch (e) {
      console.error('Error processing message:', e.message);
    }
  });

  ws.on('close', () => {
    clientCount--;
    console.log(`[-] Client disconnected (remaining: ${clientCount})`);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error.message);
  });

  // Send welcome message
  ws.send(JSON.stringify({ 
    type: 'welcome',
    message: 'Connected to MIDI Bridge Server'
  }));
});

// Handle server errors
wss.on('error', (error) => {
  console.error('Server error:', error.message);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nShutting down...');
  midiOutput.close();
  wss.close();
  process.exit(0);
});

console.log('\nPress Ctrl+C to stop the server.\n');
