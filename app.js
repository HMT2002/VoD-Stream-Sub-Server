'use strict';
const express = require('express');
const morgan = require('morgan');
const app = express();
const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');
const videoController = require('./controllers/videoController');
const testController = require('./controllers/testController');
const defaultController = require('./controllers/defaultController');

const cors = require('cors');
var path = require('path');
const fs = require('fs');

//ROUTES
const videoRoute = require('./routes/videoRoute');
const replicateRoute = require('./routes/replicateRoute');
const uploadRoute = require('./routes/uploadRoute');

const deleteRoute = require('./routes/deleteRoute');
const checkRoute = require('./routes/checkRoute');
const testRoute = require('./routes/testRoute');
const defaultRouter = require('./routes/defaultRoute');
const streamingRoute = require('./routes/streamingRoute');

// const client_posts = JSON.parse(fs.readFileSync('./json-resources/client_posts.json'));

//MIDDLEWARE
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
}
console.log(process.env.NODE_ENV);
app.use(express.json());

app.use(cors());
app.options('*', cors());
const whitelist = ['http://localhost:9000', 'http://localhost:9100', 'http://localhost:9200', 'http://localhost:9300'];

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, PATCH, DELETE, OPTIONS, HEAD, PUT');
  // res.setHeader(
  //   'Access-Control-Allow-Headers',
  //   'Access-Control-Allow-Headers, Origin,Accept, X-Api-Key, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers, Access-Control-Allow-Headers, Authorization, index'
  // );

  // res.setHeader('Access-Control-Allow-Credentials', 'true');
  // res.setHeader('Access-Control-Allow-Methods', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');

  // res.header('Access-Control-Allow-Origin', '*');
  // res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  // console.log(req.requestTime);
  req.url = decodeURIComponent(req.url);
  next();
});
app.get('/is-this-alive', defaultController.CheckIfThisServerIsFckingAlive);

app.use('/api/v1/check', checkRoute);

// #region Handling mpd and m4s token request || phải để này trên cùng để tăng ưu tiên xử lý request duôi *.mpd hoặc *.m4s
app.use(cors()).get(
  '/dash-token/:token*.mpd',
  (req, res, next) => {
    console.log('Request URL:', req.originalUrl + ' -> ');
    next();
  },
  (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  },
  videoController.MPDTokenHandler
);
app.use(cors()).get(
  '/dash-token/:token/:segment*.m4s',
  (req, res, next) => {
    console.log('Request URL:', req.originalUrl + ' -> ');
    next();
  },
  (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  },
  videoController.M4STokenHandler
);
// #endregion

// #region Handling extra requests, such as subtitle requests
app.get('/*.vtt', videoController.VTTHandler);
app.get('/*.ass', videoController.ASSHandler);
app.get('/*.srt', videoController.SRTHandler);
app.get('/*.mp4', videoController.MP4MPDHandler);
app.get('/*.mpd', videoController.MPDHandler);
app.get('/*.m4s', videoController.M4SHandler);

// app.get('/*.m3u8', videoController.M3u8Handler);
// app.get('/*.ts', videoController.TsHandler);

// #endregion

//app.use('/', defaultRoute);

app.use('/api/test', testRoute);
app.use('/api/default', defaultRouter);

app.use('/api/v1/video', videoRoute);
app.use('/api/v1/upload', uploadRoute);
app.use('/api/v1/replicate', replicateRoute);
app.use('/api/v1/delete', deleteRoute);
app.use('/api/v1/streaming', streamingRoute);

app.all('*', (req, res, next) => {
  next(new AppError('Cant find ' + req.originalUrl + ' on the server', 404));
});
app.use(globalErrorHandler);

module.exports = app;
