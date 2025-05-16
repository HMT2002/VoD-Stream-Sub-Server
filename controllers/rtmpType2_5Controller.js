// Enhanced RTMP Server with proper connect command handling
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
    prefix: '/live',
  },
  http: {
    port: 8000,
    allow_origin: '*',
  },
};

// RTMP constants
const RTMP_VERSION = 3;
const RTMP_HANDSHAKE_SIZE = 1536;
const RTMP_HANDSHAKE_RANDOM_SIZE = 1528;

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

// AMF0 marker types
const AMF0_MARKER = {
  NUMBER: 0x00,
  BOOLEAN: 0x01,
  STRING: 0x02,
  OBJECT: 0x03,
  NULL: 0x05,
  ECMA_ARRAY: 0x08,
  OBJECT_END: 0x09,
  STRICT_ARRAY: 0x0a,
  DATE: 0x0b,
};

// User control message types
const USER_CONTROL_TYPES = {
  STREAM_BEGIN: 0,
  STREAM_EOF: 1,
  STREAM_DRY: 2,
  SET_BUFFER_LENGTH: 3,
  STREAM_IS_RECORDED: 4,
  PING_REQUEST: 6,
  PING_RESPONSE: 7,
};

class RTMPServer {
  constructor(config) {
    this.config = config;
    this.sessions = new Map();
    this.streams = new Map();
    this.nextTransactionId = 1;
  }

  start() {
    this.rtmpServer = net.createServer((socket) => {
      console.log(`New connection from ${socket.remoteAddress}:${socket.remotePort}`);

      const session = {
        id: crypto.randomBytes(8).toString('hex'),
        socket: socket,
        state: 'uninitialized',
        chunk_size: this.config.rtmp.chunk_size,
        buffer: Buffer.alloc(0),
        streamId: null,
        app: null,
        transactionId: 0,
        messageStreamId: 0,
        inChunkSize: 128, // Default RTMP chunk size
        outChunkSize: 128, // Default RTMP chunk size
        objectEncoding: 0, // AMF0
        windowAckSize: 2500000,
        acknowledged: 0,
        bytesReceived: 0,
      };

      this.sessions.set(session.id, session);

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

    this.rtmpServer.listen(this.config.rtmp.port, () => {
      console.log(`RTMP server running on port ${this.config.rtmp.port}`);
      console.log(`RTMP application prefix: ${this.config.rtmp.prefix}`);
    });
  }

  cleanupSession(session) {
    if (session.streamId && this.streams.has(session.streamId)) {
      const stream = this.streams.get(session.streamId);

      if (stream.publisher === session.id) {
        console.log(`Stream ${session.streamId} ended`);
        this.streams.delete(session.streamId);

        for (const subscriberId of stream.subscribers) {
          const subscriber = this.sessions.get(subscriberId);
          if (subscriber && subscriber.socket) {
            subscriber.socket.end();
          }
        }
      } else if (stream.subscribers.has(session.id)) {
        stream.subscribers.delete(session.id);
        console.log(`Client unsubscribed from stream ${session.streamId}`);
      }
    }

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
    session.buffer = Buffer.concat([session.buffer, data]);
    session.bytesReceived += data.length;

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
    if (session.buffer.length < 1 + RTMP_HANDSHAKE_SIZE) {
      return;
    }

    const c0 = session.buffer[0];
    console.log(`Received C0: RTMP version ${c0}`);

    if (c0 !== RTMP_VERSION) {
      console.error(`Unsupported RTMP version: ${c0}`);
      session.socket.end();
      return;
    }

    const c1 = session.buffer.slice(1, 1 + RTMP_HANDSHAKE_SIZE);
    const clientTime = c1.readUInt32BE(0);
    console.log(`Received C1: Client time ${clientTime}`);

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

    session.state = 'handshake-c2-pending';
    session.buffer = session.buffer.slice(1 + RTMP_HANDSHAKE_SIZE);
  }

  handleHandshakeC2(session) {
    if (session.buffer.length < RTMP_HANDSHAKE_SIZE) {
      return;
    }

    console.log('Received C2: Handshake complete');

    session.state = 'ready';
    session.buffer = session.buffer.slice(RTMP_HANDSHAKE_SIZE);

    if (session.buffer.length > 0) {
      this.processRTMPChunks(session);
    }
  }

  processRTMPChunks(session) {
    // RTMP Chunk Basic Header is at least 1 byte
    if (session.buffer.length < 1) {
      return;
    }

    // Parse the RTMP chunk basic header
    let chunkType = session.buffer[0] & 0xc0; // 2 bits
    let chunkStreamId = session.buffer[0] & 0x3f; // 6 bits
    let headerLength = 1; // Basic header size

    // Extended chunk stream ID
    if (chunkStreamId === 0) {
      if (session.buffer.length < 2) return;
      chunkStreamId = session.buffer[1] + 64;
      headerLength = 2;
    } else if (chunkStreamId === 1) {
      if (session.buffer.length < 3) return;
      chunkStreamId = session.buffer[1] + 64 + session.buffer[2] * 256;
      headerLength = 3;
    }

    // Determine chunk message header type (0, 1, 2, or 3)
    let chunkHeaderType = (session.buffer[0] & 0xc0) >> 6;

    // Determine message header size based on format
    let messageHeaderSize = 0;
    switch (chunkHeaderType) {
      case 0: // Type 0 - 11 bytes
        messageHeaderSize = 11;
        break;
      case 1: // Type 1 - 7 bytes
        messageHeaderSize = 7;
        break;
      case 2: // Type 2 - 3 bytes
        messageHeaderSize = 3;
        break;
      case 3: // Type 3 - 0 bytes
        messageHeaderSize = 0;
        break;
    }

    // Check if we have enough data for the header
    if (session.buffer.length < headerLength + messageHeaderSize) {
      return;
    }

    // Parse message header based on type
    let timestamp = 0;
    let messageLength = 0;
    let messageTypeId = 0;
    let messageStreamId = 0;

    if (chunkHeaderType === 0) {
      // Type 0 - Full header
      timestamp = session.buffer.readUIntBE(headerLength, 3);
      messageLength = session.buffer.readUIntBE(headerLength + 3, 3);
      messageTypeId = session.buffer[headerLength + 6];
      messageStreamId = session.buffer.readUInt32LE(headerLength + 7);
    } else if (chunkHeaderType === 1) {
      // Type 1 - No message stream ID
      timestamp = session.buffer.readUIntBE(headerLength, 3);
      messageLength = session.buffer.readUIntBE(headerLength + 3, 3);
      messageTypeId = session.buffer[headerLength + 6];
      // Use previous message stream ID
    } else if (chunkHeaderType === 2) {
      // Type 2 - Only timestamp delta
      timestamp = session.buffer.readUIntBE(headerLength, 3);
      // Use previous message length and type
    }
    // Type 3 - No header, use previous values

    // Extended timestamp if needed
    let extendedTimestampBytes = 0;
    if (timestamp >= 0xffffff) {
      if (session.buffer.length < headerLength + messageHeaderSize + 4) {
        return;
      }
      timestamp = session.buffer.readUInt32BE(headerLength + messageHeaderSize);
      extendedTimestampBytes = 4;
    }

    // Determine the total header size
    const totalHeaderSize = headerLength + messageHeaderSize + extendedTimestampBytes;

    // For simplicity, let's assume we have the full message in one chunk
    // Real implementation would handle chunking
    if (session.buffer.length < totalHeaderSize + messageLength) {
      return;
    }

    // Extract the message payload
    const payload = session.buffer.slice(totalHeaderSize, totalHeaderSize + messageLength);

    // Process the message based on message type
    this.handleRTMPMessage(session, messageTypeId, messageStreamId, payload);

    // Move buffer forward
    session.buffer = session.buffer.slice(totalHeaderSize + messageLength);

    // Continue processing if more data is available
    if (session.buffer.length > 0) {
      this.processRTMPChunks(session);
    }
  }

  handleRTMPMessage(session, messageTypeId, messageStreamId, payload) {
    console.log(`Handling message type: ${messageTypeId}, stream ID: ${messageStreamId}`);

    switch (messageTypeId) {
      case RTMP_MSG_TYPES.SET_CHUNK_SIZE:
        const newChunkSize = payload.readUInt32BE(0);
        console.log(`Client set chunk size to ${newChunkSize}`);
        session.inChunkSize = newChunkSize;
        break;

      case RTMP_MSG_TYPES.WINDOW_ACK_SIZE:
        const windowAckSize = payload.readUInt32BE(0);
        console.log(`Client set window acknowledgement size to ${windowAckSize}`);
        session.windowAckSize = windowAckSize;
        break;

      case RTMP_MSG_TYPES.COMMAND_AMF0:
        this.handleAMF0Command(session, payload, messageStreamId);
        break;

      case RTMP_MSG_TYPES.AUDIO:
        this.relayMediaPacket(session, payload, messageTypeId, messageStreamId);
        break;

      case RTMP_MSG_TYPES.VIDEO:
        this.relayMediaPacket(session, payload, messageTypeId, messageStreamId);
        break;

      default:
        console.log(`Unhandled message type: ${messageTypeId}`);
    }
  }

  handleAMF0Command(session, payload, messageStreamId) {
    // Simple AMF0 parser to extract command name and transaction ID

    // Skip the string marker byte (0x02)
    let offset = 1;

    // Read command name length (2 bytes)
    const commandNameLength = payload.readUInt16BE(offset);
    offset += 2;

    // Read command name
    const commandName = payload.slice(offset, offset + commandNameLength).toString();
    offset += commandNameLength;
    console.log(`Received AMF0 command: ${commandName}`);

    // Read transaction ID (number marker byte + 8 bytes double)
    offset += 1; // Skip the number marker byte (0x00)
    const transactionId = payload.readDoubleBE(offset);
    offset += 8;
    console.log(`Transaction ID: ${transactionId}`);

    // Store message stream ID and transaction ID for later use
    session.messageStreamId = messageStreamId;
    session.transactionId = transactionId;

    // Handle specific commands
    switch (commandName) {
      case 'connect':
        this.handleConnectCommand(session, payload, offset, transactionId);
        break;

      case 'createStream':
        this.handleCreateStreamCommand(session, transactionId);
        break;

      case 'publish':
        this.handlePublishCommand(session, payload, offset, transactionId, messageStreamId);
        break;

      case 'play':
        this.handlePlayCommand(session, payload, offset, transactionId, messageStreamId);
        break;

      default:
        console.log(`Unhandled command: ${commandName}`);
    }
  }

  handleConnectCommand(session, payload, offset, transactionId) {
    console.log('Handling connect command');

    // Skip the object marker byte (0x03)
    offset += 1;

    // Simple connection properties extraction (app name)
    let appName = '';

    // Scan for app property in the object (very simplified)
    const payloadStr = payload.toString();
    const appIndex = payloadStr.indexOf('app');

    if (appIndex > 0) {
      // Find the start of the value after 'app'
      let valueStart = payloadStr.indexOf(this.config.rtmp.prefix, appIndex);
      if (valueStart > 0) {
        // Extract until null byte or another property
        let valueEnd = valueStart;
        while (
          valueEnd < payloadStr.length &&
          payloadStr.charCodeAt(valueEnd) !== 0 &&
          payloadStr.charCodeAt(valueEnd) !== 0x00
        ) {
          valueEnd++;
        }
        appName = payloadStr.slice(valueStart, valueEnd);
      }
    }

    console.log(`Client connecting to app: ${appName}`);
    session.app = appName;

    // Send Window Acknowledgement Size
    this.sendWindowAckSize(session);

    // Send Set Peer Bandwidth
    this.sendSetPeerBandwidth(session);

    // Send Stream Begin
    this.sendUserControlMessage(session, USER_CONTROL_TYPES.STREAM_BEGIN, 0);

    // Send _result response to connect command
    this.sendConnectResult(session, transactionId);
  }

  sendWindowAckSize(session) {
    const message = Buffer.alloc(4);
    message.writeUInt32BE(session.windowAckSize, 0);
    this.sendRTMPMessage(session, RTMP_MSG_TYPES.WINDOW_ACK_SIZE, 0, message);
  }

  sendSetPeerBandwidth(session) {
    const message = Buffer.alloc(5);
    message.writeUInt32BE(session.windowAckSize, 0);
    message.writeUInt8(2, 4); // Dynamic
    this.sendRTMPMessage(session, RTMP_MSG_TYPES.SET_PEER_BANDWIDTH, 0, message);
  }

  sendUserControlMessage(session, eventType, eventData) {
    const message = Buffer.alloc(6);
    message.writeUInt16BE(eventType, 0);
    message.writeUInt32BE(eventData, 2);
    this.sendRTMPMessage(session, RTMP_MSG_TYPES.USER_CONTROL, 0, message);
  }

  sendConnectResult(session, transactionId) {
    // Create AMF0 encoded _result response

    // Command name: _result
    const commandNameBytes = this.encodeAMF0String('_result');

    // Transaction ID (same as request)
    const transactionIdBytes = this.encodeAMF0Number(transactionId);

    // Properties object with fmsVer, capabilities, etc.
    const propsBytes = this.encodeAMF0Object({
      fmsVer: 'FMS/3,0,0,0',
      capabilities: 31,
      mode: 1,
    });

    // Information object
    const infoBytes = this.encodeAMF0Object({
      level: 'status',
      code: 'NetConnection.Connect.Success',
      description: 'Connection succeeded.',
      objectEncoding: session.objectEncoding,
    });

    // Combine all parts
    const resultMessage = Buffer.concat([commandNameBytes, transactionIdBytes, propsBytes, infoBytes]);

    // Send the message
    this.sendRTMPMessage(session, RTMP_MSG_TYPES.COMMAND_AMF0, 0, resultMessage);
    console.log('Sent _result response to connect');
  }

  handleCreateStreamCommand(session, transactionId) {
    console.log('Handling createStream command');

    // Generate a new stream ID
    const newStreamId = this.nextTransactionId++;

    // Send _result response
    const commandNameBytes = this.encodeAMF0String('_result');
    const transactionIdBytes = this.encodeAMF0Number(transactionId);
    const nullBytes = this.encodeAMF0Null();
    const streamIdBytes = this.encodeAMF0Number(newStreamId);

    const resultMessage = Buffer.concat([commandNameBytes, transactionIdBytes, nullBytes, streamIdBytes]);

    this.sendRTMPMessage(session, RTMP_MSG_TYPES.COMMAND_AMF0, 0, resultMessage);
    console.log(`Created stream with ID: ${newStreamId}`);
  }

  handlePublishCommand(session, payload, offset, transactionId, messageStreamId) {
    console.log('Handling publish command');

    // Skip past the null object that follows transaction ID
    // Find the string marker (0x02) for stream name
    let streamNameOffset = offset;
    while (streamNameOffset < payload.length && payload[streamNameOffset] !== 0x02) {
      streamNameOffset++;
    }

    if (streamNameOffset >= payload.length) {
      console.error('Could not find stream name in publish command');
      return;
    }

    // Skip the string marker
    streamNameOffset++;

    // Read string length
    const streamNameLength = payload.readUInt16BE(streamNameOffset);
    streamNameOffset += 2;

    // Read stream name
    const streamName = payload.slice(streamNameOffset, streamNameOffset + streamNameLength).toString();
    console.log(`Client publishing stream: ${streamName}`);

    // Create full stream path
    session.streamId = `${session.app}/${streamName}`;

    // Create stream entry
    this.streams.set(session.streamId, {
      publisher: session.id,
      subscribers: new Set(),
      name: streamName,
      app: session.app,
    });

    // Send onStatus response
    this.sendOnStatus(session, messageStreamId, 'status', 'NetStream.Publish.Start', `Publishing ${streamName}`);
  }

  handlePlayCommand(session, payload, offset, transactionId, messageStreamId) {
    console.log('Handling play command');

    // Similar parsing as in publish to get stream name
    let streamNameOffset = offset;
    while (streamNameOffset < payload.length && payload[streamNameOffset] !== 0x02) {
      streamNameOffset++;
    }

    if (streamNameOffset >= payload.length) {
      console.error('Could not find stream name in play command');
      return;
    }

    // Skip the string marker
    streamNameOffset++;

    // Read string length
    const streamNameLength = payload.readUInt16BE(streamNameOffset);
    streamNameOffset += 2;

    // Read stream name
    const streamName = payload.slice(streamNameOffset, streamNameOffset + streamNameLength).toString();
    console.log(`Client playing stream: ${streamName}`);

    // Create full stream path
    session.streamId = `${session.app}/${streamName}`;

    // Send Stream Begin event
    this.sendUserControlMessage(session, USER_CONTROL_TYPES.STREAM_BEGIN, messageStreamId);

    // Send onStatus for NetStream.Play.Reset
    this.sendOnStatus(session, messageStreamId, 'status', 'NetStream.Play.Reset', 'Playing and resetting stream');

    // Send onStatus for NetStream.Play.Start
    this.sendOnStatus(session, messageStreamId, 'status', 'NetStream.Play.Start', `Started playing ${streamName}`);

    // Check if stream exists and subscribe
    if (this.streams.has(session.streamId)) {
      const stream = this.streams.get(session.streamId);
      stream.subscribers.add(session.id);
      console.log(`Client subscribed to stream ${session.streamId}`);
    } else {
      console.log(`Stream ${session.streamId} not found`);
      // In a real implementation, you might want to wait for the stream to become available
    }
  }

  sendOnStatus(session, messageStreamId, level, code, description) {
    // Command name: onStatus
    const commandNameBytes = this.encodeAMF0String('onStatus');

    // Transaction ID: 0
    const transactionIdBytes = this.encodeAMF0Number(0);

    // Null
    const nullBytes = this.encodeAMF0Null();

    // Info object
    const infoBytes = this.encodeAMF0Object({
      level: level,
      code: code,
      description: description,
    });

    // Combine all parts
    const statusMessage = Buffer.concat([commandNameBytes, transactionIdBytes, nullBytes, infoBytes]);

    // Send the message
    this.sendRTMPMessage(session, RTMP_MSG_TYPES.COMMAND_AMF0, messageStreamId, statusMessage);
    console.log(`Sent onStatus: ${code}`);
  }

  relayMediaPacket(session, payload, messageTypeId, messageStreamId) {
    // Check if this client is a publisher and the stream exists
    if (session.streamId && this.streams.has(session.streamId)) {
      const stream = this.streams.get(session.streamId);

      if (stream.publisher === session.id) {
        // This client is the publisher, relay to all subscribers
        for (const subscriberId of stream.subscribers) {
          const subscriber = this.sessions.get(subscriberId);
          if (subscriber && subscriber.socket) {
            // Send the media packet to the subscriber
            this.sendRTMPMessage(subscriber, messageTypeId, messageStreamId, payload);
          }
        }
      }
    }
  }

  sendRTMPMessage(session, messageTypeId, messageStreamId, payload) {
    // Create chunk header (basic header + message header)
    // Using chunk stream ID 4 for most messages
    const chunkStreamId = 4;
    const timestamp = 0; // For simplicity

    // Basic header (1 byte for chunk stream IDs 2-63)
    const basicHeader = Buffer.alloc(1);
    basicHeader[0] = (0 << 6) | chunkStreamId; // Format 0 (full header)

    // Message header (11 bytes for format 0)
    const messageHeader = Buffer.alloc(11);
    messageHeader.writeUIntBE(timestamp, 0, 3); // 3 bytes timestamp
    messageHeader.writeUIntBE(payload.length, 3, 3); // 3 bytes message length
    messageHeader[6] = messageTypeId; // 1 byte message type
    messageHeader.writeUInt32LE(messageStreamId, 7); // 4 bytes message stream ID (little endian)

    // Combine header and payload
    const message = Buffer.concat([basicHeader, messageHeader, payload]);

    // Send the message
    session.socket.write(message);
  }

  // AMF0 encoding helpers
  encodeAMF0String(str) {
    const length = Buffer.byteLength(str);
    const buffer = Buffer.alloc(length + 3);
    buffer[0] = AMF0_MARKER.STRING;
    buffer.writeUInt16BE(length, 1);
    buffer.write(str, 3);
    return buffer;
  }

  encodeAMF0Number(num) {
    const buffer = Buffer.alloc(9);
    buffer[0] = AMF0_MARKER.NUMBER;
    buffer.writeDoubleBE(num, 1);
    return buffer;
  }

  encodeAMF0Boolean(bool) {
    const buffer = Buffer.alloc(2);
    buffer[0] = AMF0_MARKER.BOOLEAN;
    buffer[1] = bool ? 1 : 0;
    return buffer;
  }

  encodeAMF0Null() {
    const buffer = Buffer.alloc(1);
    buffer[0] = AMF0_MARKER.NULL;
    return buffer;
  }

  encodeAMF0Object(obj) {
    // Start with object marker
    let parts = [Buffer.from([AMF0_MARKER.OBJECT])];

    // Add properties
    for (const key in obj) {
      // Property name
      const keyLength = Buffer.byteLength(key);
      const keyBuffer = Buffer.alloc(2 + keyLength);
      keyBuffer.writeUInt16BE(keyLength, 0);
      keyBuffer.write(key, 2);
      parts.push(keyBuffer);

      // Property value
      const value = obj[key];
      if (typeof value === 'string') {
        parts.push(this.encodeAMF0String(value));
      } else if (typeof value === 'number') {
        parts.push(this.encodeAMF0Number(value));
      } else if (typeof value === 'boolean') {
        parts.push(this.encodeAMF0Boolean(value));
      } else if (value === null) {
        parts.push(this.encodeAMF0Null());
      }
    }

    // End with object end marker (empty string + 0x09)
    parts.push(Buffer.from([0x00, 0x00, AMF0_MARKER.OBJECT_END]));

    return Buffer.concat(parts);
  }
}

// Create and start the server
const rtmpServer = new RTMPServer(config);
rtmpServer.start();

// Example usage with ffmpeg:
// 1. To publish: ffmpeg -re -i video.mp4 -c copy -f flv rtmp://localhost:1935/live/stream
// 2. To play: ffplay rtmp://localhost:1935/live/stream
