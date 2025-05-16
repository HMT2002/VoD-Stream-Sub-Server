const express = require('express');
const defaultController = require('../controllers/defaultController');

const router = express.Router();

//ROUTE HANDLER
router.route('/check/alive/is-this-alive').get(defaultController.CheckIfThisServerIsFckingAlive);
router.route('/check/hls/:filename').get(defaultController.CheckHlsFile);
router.route('/check/dash/:filename').get(defaultController.CheckDashFile);


// router.route('/check/hls/:filename').post(defaultController.CheckHlsFile);
// router.route('/check/dash/:filename').post(defaultController.CheckDashFile);

module.exports = router;
