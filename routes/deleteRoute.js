const express = require('express');
const deleteController = require('../controllers/deleteController');

const { upload, uploadVideo, uploadImage,uploadMultipartFile ,uploadMultipartFileChunk} = require('../modules/multerAPI.js');
const router = express.Router();

//ROUTE HANDLER
router.route('/').post(deleteController.ReceiveDeleteRequest);
router.route('/folder').post(deleteController.ReceiveDeleteFolderRequest);


module.exports = router;
