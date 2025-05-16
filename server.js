const dotenv = require('dotenv');
var path = require('path');

dotenv.config({ path: './config.env' });

const app = require('./app');

const dbVideoSharing = require('./config/database/db_index');
var httpAttach = require('http-attach'); // useful module for attaching middlewares

dbVideoSharing.connect();

const hls = require('hls-server');
const fs = require('fs');
const os = require('os');
const readline = require('readline');

let total_mem = os.totalmem();
const Log_CPU = (isLogOsCPU) => {
  let free_mem = os.freemem();

  let free_percentage = (free_mem / total_mem) * 100;
  if (isLogOsCPU) {
    console.log(os.cpus());
  }
};

//console.log(process.env);
//START SERVER
const port = Number(process.env.PORT) + Number(process.env.SERVERINDEX) * Number(process.env.SERVERREP) || 9100;
const server = app.listen(port, () => {
  console.log('App listening to ' + port);

  setInterval(function () {
    Log_CPU(false);
  }, 1000);
});
server.timeout = 15000; //15s

new hls(server, {
  provider: {
    exists: (req, cb) => {
      req.url = decodeURIComponent(req.url);
      console.log('server js exists' + req.url);
      req.url = decodeURIComponent(req.url);
      const ext = req.url.split('.')[1];
      if (ext !== 'm3u8' && ext !== 'ts') {
        return cb(null, true);
      }
      fs.access(__dirname + req.url, fs.constants.F_OK, function (err) {
        if (err) {
          console.log(__dirname + req.url);
          console.log(err);
          return cb(null, false);
        }
        cb(null, true);
      });
    },
    getManifestStream: (req, cb) => {
      req.url = decodeURIComponent(req.url);
      console.log('server js getManifestStream ' + req.url);
      const stream = fs.createReadStream(__dirname + req.url);
      cb(null, stream);
    },
    getSegmentStream: (req, cb) => {
      req.url = decodeURIComponent(req.url);
      console.log('server js getSegmentStream ' + req.url);
      const stream = fs.createReadStream(__dirname + req.url);
      cb(null, stream);
    },
  },
});

const NodeMediaServer = require('node-media-server');

const config = {
  rtmp: {
    port: Number(process.env.RTMPPORT) + Number(process.env.SERVERINDEX),
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60,
  },
  http: {
    port: Number(process.env.PORT) + Number(process.env.SERVERINDEX) * Number(process.env.SERVERREP) + 1,
    allow_origin: '*',
  },
};

var nms = new NodeMediaServer(config);
nms.run();
