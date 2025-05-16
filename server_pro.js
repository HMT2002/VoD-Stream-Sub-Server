const dotenv = require('dotenv');
var path = require('path');

dotenv.config({ path: './config.env' });

const express = require('express');
const morgan = require('morgan');
const cors = require('cors');

const app = express();
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
}
app.use(express.json());

app.use(cors());
app.options('*', cors());
const dbVideoSharing = require('./config/database/db_index');
var httpAttach = require('http-attach'); // useful module for attaching middlewares

dbVideoSharing.connect();

const hls = require('hls-server');
const fs = require('fs');

const NodeMediaServer = require('node-media-server');

const config = {
  rtmp: {
    // port: Number(process.env.RTMPPORT) + Number(process.env.SERVERINDEX) + 2,
    port: 1935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60,
  },
  http: {
    port: Number(process.env.PORT) + Number(process.env.SERVERINDEX) * Number(process.env.SERVERREP) + 1,
    allow_origin: '*',
  },
  // RTSP configuration
  rtsp: {
    port: 5554,
  },
};

var nms = new NodeMediaServer(config);

// Track active streams
const activeStreams = new Map();

// Add event listeners for RTMP commands
nms.on('preConnect', (id, args) => {
  console.log('[NodeEvent on preConnect]', id, args);
  // You can validate connection here
});

nms.on('postPlay', (id, StreamPath, args) => {
  console.log('[NodeEvent on postPlay]', id, StreamPath, args);
  // Stream started playing
});

nms.on('donePlay', (id, StreamPath, args) => {
  console.log('[NodeEvent on donePlay]', id, StreamPath, args);
  // Stream stopped playing
});
function validatePublisher(StreamPath, args) {
  return true;
}
// Ví dụ xác thực
nms.on('prePublish', (id, StreamPath, args) => {
  // Xác thực quyền phát hành
  if (validatePublisher(StreamPath, args)) {
    // Cho phép luồng
  } else {
    let session = nms.getSession(id);
    session.reject();
  }
});

// When a stream starts publishing
nms.on('postPublish', (id, StreamPath, args) => {
  console.log('[Stream Published]', id, StreamPath);
  activeStreams.set(StreamPath, id);
});

// When a stream stops publishing
nms.on('donePublish', (id, StreamPath, args) => {
  console.log('[Stream Ended]', id, StreamPath);
  activeStreams.delete(StreamPath);
});

nms.run();

//console.log(process.env);
//START SERVER
const port = Number(process.env.PORT) + Number(process.env.SERVERINDEX) * Number(process.env.SERVERREP) || 9100;

app.use('/api/stream/control', (req, res, next) => {
  // Handle stream control endpoint
  let body = req.body;
  console.log(body);

  try {
    console.log(2);
    const { action, streamPath } = body;

    if (action === 'stop' && streamPath) {
      const publisherId = activeStreams.get(streamPath);
      console.log('1');

      if (publisherId) {
        console.log('2');
        console.log(publisherId);

        // This terminates the publisher's connection
        nms.getSession(publisherId).reject();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Stream stopped' }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Stream not found' }));
      }
    } else {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Invalid action' }));
    }
  } catch (e) {
    console.log(e);
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, message: 'Invalid request' }));
  }
});

const server = app.listen(port, () => {
  console.log('App listening to ' + port);
});
server.timeout = 15000; //15s
