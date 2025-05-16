const NodeMediaServer = require('node-media-server');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration for the RTMP server
const config = {
  rtmp: {
    port: 1936,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60,
  },
  http: {
    port: 8000,
    allow_origin: '*',
  },
  // Uncomment to enable HTTPS
  // https: {
  //   port: 8443,
  //   key: './privatekey.pem',
  //   cert: './certificate.pem',
  // },
  trans: {
    ffmpeg: process.platform === 'win32' ? 'C:\\ffmpeg\\bin\\ffmpeg.exe' : '/usr/bin/ffmpeg',
    tasks: [
      {
        app: 'live',
        hls: true,
        hlsFlags: '[hls_time=2:hls_list_size=3:hls_flags=delete_segments]',
        dash: true,
        dashFlags: '[f=dash:window_size=3:extra_window_size=5]',
      },
    ],
  },
};

// Create and start the media server
const nms = new NodeMediaServer(config);
nms.run();

// Create streams directory if it doesn't exist
const streamsDir = path.join(__dirname, 'streams');
if (!fs.existsSync(streamsDir)) {
  fs.mkdirSync(streamsDir);
}

console.log(`RTMP Server running on rtmp://localhost:${config.rtmp.port}`);
console.log(`HTTP Server running on http://localhost:${config.http.port}`);
console.log('Available endpoints:');
console.log('- Stream to: rtmp://localhost:1935/live/STREAM_NAME');
console.log('- HLS: http://localhost:8000/live/STREAM_NAME/index.m3u8');
console.log('- DASH: http://localhost:8000/live/STREAM_NAME/index.mpd');

// Monitor server events
nms.on('preConnect', (id, args) => {
  console.log('[NodeEvent on preConnect]', `id=${id} args=${JSON.stringify(args)}`);
});

nms.on('postConnect', (id, args) => {
  console.log('[NodeEvent on postConnect]', `id=${id} args=${JSON.stringify(args)}`);
});

nms.on('doneConnect', (id, args) => {
  console.log('[NodeEvent on doneConnect]', `id=${id} args=${JSON.stringify(args)}`);
});

nms.on('prePublish', (id, StreamPath, args) => {
  console.log('[NodeEvent on prePublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});

nms.on('postPublish', (id, StreamPath, args) => {
  console.log('[NodeEvent on postPublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});

nms.on('donePublish', (id, StreamPath, args) => {
  console.log('[NodeEvent on donePublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});

nms.on('prePlay', (id, StreamPath, args) => {
  console.log('[NodeEvent on prePlay]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});

nms.on('postPlay', (id, StreamPath, args) => {
  console.log('[NodeEvent on postPlay]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});

nms.on('donePlay', (id, StreamPath, args) => {
  console.log('[NodeEvent on donePlay]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});

// Helper function to start an FFmpeg stream to the server
function startStream(inputPath, streamName) {
  const ffmpegArgs = [
    '-re',
    '-i',
    inputPath,
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    '-ar',
    '44100',
    '-ac',
    '1',
    '-f',
    'flv',
    `rtmp://localhost:${config.rtmp.port}/live/${streamName}`,
  ];

  const ffmpeg = spawn(config.trans.ffmpeg, ffmpegArgs);

  ffmpeg.stdout.on('data', (data) => {
    console.log(`FFmpeg stdout: ${data}`);
  });

  ffmpeg.stderr.on('data', (data) => {
    console.log(`FFmpeg stderr: ${data.toString()}`);
  });

  ffmpeg.on('close', (code) => {
    console.log(`FFmpeg process exited with code ${code}`);
  });

  return ffmpeg;
}

// Example usage (uncomment to test)
// const stream = startStream('path/to/your/video.mp4', 'test');
// setTimeout(() => {
//   stream.kill('SIGINT');
//   console.log('Stream stopped');
// }, 60000); // Stop after 1 minute
