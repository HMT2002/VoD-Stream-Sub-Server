// Basic RTMP Server Implementation from Scratch
const net = require('net');
const crypto = require('crypto');

// Configuration options
const config = {
  rtmp: {
    port: 1936,
    chunk_size: 60000,
    gop_cache: true,
    ping_timeout: 60,
    ping_interval: 30,
    prefix: '/live', // RTMP application prefix
  },
  http: {
    port: 8000, // For HTTP callbacks if needed
    allow_origin: '*',
  },
};

// RTMP constants
const RTMP_VERSION = 3;
const RTMP_HANDSHAKE_SIZE = 1536;
const RTMP_HANDSHAKE_RANDOM_SIZE = 1528; // Size without header
const RTMP_CHUNK_HEADER_SIZE = 12;

// RTMP message types
const RTMP_MSG_TYPES = {
  SET_CHUNK_SIZE: 1,
  ABORT: 2,
  ACKNOWLEDGEMENT: 3,
  USER_CONTROL: 4,
  WINDOW_ACK_SIZE: 5,
  SET_PEER_BANDWIDTH: 6,
  AUDIO: 8,
  VIDEO: 9,
  DATA_AMF3: 15,
  SHARED_OBJECT_AMF3: 16,
  COMMAND_AMF3: 17,
  DATA_AMF0: 18,
  SHARED_OBJECT_AMF0: 19,
  COMMAND_AMF0: 20,
  AGGREGATE: 22,
};

// RTMP server class
class RTMPServer {
  constructor(config) {
    this.config = config;
    this.sessions = new Map();
    this.streams = new Map();
    this.clients = new Set();
  }

  start() {
    // Create RTMP server
    this.rtmpServer = net.createServer((socket) => {
      console.log(`New connection from ${socket.remoteAddress}:${socket.remotePort}`);

      // Create a new client session
      const session = {
        id: crypto.randomBytes(8).toString('hex'),
        socket: socket,
        state: 'uninitialized',
        chunk_size: this.config.rtmp.chunk_size,
        buffer: Buffer.alloc(0),
        streamId: null,
        app: null,
      };

      this.sessions.set(session.id, session);

      // Handle socket events
      socket.on('data', (data) => {
        this.handleSocketData(session, data);
      });

      socket.on('error', (err) => {
        console.error(`Socket error: ${err.message}`);
        this.cleanupSession(session);
      });

      socket.on('close', () => {
        console.log(`Connection closed: ${socket.remoteAddress}:${socket.remotePort}`);
        this.cleanupSession(session);
      });
    });

    // Start listening
    this.rtmpServer.listen(this.config.rtmp.port, () => {
      console.log(`RTMP server running on port ${this.config.rtmp.port}`);
      console.log(`RTMP application prefix: ${this.config.rtmp.prefix}`);
    });
  }

  cleanupSession(session) {
    if (session.streamId && this.streams.has(session.streamId)) {
      const stream = this.streams.get(session.streamId);

      // Remove publisher if this client is the publisher
      if (stream.publisher === session.id) {
        console.log(`Stream ${session.streamId} ended`);
        this.streams.delete(session.streamId);

        // Notify all subscribers that the stream has ended
        for (const subscriberId of stream.subscribers) {
          const subscriber = this.sessions.get(subscriberId);
          if (subscriber && subscriber.socket) {
            subscriber.socket.end();
          }
        }
      } else if (stream.subscribers.has(session.id)) {
        // Remove subscriber
        stream.subscribers.delete(session.id);
        console.log(`Client unsubscribed from stream ${session.streamId}`);
      }
    }

    // Close socket and remove session
    if (session.socket) {
      try {
        session.socket.end();
      } catch (err) {
        // Ignore error if socket already closed
      }
    }

    this.sessions.delete(session.id);
  }

  handleSocketData(session, data) {
    // Append new data to existing buffer
    session.buffer = Buffer.concat([session.buffer, data]);

    // Process data based on the current session state
    switch (session.state) {
      case 'uninitialized':
        this.handleHandshakeC0C1(session);
        break;
      case 'handshake-c2-pending':
        this.handleHandshakeC2(session);
        break;
      case 'ready':
        this.processRTMPChunks(session);
        break;
      default:
        console.error(`Unknown session state: ${session.state}`);
    }
  }

  handleHandshakeC0C1(session) {
    // Check if we have enough data for C0 (1 byte) and C1 (1536 bytes)
    if (session.buffer.length < 1 + RTMP_HANDSHAKE_SIZE) {
      return; // Not enough data yet
    }

    // Process C0 (RTMP version)
    const c0 = session.buffer[0];
    console.log(`Received C0: RTMP version ${c0}`);

    if (c0 !== RTMP_VERSION) {
      console.error(`Unsupported RTMP version: ${c0}`);
      session.socket.end();
      return;
    }

    // Extract C1 (time + random data)
    const c1 = session.buffer.slice(1, 1 + RTMP_HANDSHAKE_SIZE);
    const clientTime = c1.readUInt32BE(0);
    console.log(`Received C1: Client time ${clientTime}`);

    // Send S0+S1+S2
    // S0: Server RTMP version
    const s0 = Buffer.alloc(1);
    s0[0] = RTMP_VERSION;

    // S1: Server time + zero + random data
    const s1 = Buffer.alloc(RTMP_HANDSHAKE_SIZE);
    const serverTime = Math.floor(Date.now() / 1000);
    s1.writeUInt32BE(serverTime, 0);
    s1.writeUInt32BE(0, 4); // Zero
    crypto.randomFillSync(s1, 8, RTMP_HANDSHAKE_RANDOM_SIZE);

    // S2: Echo of C1
    const s2 = Buffer.from(c1);
    s2.writeUInt32BE(serverTime, 4); // Update server time

    // Send S0+S1+S2 in one packet
    const response = Buffer.concat([s0, s1, s2]);
    session.socket.write(response);
    console.log('Sent S0+S1+S2');

    // Update session state and buffer
    session.state = 'handshake-c2-pending';
    session.buffer = session.buffer.slice(1 + RTMP_HANDSHAKE_SIZE);
  }

  handleHandshakeC2(session) {
    // Check if we have enough data for C2 (1536 bytes)
    if (session.buffer.length < RTMP_HANDSHAKE_SIZE) {
      return; // Not enough data yet
    }

    // Process C2
    const c2 = session.buffer.slice(0, RTMP_HANDSHAKE_SIZE);
    console.log('Received C2: Handshake complete');

    // Update session state and buffer
    session.state = 'ready';
    session.buffer = session.buffer.slice(RTMP_HANDSHAKE_SIZE);

    // Continue processing any remaining data as RTMP chunks
    if (session.buffer.length > 0) {
      this.processRTMPChunks(session);
    }
  }

  processRTMPChunks(session) {
    // Basic implementation to handle RTMP chunks
    // In a real implementation, you would parse the chunk header and payload

    // For simplicity, we'll just handle AMF0 commands
    if (session.buffer.length < 12) {
      return; // Not enough data for basic header
    }

    // Very simplified chunk parsing - in a real implementation this would be much more complex
    try {
      // Try to find "connect" command for app name
      const connectIndex = session.buffer.indexOf('connect');
      if (connectIndex > 0 && connectIndex < 100) {
        // Look for app name after connect command
        const appNameIndex = session.buffer.indexOf(this.config.rtmp.prefix, connectIndex);
        if (appNameIndex > 0) {
          // Extract app name (simplistic approach)
          let endIndex = appNameIndex + this.config.rtmp.prefix.length;
          while (endIndex < session.buffer.length && session.buffer[endIndex] !== 0) {
            endIndex++;
          }

          const appPath = session.buffer.slice(appNameIndex, endIndex).toString();
          console.log(`Client connecting to app: ${appPath}`);
          session.app = appPath;

          // In a real implementation, you would process the connect command properly
          // and respond with _result

          // For now, we'll just acknowledge with a Window Acknowledgement Size message
          const ackSize = Buffer.alloc(16);
          ackSize[0] = 0x02; // chunk stream ID
          ackSize[1] = 0x00; // timestamp (3 bytes)
          ackSize[2] = 0x00;
          ackSize[3] = 0x00;
          ackSize[4] = 0x00; // message length (3 bytes)
          ackSize[5] = 0x00;
          ackSize[6] = 0x04;
          ackSize[7] = RTMP_MSG_TYPES.WINDOW_ACK_SIZE; // message type ID
          ackSize[8] = 0x00; // message stream ID (4 bytes, little endian)
          ackSize[9] = 0x00;
          ackSize[10] = 0x00;
          ackSize[11] = 0x00;
          ackSize.writeUInt32BE(2500000, 12); // window acknowledgement size

          session.socket.write(ackSize);
          console.log('Sent Window Acknowledgement Size');

          // Clear buffer for next messages
          session.buffer = Buffer.alloc(0);
          console.log('session.buffer = Buffer.alloc(0);');
          return;
        }
      }

      // Handle publish command
      const publishIndex = session.buffer.indexOf('publish');
      if (publishIndex > 0 && publishIndex < 100) {
        // Extract stream name (simplistic approach)
        const nameIndex = publishIndex + 20; // rough estimate of where the stream name might start
        if (nameIndex < session.buffer.length) {
          let endIndex = nameIndex;
          while (endIndex < session.buffer.length && session.buffer[endIndex] !== 0 && session.buffer[endIndex] !== 2) {
            // Looking for end of string
            endIndex++;
          }

          const streamName = session.buffer.slice(nameIndex, endIndex).toString();
          if (streamName.length > 0) {
            console.log(`Client publishing stream: ${streamName}`);
            session.streamId = `${session.app}/${streamName}`;

            // Create a new stream entry
            this.streams.set(session.streamId, {
              publisher: session.id,
              subscribers: new Set(),
              name: streamName,
              app: session.app,
            });

            // Clear buffer for next messages
            session.buffer = Buffer.alloc(0);

            // In a real implementation, you would send a proper _result response
            return;
          }
        }
      }

      // Handle play command
      const playIndex = session.buffer.indexOf('play');
      if (playIndex > 0 && playIndex < 100) {
        // Extract stream name (simplistic approach)
        const nameIndex = playIndex + 15; // rough estimate of where the stream name might start
        if (nameIndex < session.buffer.length) {
          let endIndex = nameIndex;
          while (endIndex < session.buffer.length && session.buffer[endIndex] !== 0 && session.buffer[endIndex] !== 2) {
            // Looking for end of string
            endIndex++;
          }

          const streamName = session.buffer.slice(nameIndex, endIndex).toString();
          if (streamName.length > 0) {
            console.log(`Client playing stream: ${streamName}`);
            session.streamId = `${session.app}/${streamName}`;

            // Check if the stream exists
            if (this.streams.has(session.streamId)) {
              const stream = this.streams.get(session.streamId);

              // Add this client as a subscriber
              stream.subscribers.add(session.id);
              console.log(`Client subscribed to stream ${session.streamId}`);

              // In a real implementation, you would set up relaying of the stream data
            } else {
              console.log(`Stream ${session.streamId} not found`);
              // In a real implementation, you would notify the client
            }

            // Clear buffer for next messages
            session.buffer = Buffer.alloc(0);
            return;
          }
        }
      }

      // For video/audio packets, we would need to relay them to subscribers
      if (session.streamId && this.streams.has(session.streamId)) {
        const stream = this.streams.get(session.streamId);

        // If this client is the publisher and we detect video/audio data
        if (stream.publisher === session.id) {
          // In a real implementation, we would parse the RTMP chunk properly,
          // identify if it's video or audio data, and relay it to all subscribers

          // For simplicity, we'll just forward the raw data to all subscribers
          // (this won't work properly in practice without proper RTMP parsing)
          for (const subscriberId of stream.subscribers) {
            const subscriber = this.sessions.get(subscriberId);
            if (subscriber && subscriber.socket) {
              try {
                subscriber.socket.write(session.buffer);
              } catch (err) {
                console.error(`Error forwarding data to subscriber: ${err.message}`);
              }
            }
          }
        }
      }

      // Clear the buffer for the next chunk
      // In a real implementation, you would only consume the bytes that were actually processed
      session.buffer = Buffer.alloc(0);
    } catch (err) {
      console.error(`Error processing RTMP chunk: ${err.message}`);
      // Clear buffer to avoid getting stuck in a loop with malformed data
      session.buffer = Buffer.alloc(0);
    }
  }
}

// Create and start the server
const rtmpServer = new RTMPServer(config);
rtmpServer.start();

// Example usage:
// 1. To publish: ffmpeg -re -i video.mp4 -c copy -f flv rtmp://localhost:1935/live/stream
// 2. To play: ffplay rtmp://localhost:1935/live/stream
