const fs = require('fs');
const path = require('path');
const helperAPI = require('../modules/helperAPI');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');
const APIFeatures = require('./../utils/apiFeatures');
var FormData = require('form-data');
const axios = require('axios');
const { getHeapSnapshot } = require('v8');

exports.Default = catchAsync(async (req, res, next) => {
  res.status(200).json({
    default: 'default',
  });
});

exports.CheckHlsFile = catchAsync(async (req, res, next) => {
  const filename = req.params.filename || 'mkvmedium';
  const videoPath = 'videos/' + filename + 'Hls/' + filename + '.m3u8';
  // console.log(filename)
  const dir = 'videos/' + filename + 'Hls';
  console.log(dir);

  if (fs.existsSync(videoPath)) {
    const fileList = fs.readdirSync(dir);

    res.status(200).json({
      existed: true,
      path: videoPath,
      fileList,
    });
    return;
  } else {
    // res.status(200).json({
    //   existed:false,
    //   path:videoPath,
    // });
    const host = req.get('host');
    const fullURL = req.protocol + '://' + host + req.originalUrl;
    console.log(fullURL);
    res.redirect(308, 'http://localhost:9000/redirect/recall?videoname=' + filename + '&url=' + host);

    return;
  }
});

exports.CheckDashFile = catchAsync(async (req, res, next) => {
  const filename = req.params.filename || 'largetest5';
  const videoPath = 'videos/' + filename + 'Dash/init.mpd';
  const dir = 'videos/' + filename + 'Dash';
  console.log(dir);

  // console.log(fileList);
  if (fs.existsSync(videoPath)) {
    const fileList = fs.readdirSync(dir);

    res.status(200).json({
      existed: true,
      path: videoPath,
      fileList,
    });
    return;
  } else {
    // res.status(200).json({
    //   existed: false,
    //   path: videoPath,
    // });
    const host = req.get('host');
    const fullURL = req.protocol + '://' + host + req.originalUrl;
    console.log(fullURL);
    //the 307 http code spec 307 Temporary Redirect , a POST request must be repeated using another POST request.
    //308 preserves not only the HTTP method, but also indicates this is a permanent redirect.
    res.redirect(308, 'http://localhost:9000/redirect/recall?videoname=' + filename + '&url=' + host);

    return;
  }
});

exports.CheckIfThisServerIsFckingAlive = catchAsync(async (req, res, next) => {
  console.log('Check alive');
  const host = req.get('host');
  const testURL = req.protocol + '://' + host + req.originalUrl;
  const uploadURL = req.protocol + '://' + host + '/api/v1/upload/';
  console.log(uploadURL);
  res.status(200).json({
    status: 'alive',
    message: 'This server is alive',
    alive: true,
    testURL,
    uploadURL,
  });
});
