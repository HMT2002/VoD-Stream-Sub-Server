const express = require('express');
const checkController = require('../controllers/checkController');
const testController = require('../controllers/testController');

const router = express.Router();

//ROUTE HANDLER
router.route('/file/:filename').get(checkController.CheckFileRequest);
router.route('/folder/:folder').get(checkController.CheckFolderRequest);
router.route('/is-this-fucking-alive').get(checkController.CheckIfThisServerIsFckingAlive);


module.exports = router;
