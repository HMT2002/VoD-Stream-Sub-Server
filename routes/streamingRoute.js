const express = require('express');
const fs = require('fs');
const streamingController = require('../controllers/streamingController.js');

const {
  upload,
  uploadVideo,
  uploadImage,
  uploadMultipartFile,
  uploadMultipartFileChunk,
} = require('../modules/multerAPI.js');
const router = express.Router();
const tempHls = fs.readFileSync('./public/client.html', 'utf-8');

//ROUTE HANDLER
router.route('/stop-streaming/:token').get((req, res, next) => {
  console.log('Request URL:', req.originalUrl + ' -> ');
  next();
}, streamingController.StopStreaming);
router.route('/add-streaming/:token').get((req, res, next) => {
  console.log('Request URL:', req.originalUrl + ' -> ');
  next();
}, streamingController.AddStreaming);

module.exports = router;
