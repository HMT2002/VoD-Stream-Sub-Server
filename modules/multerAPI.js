const multer = require('multer');
const fs = require('fs');
const helperAPI = require('./helperAPI');

const defaultStoragePath = 'resources-storage/uploads/';
const videoStoragePath = 'videos/';
const videoChunkStoragePath = 'videos/';

const storage = multer.diskStorage({
  destination: defaultStoragePath,
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const storageVideo = multer.diskStorage({
  destination: videoStoragePath,
  filename: (req, file, cb) => {
    const fileID = helperAPI.GenerrateRandomString(7);
    const ext = file.originalname.split('.')[1];

    cb(null, fileID + '.' + ext);
  },
});

const storageChunk = multer.diskStorage({
  destination: videoStoragePath,
  filename: (req, file, cb) => {
    cb(null, req.headers.chunkname);
  },
});

const storageChunkV2 = multer.diskStorage({
  destination: videoStoragePath,
});

const storageFolderFile = multer.diskStorage({
  destination: (req, file, cb) => {
    const videoFolder = videoStoragePath + '/' + req.headers.folder;
    if (!fs.existsSync(videoFolder)) {
      fs.mkdirSync(videoFolder);
    }
    cb(null, videoFolder);
  },
  filename: (req, file, cb) => {
    cb(null, req.headers.filename);
  },
});

const storageIndividualFile = multer.diskStorage({
  destination: (req, file, cb) => {
    const videoFolder = videoStoragePath + '/';
    if (!fs.existsSync(videoFolder)) {
      fs.mkdirSync(videoFolder);
    }
    cb(null, videoFolder);
  },
  filename: (req, file, cb) => {
    cb(null, req.headers.filename);
  },
});

const multipartMaxSize = 35 * 1024 * 1024; //35mb
const folderFileMaxSize = 30 * 1024 * 1024; //30mb
const individualFileMaxSize = 10 * 1024 * 1024; //10mb

const maxSize = 300 * 1024 * 1024; //300mb
const maxSizeVideo = 300 * 1024 * 1024; //300mb
const maxSizeImage = 15 * 1024 * 1024; //15mb

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype == 'image/png' ||
      file.mimetype == 'image/jpg' ||
      file.mimetype == 'image/jpeg' ||
      file.mimetype == 'video/mp4' ||
      file.mimetype == 'video/mkv' ||
      file.mimetype == 'image/gif' ||
      file.mimetype == 'video/x-msvideo'
    ) {
      cb(null, true);
    } else {
      cb(null, false);
      return cb(new Error('Only .png, .jpg, .jpeg, .gif, .mkv, .avi format allowed!'));
    }
  },
  limits: { fileSize: maxSize },
}).single('myFile');

const uploadFile = multer({
  storage: storage,
  limits: { fileSize: maxSize },
}).single('myFile');

const uploadMultipartFile = multer({
  storage: storage,
  limits: { fileSize: multipartMaxSize },
}).single('myMultilPartFile');

const uploadMultipartFileChunk = multer({
  storage: storageChunk,
  limits: { fileSize: multipartMaxSize },
}).single('myMultilPartFileChunk');

const uploadMultipartFileChunkV2 = multer({
  storage: storageChunkV2,
  limits: { fileSize: multipartMaxSize },
}).single('myMultilPartFileChunk');

const uploadFolderFile = multer({
  storage: storageFolderFile,
  limits: { fileSize: folderFileMaxSize },
}).single('myFolderFile');

const uploadIndividualFile = multer({
  storage: storageIndividualFile,
  limits: { fileSize: individualFileMaxSize },
}).single('myIndividualFile');

const uploadArrayFile = multer({
  storage: storage,
  limits: { fileSize: maxSize },
}).any('myFiles', 10);

// var Upload = upload.any([{ name: 'TenFieldsORouteVaHbsPhaiGiongNhau' }]);

const uploadVideo = multer({
  storage: storageVideo,
  fileFilter: (req, file, cb) => {
    if (file.mimetype == 'video/mp4' || file.mimetype == 'video/mkv' || file.mimetype == 'video/x-msvideo') {
      cb(null, true);
    } else {
      cb(null, false);
      return cb(new Error('Only .mkv, .avi format allowed!'));
    }
  },
  limits: { fileSize: maxSizeVideo },
}).single('myFile');

const uploadArrayVideo = multer({
  storage: storageVideo,
  fileFilter: (req, file, cb) => {
    if (file.mimetype == 'video/mp4' || file.mimetype == 'video/mkv' || file.mimetype == 'video/x-msvideo') {
      cb(null, true);
    } else {
      cb(null, false);
      return cb(new Error('Only .mkv, .avi format allowed!'));
    }
  },
  limits: { fileSize: maxSizeVideo },
}).array('myFiles', 5);

const uploadImage = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype == 'image/png' || file.mimetype == 'image/jpg' || file.mimetype == 'image/jpeg') {
      cb(null, true);
    } else {
      cb(null, false);
      return cb(new Error('Only .png, .jpg, .jpeg format allowed!'));
    }
  },
  limits: { fileSize: maxSizeImage },
}).single('myFile');

const uploadArrayImage = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype == 'image/png' || file.mimetype == 'image/jpg' || file.mimetype == 'image/jpeg') {
      cb(null, true);
    } else {
      cb(null, false);
      return cb(new Error('Only .png, .jpg, .jpeg format allowed!'));
    }
  },
  limits: { fileSize: maxSizeImage },
}).array('myFiles', 10);

module.exports = {
  upload,
  uploadVideo,
  uploadImage,
  uploadArrayFile,
  uploadFile,
  uploadArrayImage,
  uploadArrayVideo,
  uploadMultipartFile,
  uploadMultipartFileChunk,
  uploadFolderFile,
  uploadMultipartFileChunkV2,
  uploadIndividualFile,
};
