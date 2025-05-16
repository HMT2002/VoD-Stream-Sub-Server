const fs = require('fs');
const path = require('path');
const helperAPI = require('../modules/helperAPI');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const APIFeatures = require('../utils/apiFeatures');
var FormData = require('form-data');
const axios = require('axios');

exports.CheckFileRequest = catchAsync(async (req, res, next) => {
  const filename = req.params.filename || 'NoExist';
  const filePath = 'videos/' + filename;
  if (!fs.existsSync(filePath)) {
    console.log('not found file');
    res.status(201).json({
      message: 'file not found on path: ' + filePath,
      existed: false,
    });
    return;
  } else {
    res.status(201).json({
      message: 'file existed on path: ' + filePath,
      existed: true,
    });
  }
});

exports.CheckFolderRequest = catchAsync(async (req, res, next) => {
  const folder = req.params.folder || 'NoExist';
  const folderPath = 'videos/' + folder;
  if (!fs.existsSync(folderPath)) {
    console.log('not found folder');
    res.status(201).json({
      message: 'folder not found on path: ' + folderPath,
      existed: false,
    });
    return;
  } else {
    res.status(201).json({
      message: 'folder existed on path: ' + folderPath,
      existed: true,
    });
  }
});

exports.CheckIfThisServerIsFckingAlive = (req, res, next, value) => {
  console.log('Check alive');
  const host = req.get('host');
  const fullURL = req.protocol + '://' + host + req.originalUrl;
  console.log(fullURL);
  res.status(200).json({
    status: 'alive',
    message: 'This server is alive',
    alive: true,
    fullURL,
  });
};
