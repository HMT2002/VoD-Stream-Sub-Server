const fs = require('fs');
const jwt = require('jsonwebtoken');
const helperAPI = require('../modules/helperAPI');

const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const APIFeatures = require('../utils/apiFeatures');
const blacklist = require('../globals/blacklist');
const DASHSessionEnd = require('../models/mongo/DASHSessionEnd');

exports.StopStreaming = catchAsync(async (req, res, next) => {
  console.log('streamingController.StopStreaming -> ');
  console.log(req.params);
  let JWTPacket = req.params.token;
  let decoded = null;
  try {
    decoded = helperAPI.DecodeToken(JWTPacket);
  } catch (e) {
    helperAPI.EnhaceConsoleLogType(e, 'ERR');
  } finally {
    if (decoded === null) {
      helperAPI.EnhaceConsoleLogType('decoded null!', 'NOTI');
      res.status(500).json({
        status: 500,
        data: 'Streaming not found!',
      });
      return;
    }
  }
  blacklist.AddToBlacklist(decoded);
  res.status(200).json({
    status: 200,
    data: 'Streaming stopped!',
  });
});
exports.AddStreaming = catchAsync(async (req, res, next) => {
  console.log('streamingController.StopStreaming -> ');
  console.log(req.params);
  let JWTPacket = req.params.token;
  let decoded = null;
  try {
    decoded = helperAPI.DecodeToken(JWTPacket);
  } catch (e) {
    helperAPI.EnhaceConsoleLogType(e, 'ERR');
  } finally {
    if (decoded === null) {
      helperAPI.EnhaceConsoleLogType('decoded null!', 'NOTI');
      res.status(500).json({
        status: 500,
        data: 'Streaming not found!',
      });
      return;
    }
  }
  blacklist.RemoveFromBlacklist(decoded);
  res.status(200).json({
    status: 200,
    data: 'Streaming continued!',
  });
});
