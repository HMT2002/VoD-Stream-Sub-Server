const fs = require('fs');
const path = require('path');
const helperAPI = require('../modules/helperAPI');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const APIFeatures = require('../utils/apiFeatures');
var FormData = require('form-data');
const axios = require('axios');

exports.ReceiveDeleteRequest = catchAsync(async (req, res, next) => {
  const filename = req.body.filename || 'largetest.mp4';
  const videoPath = 'videos/' + filename;
  const url = req.body.url || 'http://localhost';
  const port = req.body.port || '';
  if (!fs.existsSync(videoPath)) {
    console.log('not found video');
    res.status(201).json({
      message: 'video not found on ' + url + port + ' path: ' + videoPath,
    });
  } else {
    console.log('found video, deleting...');
    fs.unlinkSync(videoPath);
    res.status(201).json({
      message: 'video deleted on ' + url + port + ' path: ' + videoPath,
    });
  }
});

exports.ReceiveDeleteFolderRequest = catchAsync(async (req, res, next) => {
  const filename = req.body.filename || '7ZXNZYOHls';
  const videoFolderPath = 'videos/' + filename;
  const url = req.body.url || 'http://localhost';
  const port = req.body.port || '';
  if (!fs.existsSync(videoFolderPath)) {
    console.log('not found path');
    res.status(201).json({
      message: 'path not found on ' + url + port + ' path: ' + videoFolderPath,
    });
  } else {
    console.log('found path, deleting...');

    const fileList = fs.readdirSync(videoFolderPath);
    console.log(fileList);
    for (let i = 0; i < fileList.length; i++) {
      const videoPath = videoFolderPath + '/' + fileList[i];
      console.log(videoPath);
      fs.unlinkSync(videoPath);
    }
    fs.rmdir(videoFolderPath, () => {
      console.log('Folder Deleted!');
    });

    res.status(201).json({
      message: 'path deleted on ' + url + port + ' path: ' + videoFolderPath,
    });
  }
});
