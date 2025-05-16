const express = require('express');
const fs=require('fs');
const testController = require('../controllers/testController');
const { upload, uploadVideo, uploadImage,uploadMultipartFile ,uploadMultipartFileChunk} = require('../modules/multerAPI.js');
const router = express.Router();

//ROUTE HANDLER

router.route('/multipart-upload').post(uploadVideo, testController.UploadNewFile);


router.route('/upload-video').post(uploadVideo, testController.UploadNewFile);
router.route('/upload-video-large').post(uploadVideo, testController.UploadNewFileLarge);

router.route('/upload-video-large-multipart').post(uploadMultipartFileChunk, testController.UploadNewFileLargeMultilpart);
// router.route('/upload-video-large-multipart-concatenate').post( testController.UploadNewFileLargeMultilpartConcatenate,testController.UploadNewFileLargeGetVideoThumbnail);

router.route('/upload-video-large-multipart-concatenate').post( testController.UploadNewFileLargeMultilpartConcatenate,testController.UploadNewFileLargeConvertToHls);

router.route('/ffmpeg').post(testController.FFmpeg);
router.route('/video-stream-file/:filename').get(testController.VideoStreamingFile);
router.route('/video-stream-hls/:filename').get(testController.VideoStreamingHLS);
router.route('/video-proc/convert-stream/:filename').get(testController.VideoConverter);
router.route('/video-proc/OPTIONSVideoRequest/:filename').options(testController.VideoPlayOPTIONS);
module.exports = router;
