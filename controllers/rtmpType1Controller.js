const net = require('net');
const { EventEmitter } = require('events');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// RTMP constants
const RTMP_VERSION = 3;
const RTMP_HANDSHAKE_SIZE = 1536;
const RTMP_HANDSHAKE_PACKET_SIZE = RTMP_HANDSHAKE_SIZE + 1;
const RTMP_CHUNK_HEADER_TYPE_0 = 0; // 11 bytes: timestamp(3) + length(3) + type(1) + stream id(4)
const RTMP_CHUNK_HEADER_TYPE_1 = 1; // 7 bytes: delta(3) + length(3) + type(1)
const RTMP_CHUNK_HEADER_TYPE_2 = 2; // 3 bytes: delta(3)
const RTMP_CHUNK_HEADER_TYPE_3 = 3; // 0 bytes: no header

// RTMP message types
const RTMP_MSG_SET_CHUNK_SIZE = 1;
const RTMP_MSG_ACK = 3;
const RTMP_MSG_USER_CONTROL = 4;
const RTMP_MSG_WINDOW_ACK_SIZE = 5;
const RTMP_MSG_SET_PEER_BANDWIDTH = 6;
const RTMP_MSG_AUDIO = 8;
const RTMP_MSG_VIDEO = 9;
const RTMP_MSG_AMF3_COMMAND = 17;
const RTMP_MSG_AMF0_COMMAND = 20;
const RTMP_MSG_AMF0_DATA = 18;
const RTMP_MSG_AMF3_DATA = 15;

// AMF0 data types
const AMF0_NUMBER = 0x00;
const AMF0_BOOLEAN = 0x01;
const AMF0_STRING = 0x02;
const AMF0_OBJECT = 0x03;
const AMF0_NULL = 0x05;
const AMF0_ECMA_ARRAY = 0x08;
const AMF0_OBJECT_END = 0x09;

class RTMPChunkStream {
  constructor(session) {
    this.session = session;
    this.inChunkSize = 128;
    this.outChunkSize = 128;
    this.receivedChunks = {};
    this.previousChunks = {};
    this.incompleteChunks = {};
  }

  handleData(data) {
    let offset = 0;
    while (offset < data.length) {
      // Parse basic header (first byte)
      const headerType = (data[offset] & 0xc0) >> 6;
      const chunkStreamId = data[offset] & 0x3f;
      offset++;

      let timestamp = 0;
      let messageLength = 0;
      let messageTypeId = 0;
      let messageStreamId = 0;

      // Get existing chunk if we have one
      const existingChunk = this.previousChunks[chunkStreamId];

      // Parse the chunk header based on type
      switch (headerType) {
        case RTMP_CHUNK_HEADER_TYPE_0: // Type 0 - full header
          timestamp = data.readUIntBE(offset, 3);
          offset += 3;
          messageLength = data.readUIntBE(offset, 3);
          offset += 3;
          messageTypeId = data[offset];
          offset++;
          messageStreamId = data.readUInt32LE(offset);
          offset += 4;
          break;

        case RTMP_CHUNK_HEADER_TYPE_1: // Type 1 - timestamp delta, message length, message type
          timestamp = data.readUIntBE(offset, 3);
          offset += 3;
          messageLength = data.readUIntBE(offset, 3);
          offset += 3;
          messageTypeId = data[offset];
          offset++;
          if (existingChunk) {
            messageStreamId = existingChunk.messageStreamId;
          }
          break;

        case RTMP_CHUNK_HEADER_TYPE_2: // Type 2 - timestamp delta only
          timestamp = data.readUIntBE(offset, 3);
          offset += 3;
          if (existingChunk) {
            messageLength = existingChunk.messageLength;
            messageTypeId = existingChunk.messageTypeId;
            messageStreamId = existingChunk.messageStreamId;
          }
          break;

        case RTMP_CHUNK_HEADER_TYPE_3: // Type 3 - no header, using previous values
          if (existingChunk) {
            timestamp = existingChunk.timestamp;
            messageLength = existingChunk.messageLength;
            messageTypeId = existingChunk.messageTypeId;
            messageStreamId = existingChunk.messageStreamId;
          }
          break;
      }

      // Extended timestamp if needed
      if (timestamp === 0xffffff) {
        timestamp = data.readUInt32BE(offset);
        offset += 4;
      }

      // Create or retrieve the chunk
      let chunk = this.incompleteChunks[chunkStreamId];
      if (!chunk) {
        chunk = {
          headerType,
          chunkStreamId,
          timestamp,
          messageLength,
          messageTypeId,
          messageStreamId,
          data: Buffer.alloc(messageLength),
          receivedLength: 0,
        };
        this.incompleteChunks[chunkStreamId] = chunk;
      }

      // Calculate how much data to read
      const bytesToRead = Math.min(this.inChunkSize, chunk.messageLength - chunk.receivedLength, data.length - offset);

      // Copy chunk data
      data.copy(chunk.data, chunk.receivedLength, offset, offset + bytesToRead);
      chunk.receivedLength += bytesToRead;
      offset += bytesToRead;

      // Store this chunk as the previous one for this stream
      this.previousChunks[chunkStreamId] = {
        timestamp: chunk.timestamp,
        messageLength: chunk.messageLength,
        messageTypeId: chunk.messageTypeId,
        messageStreamId: chunk.messageStreamId,
      };

      // If we've received the complete message
      if (chunk.receivedLength === chunk.messageLength) {
        this.handleMessage(chunk);
        delete this.incompleteChunks[chunkStreamId];
      }
    }
  }

  handleMessage(chunk) {
    console.log(`Received RTMP message: type=${chunk.messageTypeId}, length=${chunk.messageLength}`);

    switch (chunk.messageTypeId) {
      case RTMP_MSG_SET_CHUNK_SIZE:
        this.inChunkSize = chunk.data.readUInt32BE(0);
        console.log(`Set chunk size: ${this.inChunkSize}`);
        break;

      case RTMP_MSG_AMF0_COMMAND:
        this.handleAMF0Command(chunk);
        break;

      case RTMP_MSG_AMF3_COMMAND:
        // Skip first byte (usually 0) for AMF3
        this.handleAMF0Command({ ...chunk, data: chunk.data.slice(1) });
        break;

      case RTMP_MSG_WINDOW_ACK_SIZE:
        const windowSize = chunk.data.readUInt32BE(0);
        console.log(`Window ack size: ${windowSize}`);
        this.session.sendWindowAckSize(windowSize);
        break;

      case RTMP_MSG_USER_CONTROL:
        const eventType = chunk.data.readUInt16BE(0);
        console.log(`User control message: ${eventType}`);
        break;

      case RTMP_MSG_AUDIO:
        this.session.onAudioData(chunk);
        break;

      case RTMP_MSG_VIDEO:
        this.session.onVideoData(chunk);
        break;
    }
  }

  handleAMF0Command(chunk) {
    let offset = 0;
    const commands = [];

    // Parse AMF0 data
    while (offset < chunk.data.length) {
      const dataType = chunk.data[offset];
      offset++;

      switch (dataType) {
        case AMF0_STRING:
          const stringLength = chunk.data.readUInt16BE(offset);
          offset += 2;
          const stringValue = chunk.data.toString('utf8', offset, offset + stringLength);
          offset += stringLength;
          commands.push(stringValue);
          break;

        case AMF0_NUMBER:
          const numberValue = chunk.data.readDoubleBE(offset);
          offset += 8;
          commands.push(numberValue);
          break;

        case AMF0_BOOLEAN:
          const boolValue = chunk.data[offset] !== 0;
          offset += 1;
          commands.push(boolValue);
          break;

        case AMF0_NULL:
          commands.push(null);
          break;

        case AMF0_OBJECT:
          const obj = {};
          while (true) {
            const keyLength = chunk.data.readUInt16BE(offset);
            offset += 2;

            if (keyLength === 0) {
              // Check for object end marker
              if (chunk.data[offset] === AMF0_OBJECT_END) {
                offset++;
                break;
              }
            }

            const key = chunk.data.toString('utf8', offset, offset + keyLength);
            offset += keyLength;

            const valueType = chunk.data[offset];
            offset++;

            let value;
            switch (valueType) {
              case AMF0_STRING:
                const valStringLength = chunk.data.readUInt16BE(offset);
                offset += 2;
                value = chunk.data.toString('utf8', offset, offset + valStringLength);
                offset += valStringLength;
                break;

              case AMF0_NUMBER:
                value = chunk.data.readDoubleBE(offset);
                offset += 8;
                break;

              case AMF0_BOOLEAN:
                value = chunk.data[offset] !== 0;
                offset += 1;
                break;

              case AMF0_NULL:
                value = null;
                break;

              default:
                console.log(`Unsupported AMF0 value type: ${valueType}`);
                value = null;
                // Skip unknown data
                offset += 1;
            }

            obj[key] = value;
          }
          commands.push(obj);
          break;

        default:
          console.log(`Unsupported AMF0 data type: ${dataType}`);
          // Skip unknown data
          offset += 1;
      }
    }

    console.log('AMF0 Command:', commands);

    if (commands.length >= 1) {
      const commandName = commands[0];
      const transactionId = commands[1];

      switch (commandName) {
        case 'connect':
          this.session.handleConnect(transactionId, commands[2]);
          break;

        case 'createStream':
          this.session.handleCreateStream(transactionId);
          break;

        case 'publish':
          this.session.handlePublish(transactionId, commands[3], commands[4]);
          break;

        case 'play':
          this.session.handlePlay(transactionId, commands[3]);
          break;

        case 'deleteStream':
          this.session.handleDeleteStream(commands[2]);
          break;

        default:
          console.log(`Unknown command: ${commandName}`);
      }
    }
  }

  // Create an AMF0 encoded string
  static encodeAMF0String(str) {
    const buffer = Buffer.alloc(str.length + 3);
    buffer[0] = AMF0_STRING;
    buffer.writeUInt16BE(str.length, 1);
    buffer.write(str, 3);
    return buffer;
  }

  // Create an AMF0 encoded number
  static encodeAMF0Number(num) {
    const buffer = Buffer.alloc(9);
    buffer[0] = AMF0_NUMBER;
    buffer.writeDoubleBE(num, 1);
    return buffer;
  }

  // Create an AMF0 encoded null
  static encodeAMF0Null() {
    return Buffer.from([AMF0_NULL]);
  }

  // Create an AMF0 encoded object
  static encodeAMF0Object(obj) {
    // Calculate size first
    let size = 1; // Object marker
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        size += 2 + key.length; // key length + key

        const value = obj[key];
        if (typeof value === 'string') {
          size += 3 + value.length; // Type + length + string
        } else if (typeof value === 'number') {
          size += 9; // Type + double
        } else if (typeof value === 'boolean') {
          size += 2; // Type + boolean
        } else if (value === null) {
          size += 1; // Type only
        }
      }
    }
    size += 3; // Object end marker (00 00 09)

    const buffer = Buffer.alloc(size);
    let offset = 0;

    buffer[offset++] = AMF0_OBJECT;

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        buffer.writeUInt16BE(key.length, offset);
        offset += 2;
        buffer.write(key, offset);
        offset += key.length;

        const value = obj[key];
        if (typeof value === 'string') {
          buffer[offset++] = AMF0_STRING;
          buffer.writeUInt16BE(value.length, offset);
          offset += 2;
          buffer.write(value, offset);
          offset += value.length;
        } else if (typeof value === 'number') {
          buffer[offset++] = AMF0_NUMBER;
          buffer.writeDoubleBE(value, offset);
          offset += 8;
        } else if (typeof value === 'boolean') {
          buffer[offset++] = AMF0_BOOLEAN;
          buffer[offset++] = value ? 1 : 0;
        } else if (value === null) {
          buffer[offset++] = AMF0_NULL;
        }
      }
    }

    // Object end marker
    buffer.writeUInt16BE(0, offset);
    offset += 2;
    buffer[offset] = AMF0_OBJECT_END;

    return buffer;
  }
}

class RTMPSession {
  constructor(socket, server) {
    this.socket = socket;
    this.server = server;
    this.state = 'uninitialized';
    this.clientChunkStream = new RTMPChunkStream(this);
    this.streamId = 0;
    this.streamName = '';
    this.appName = '';
    this.publishType = '';
    this.videoTimestamp = 0;
    this.audioTimestamp = 0;

    this.socket.on('data', this.handleSocketData.bind(this));
    this.socket.on('close', this.handleSocketClose.bind(this));
    this.socket.on('error', this.handleSocketError.bind(this));

    // Start handshake process
    this.startHandshake();
  }

  handleSocketData(data) {
    try {
      switch (this.state) {
        case 'uninitialized':
          this.handleHandshakeC0C1(data);
          break;

        case 'handshake-c0c1-received':
          this.handleHandshakeC2(data);
          break;

        case 'handshake-complete':
          this.clientChunkStream.handleData(data);
          break;
      }
    } catch (err) {
      console.error('Error handling socket data:', err);
    }
  }

  handleSocketClose() {
    console.log('Client disconnected');

    // If we have a stream, tell the server to remove it
    if (this.streamName) {
      this.server.unpublishStream(this.appName, this.streamName);
    }
  }

  handleSocketError(err) {
    console.error('Socket error:', err);
  }

  startHandshake() {
    // Send handshake packet S0 (version) and S1 (timestamp + random data)
    const s0s1 = Buffer.alloc(RTMP_HANDSHAKE_PACKET_SIZE);
    s0s1[0] = RTMP_VERSION;

    // Timestamp in S1
    const timestamp = Math.floor(Date.now() / 1000);
    s0s1.writeUInt32BE(timestamp, 1);

    // Zero out next 4 bytes
    s0s1.writeUInt32BE(0, 5);

    // Fill the rest with random data
    crypto.randomFillSync(s0s1, 9, RTMP_HANDSHAKE_SIZE - 8);

    this.socket.write(s0s1);
  }

  handleHandshakeC0C1(data) {
    if (data.length < RTMP_HANDSHAKE_PACKET_SIZE) {
      console.error('C0/C1 handshake packet too small');
      this.socket.end();
      return;
    }

    // Verify C0 (version)
    const version = data[0];
    if (version !== RTMP_VERSION) {
      console.warn(`Client requested RTMP version ${version}, but we support ${RTMP_VERSION}`);
    }

    // Extract client timestamp from C1
    const clientTimestamp = data.readUInt32BE(1);

    // Send S2 (echo timestamp from C1 + random data)
    const s2 = Buffer.alloc(RTMP_HANDSHAKE_SIZE);

    // Echo client timestamp
    s2.writeUInt32BE(clientTimestamp, 0);

    // Echo client timestamp again (time2)
    s2.writeUInt32BE(Math.floor(Date.now() / 1000), 4);

    // Fill the rest with random data
    crypto.randomFillSync(s2, 8, RTMP_HANDSHAKE_SIZE - 8);

    this.socket.write(s2);
    this.state = 'handshake-c0c1-received';
  }

  handleHandshakeC2(data) {
    if (data.length < RTMP_HANDSHAKE_SIZE) {
      console.error('C2 handshake packet too small');
      this.socket.end();
      return;
    }

    console.log('Handshake completed successfully');
    this.state = 'handshake-complete';
  }

  sendRTMPMessage(chunkStreamId, messageTypeId, messageStreamId, data) {
    // RTMP chunk header (type 0)
    const timestamp = 0;
    const headerSize = 12; // Basic header (1) + type 0 message header (11)
    const header = Buffer.alloc(headerSize);

    // Basic header (first byte)
    header[0] = (RTMP_CHUNK_HEADER_TYPE_0 << 6) | (chunkStreamId & 0x3f);

    // Type 0 message header
    header.writeUIntBE(timestamp, 1, 3); // Timestamp
    header.writeUIntBE(data.length, 4, 3); // Message length
    header[7] = messageTypeId; // Message type
    header.writeUInt32LE(messageStreamId, 8); // Message stream ID

    // Send header and data
    this.socket.write(Buffer.concat([header, data]));
  }

  sendChunkSize(size) {
    const data = Buffer.alloc(4);
    data.writeUInt32BE(size, 0);
    this.sendRTMPMessage(2, RTMP_MSG_SET_CHUNK_SIZE, 0, data);
    this.clientChunkStream.outChunkSize = size;
  }

  sendWindowAckSize(size) {
    const data = Buffer.alloc(4);
    data.writeUInt32BE(size, 0);
    this.sendRTMPMessage(2, RTMP_MSG_WINDOW_ACK_SIZE, 0, data);
  }

  sendSetPeerBandwidth(size, type) {
    const data = Buffer.alloc(5);
    data.writeUInt32BE(size, 0);
    data[4] = type;
    this.sendRTMPMessage(2, RTMP_MSG_SET_PEER_BANDWIDTH, 0, data);
  }

  sendAMF0Command(chunkStreamId, streamId, command, transactionId, ...args) {
    // Encode command name
    const buffers = [RTMPChunkStream.encodeAMF0String(command), RTMPChunkStream.encodeAMF0Number(transactionId)];

    // Add additional arguments
    for (const arg of args) {
      if (arg === null) {
        buffers.push(RTMPChunkStream.encodeAMF0Null());
      } else if (typeof arg === 'object') {
        buffers.push(RTMPChunkStream.encodeAMF0Object(arg));
      } else if (typeof arg === 'number') {
        buffers.push(RTMPChunkStream.encodeAMF0Number(arg));
      } else if (typeof arg === 'string') {
        buffers.push(RTMPChunkStream.encodeAMF0String(arg));
      }
    }

    const data = Buffer.concat(buffers);
    this.sendRTMPMessage(chunkStreamId, RTMP_MSG_AMF0_COMMAND, streamId, data);
  }

  handleConnect(transactionId, connectInfo) {
    console.log('Client connect:', connectInfo);

    // Extract application name
    this.appName = connectInfo.app || '';

    // Accept connection
    this.sendWindowAckSize(2500000);
    this.sendSetPeerBandwidth(2500000, 2);
    this.sendChunkSize(4096);

    // Send result
    this.sendAMF0Command(
      3,
      0,
      '_result',
      transactionId,
      {
        fmsVer: 'FMS/3,0,0,0',
        capabilities: 31,
      },
      {
        level: 'status',
        code: 'NetConnection.Connect.Success',
        description: 'Connection succeeded.',
        objectEncoding: 0,
      }
    );
  }

  handleCreateStream(transactionId) {
    this.streamId = this.server.nextStreamId++;
    this.sendAMF0Command(3, 0, '_result', transactionId, null, this.streamId);
  }

  handlePublish(transactionId, streamName, publishType) {
    this.streamName = streamName;
    this.publishType = publishType || 'live';

    console.log(`Client publishing: ${this.appName}/${this.streamName} (${this.publishType})`);

    // Register this session as a publisher for this stream
    const success = this.server.publishStream(this.appName, this.streamName, this);

    if (success) {
      // Send status message
      this.sendAMF0Command(5, this.streamId, 'onStatus', 0, null, {
        level: 'status',
        code: 'NetStream.Publish.Start',
        description: `Publishing ${this.streamName}.`,
      });
    } else {
      // Send error
      this.sendAMF0Command(5, this.streamId, 'onStatus', 0, null, {
        level: 'error',
        code: 'NetStream.Publish.BadName',
        description: `Stream ${this.streamName} already being published.`,
      });
    }
  }

  handlePlay(transactionId, streamName) {
    this.streamName = streamName;

    console.log(`Client playing: ${this.appName}/${this.streamName}`);

    // Register this session as a subscriber for this stream
    const publisher = this.server.getStreamPublisher(this.appName, this.streamName);

    if (publisher) {
      console.log(`Client subscribing to existing stream: ${this.appName}/${this.streamName}`);
      this.server.subscribeToStream(this.appName, this.streamName, this);

      // Send status messages
      this.sendAMF0Command(5, this.streamId, 'onStatus', 0, null, {
        level: 'status',
        code: 'NetStream.Play.Start',
        description: `Started playing ${this.streamName}.`,
      });
    } else {
      console.log(`No publisher found for stream: ${this.appName}/${this.streamName}`);

      // Send stream not found error
      this.sendAMF0Command(5, this.streamId, 'onStatus', 0, null, {
        level: 'error',
        code: 'NetStream.Play.StreamNotFound',
        description: `Stream ${this.streamName} not found.`,
      });
    }
  }

  handleDeleteStream(streamId) {
    console.log(`Client deleting stream: ${streamId}`);

    if (this.streamName) {
      this.server.unpublishStream(this.appName, this.streamName);
      this.streamName = '';
    }
  }

  onAudioData(chunk) {
    // Forward audio data to all subscribers
    this.audioTimestamp = chunk.timestamp;
    this.server.broadcastStreamData(this.appName, this.streamName, chunk);
  }

  onVideoData(chunk) {
    // Forward video data to all subscribers
    this.videoTimestamp = chunk.timestamp;
    this.server.broadcastStreamData(this.appName, this.streamName, chunk);
  }
}

class RTMPServer extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      port: config.port || 1935,
      chunkSize: config.chunkSize || 4096,
      // Set default app paths if not provided
      appPrefixes: config.appPrefixes || ['live', 'stream', 'vod', 'record'],
      logLevel: config.logLevel || 'info',
    };

    this.server = null;
    this.sessions = new Set();
    this.nextStreamId = 1;

    // Stores publishers for streams: { appName: { streamName: RTMPSession } }
    this.publishers = {};

    // Stores subscribers for streams: { appName: { streamName: Set<RTMPSession> } }
    this.subscribers = {};

    // Create media storage directory
    this.mediaDir = path.join(__dirname, 'media');
    if (!fs.existsSync(this.mediaDir)) {
      fs.mkdirSync(this.mediaDir);
    }
  }

  start() {
    return new Promise((resolve, reject) => {
      try {
        this.server = net.createServer((socket) => {
          this.handleConnection(socket);
        });

        this.server.on('error', (err) => {
          console.error('Server error:', err);
          this.emit('error', err);
          reject(err);
        });

        this.server.listen(this.config.port, () => {
          console.log(`RTMP Server running on port ${this.config.port}`);
          console.log(`Configured app prefixes: ${this.config.appPrefixes.join(', ')}`);
          this.emit('start');
          resolve();
        });
      } catch (err) {
        console.error('Failed to start server:', err);
        reject(err);
      }
    });
  }

  stop() {
    return new Promise((resolve) => {
      if (this.server) {
        // Close all sessions
        for (const session of this.sessions) {
          session.socket.end();
        }

        this.server.close(() => {
          console.log('RTMP Server stopped');
          this.emit('stop');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  handleConnection(socket) {
    const clientAddress = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`New connection from ${clientAddress}`);

    const session = new RTMPSession(socket, this);
    this.sessions.add(session);

    socket.on('close', () => {
      this.sessions.delete(session);
      console.log(`Connection from ${clientAddress} closed`);
    });

    this.emit('connection', session);
  }

  publishStream(appName, streamName, session) {
    // Check if this app exists
    if (!this.publishers[appName]) {
      this.publishers[appName] = {};
    }

    // Check if stream is already being published
    if (this.publishers[appName][streamName]) {
      return false;
    }

    // Register publisher
    this.publishers[appName][streamName] = session;

    // Initialize subscribers set if needed
    if (!this.subscribers[appName]) {
      this.subscribers[appName] = {};
    }
    if (!this.subscribers[appName][streamName]) {
      this.subscribers[appName][streamName] = new Set();
    }

    console.log(`Stream published: ${appName}/${streamName}`);
    this.emit('streamPublish', appName, streamName, session);

    return true;
  }

  unpublishStream(appName, streamName) {
    if (this.publishers[appName] && this.publishers[appName][streamName]) {
      delete this.publishers[appName][streamName];

      console.log(`Stream unpublished: ${appName}/${streamName}`);
      this.emit('streamUnpublish', appName, streamName);

      // Notify subscribers that stream has ended
      if (this.subscribers[appName] && this.subscribers[appName][streamName]) {
        for (const subscriber of this.subscribers[appName][streamName]) {
          subscriber.sendAMF0Command(5, subscriber.streamId, 'onStatus', 0, null, {
            level: 'status',
            code: 'NetStream.Play.Stop',
            description: 'Stream ended.',
          });
        }

        // Clear subscribers
        this.subscribers[appName][streamName].clear();
      }

      return true;
    }

    return false;
  }

  getStreamPublisher(appName, streamName) {
    if (this.publishers[appName] && this.publishers[appName][streamName]) {
      return this.publishers[appName][streamName];
    }

    return null;
  }

  subscribeToStream(appName, streamName, session) {
    // Initialize subscribers set if needed
    if (!this.subscribers[appName]) {
      this.subscribers[appName] = {};
    }
    if (!this.subscribers[appName][streamName]) {
      this.subscribers[appName][streamName] = new Set();
    }
  }
}
