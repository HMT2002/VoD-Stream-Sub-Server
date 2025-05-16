const express = require('express');
const uploadController = require('../controllers/uploadController.js');

const {
  upload,
  uploadVideo,
  uploadImage,
  uploadMultipartFile,
  uploadMultipartFileChunk,
  uploadFolderFile,
  uploadMultipartFileChunkV2,
  uploadIndividualFile,
} = require('../modules/multerAPI.js');
const router = express.Router();

//ROUTE HANDLER

router
  .route('/file')
  .post(
    uploadController.CheckFileBeforeReceive,
    uploadIndividualFile,
    uploadController.ReceiveIndividualFileFromOtherNode
  );

router.route('/test_command').post((req, res, next) => {
  console.log('Request URL:', req.originalUrl + ' - > uploadRouter -> ');
  next();
}, uploadController.TestEncodeCommand);

router.route('/').post(
  (req, res, next) => {
    console.log('Request URL:', req.originalUrl + ' - > uploadRouter -> ');
    next();
  },
  uploadController.CheckFileBeforeReceive,
  (req, res, next) => {
    console.log('uploadMultipartFileChunk -> ');
    next();
  },
  uploadMultipartFileChunk,
  uploadController.ReceiveFileFromOtherNode
);
module.exports = router;
