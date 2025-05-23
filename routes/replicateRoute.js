const express = require('express');
const replicateController = require('../controllers/replicateController');

const {
  upload,
  uploadVideo,
  uploadImage,
  uploadMultipartFile,
  uploadMultipartFileChunk,
  uploadFolderFile,
  uploadIndividualFile,
} = require('../modules/multerAPI.js');
const router = express.Router();

//ROUTE HANDLER
router
  .route('/receive')
  .post(replicateController.checkFileOnReceiving, uploadMultipartFileChunk, replicateController.receiveVideoFile);
// cái bên trên được truyền vào headers như này
// {
//     chunkname: 'FfbiDN9_0', ext: 'mp4'
// }
// body json thì như này
// {
//     "chunknames":["FfbiDN9_0","FfbiDN9_1","FfbiDN9_2","FfbiDN9_3"],
//     "filename":"largetest4.mp4"
// }
router.route('/send').post(replicateController.SendFileToOtherNode);
// cái trên truyền vào body json như này
// {
//     "filename":"2wR6bkUHls",
//     "url":"http://localhost",
//     "port":":9100"
// }
router.route('/concate').post(replicateController.ConcateRequest);
router.route('/concate-hls').post(replicateController.ConcateAndEncodeToHlsRequest);
router.route('/concate-dash').post(replicateController.ConcateAndEncodeToDashRequest);
// cái trên thì truyền vào tương tự /receive nhưng không cần headers
// {
//     "chunknames":["FfbiDN9_0","FfbiDN9_1","FfbiDN9_2","FfbiDN9_3"],
//     "filename":"largetest4.mp4"
//   }

//#region IMPORTANT: 2 route for receiving and send replicate dash video
router
  .route('/receive-folder')
  .post(replicateController.checkFolderOnReceiving, uploadFolderFile, replicateController.receiveReplicateDashVideo);
router.route('/send-folder').post(replicateController.sendVideoForReplication);
//#endregion

router
  .route('/receive-file')
  .post(
    replicateController.checkFileOnReceiving,
    uploadIndividualFile,
    replicateController.ReceiveIndividualFileFromOtherNode
  );
router.route('/send-file').post(replicateController.SendIndIndividualFileToOtherNode);

module.exports = router;
