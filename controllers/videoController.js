const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');
const helperAPI = require('../modules/helperAPI');
const firebaseAPI = require('../modules/firebaseAPI');

const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');
const APIFeatures = require('./../utils/apiFeatures');
const blacklist = require('../globals/blacklist');

const { exec, execFileSync, spawn } = require('child_process');

const fluentFfmpeg = require('fluent-ffmpeg');
const DASHSessionEnd = require('../models/mongo/DASHSessionEnd');
const { decode } = require('punycode');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
fluentFfmpeg.setFfmpegPath(ffmpegPath);

exports.UploadNewFileDrive = catchAsync(async (req, res, next) => {
  //console.log(req);
  const file = req.file;
  // console.log(file);
  const fileID = helperAPI.GenerrateRandomString(15);
  const fileExtension = path.extname(file.path);
  // console.log(fileExtension);
  const driveFileName = fileID + fileExtension;
  // console.log(driveFileName);
  const GoogleDriveAPIFolerID = '1vb2ZGYvrqsz7Rrw3WErV91YxxpeL3Sxh';
  const videoMetaData = {
    name: driveFileName,
    parents: [GoogleDriveAPIFolerID],
  };
  const videoMedia = {
    mimeType: file.mimetype,
    body: fs.createReadStream(file.path),
  };
  const driveAPIResponse = await driveAPI(videoMetaData, videoMedia);
  const driveID = driveAPIResponse.data.id;
  if (driveAPIResponse.data.id !== 'unavailable') {
    fs.unlink(file.path, (err) => {
      if (err) {
        console.log(err);
      } else {
        console.log('deleted file');
      }
    });
  }

  console.log(driveID);
  res.status(201).json({
    status: 'success upload',
    driveID: driveID,
  });
});

exports.UploadNewFileFirebase = catchAsync(async (req, res, next) => {
  //console.log(req);
  const file = req.file;

  // console.log(file);
  const fileID = helperAPI.GenerrateRandomString(15);

  const fileExtension = path.extname(file.path);
  // console.log(fileExtension);

  const metadata = {
    contentType: file.mimetype,
  };
  const filebuffer = fs.readFileSync(file.path);
  console.log(filebuffer);

  const firebaseDownloadUrl = await firebaseAPI(file, filebuffer);
  console.log(firebaseDownloadUrl);
  fs.unlink(file.path, function (err) {
    if (err) throw err;
    console.log('File deleted!');
  });
  res.status(200).json({
    status: 'test',
    firebaseDownloadUrl,
  });
});

exports.ASSHandler = catchAsync(async (req, res, next) => {
  console.log('ass is here');
  console.log(req.url);
  console.log(__dirname);

  if (fs.existsSync('./' + req.url)) {
    console.log('ass is exist');
    // console.log(req.headers)
    const stream = fs.createReadStream('./' + req.url);
    res.writeHead(206);
    stream.pipe(res);
  } else {
    console.log('ass is not exist');
    res.status(500).json({
      status: 500,
      message: 'Ass is not exist! ' + req.url,
      path: req.url,
    });
  }
});

exports.SRTHandler = catchAsync(async (req, res, next) => {
  console.log('srt is here');
  console.log(req.url);
  console.log(__dirname);

  // console.log(req);
  if (fs.existsSync('./' + req.url)) {
    console.log('srt is exist');
    const stream = fs.createReadStream('./' + req.url);
    res.writeHead(206);
    stream.pipe(res);
  } else {
    console.log('srt is not exist');
    res.status(500).json({
      status: 500,
      message: 'Srt is not exist! ' + req.url,
      path: req.url,
    });
  }
});

exports.VTTHandler = catchAsync(async (req, res, next) => {
  console.log('vtt is here');
  console.log(req.url);
  console.log(__dirname);

  // console.log(req);
  if (fs.existsSync('./' + req.url)) {
    console.log('vtt is exist');
    const stream = fs.createReadStream('./' + req.url);
    res.writeHead(206);
    stream.pipe(res);
  } else {
    console.log('vtt is not exist');
    res.status(500).json({
      status: 500,
      message: 'Vtt is not exist! ' + req.url,
      path: req.url,
    });
  }
});

exports.MP4Handler = catchAsync(async (req, res, next) => {
  // Ensure there is a range given for the video
  const range = req.headers.range;
  if (!range) {
    res.status(400).send('Requires Range header');
  }
  console.log(req.headers);
  if (!range) {
    res.status(400).json({
      status: 'failed',
    });
    return;
  }
  const videoPath = './' + req.url;
  const videoSize = fs.statSync(videoPath).size;
  console.log(videoSize);

  // Parse Range
  // Example: "bytes=32324-"
  const CHUNK_SIZE = 10 ** 6; // 1MB nên để tầm nhiêu đây thôi, chunk size cao hơn dễ bị lỗi
  const start = Number(range.replace(/\D/g, ''));
  const end = Math.min(start + CHUNK_SIZE, videoSize - 1);

  // Create headers
  const contentLength = end - start + 1;
  const headers = {
    'Content-Range': `bytes ${start}-${end}/${videoSize}`,
    'Accept-Ranges': 'bytes',
    'Content-Length': contentLength,
    'Content-Type': 'video/mp4',
  };

  // HTTP Status 206 for Partial Content
  res.writeHead(206, headers);

  // create video read stream for this particular chunk
  const videoStream = fs.createReadStream(videoPath, { start, end });

  // Stream the video chunk to the client
  videoStream.pipe(res);
});

exports.MP4MPDHandler = catchAsync(async (req, res, next) => {
  // Ensure there is a range given for the video
  const range = req.headers.range;
  if (!range) {
    res.status(400).send('Requires Range header');
  }
  console.log(req.headers);
  if (!range) {
    res.status(400).json({
      status: 'failed',
    });
    return;
  }
  const videoPath = './' + req.url;
  const videoSize = fs.statSync(videoPath).size;
  console.log(videoSize);
  // Parse Range
  // Example: "bytes=32324-"
  const CHUNK_SIZE = 10 ** 6; // 1MB nên để tầm nhiêu đây thôi, chunk size cao hơn dễ bị lỗi
  const start = Number(range.replace(/\D/g, ''));
  console.log('start');
  console.log(start);
  const end = Math.min(start + CHUNK_SIZE, videoSize - 1);
  console.log('end');
  console.log(end);

  console.log(req.range());

  if (req.range() !== -1) {
    console.log('req.range');
    console.log(req.range()[0]);
    console.log(range);
    // Create headers
    const contentLength = req.range()[0].end - req.range()[0].start + 1;
    console.log('contentLength');
    console.log(contentLength);
    const headers = {
      'Content-Range': range + '/' + videoSize,
      'Accept-Ranges': 'bytes',
      'Content-Length': contentLength,
      'Content-Type': 'video/mp4',
    };

    // HTTP Status 206 for Partial Content
    res.writeHead(206, headers);

    // create video read stream for this particular chunk
    const videoStream = fs.createReadStream(videoPath, { start: req.range()[0].start, end: req.range()[0].end });
    // const videoStream = fs.createReadStream(videoPath);

    // Stream the video chunk to the client
    videoStream.pipe(res);
  } else {
    // Create headers
    const contentLength = end - start + 1;
    const headers = {
      'Content-Range': `bytes ${start}-${end}/${videoSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': contentLength,
      'Content-Type': 'video/mp4',
    };
    // HTTP Status 206 for Partial Content
    res.writeHead(206, headers);
    // create video read stream for this particular chunk
    const videoStream = fs.createReadStream(videoPath, { start, end });
    // Stream the video chunk to the client
    videoStream.pipe(res);
  }
});

exports.MPDHandler = catchAsync(async (req, res, next) => {
  console.log('mpd is here');
  console.log(req.url);

  if (fs.existsSync('./' + req.url)) {
    console.log('mpd is exist');
    const stream = fs.createReadStream('./' + req.url);
    // res.writeHead(206);
    // Không nên để m4s header status code là 206 vì có thể không chơi được trên VLC hoặc mpv trên android
    res.setHeader('Content-Type', 'application/dash+xml');
    res.statusCode = 200;
    stream.pipe(res);
  } else {
    console.log('mpd is not exist');
    res.end();
    return;
  }
});
exports.M4SHandler = catchAsync(async (req, res, next) => {
  console.log('m4s is here');
  console.log(req.url);
  if (fs.existsSync('./' + req.url)) {
    console.log('m4s is exist');
    const stream = fs.createReadStream('./' + req.url);
    // res.writeHead(206);
    // Không nên để m4s header status code là 206 vì có thể không chơi được trên VLC hoặc mpv trên android
    res.setHeader('Content-Type', 'video/iso.segment');
    res.statusCode = 200;
    stream.pipe(res);
  } else {
    console.log('m4s is not exist');
    res.end();
    return;
  }
});

exports.M3u8Handler = catchAsync(async (req, res, next) => {
  console.log('m3u8 is here');
  console.log(req.url);
  console.log(__dirname);

  // console.log(req);
  if (fs.existsSync('./' + req.url)) {
    console.log('m3u8 is exist');
    const stream = fs.createReadStream('./' + req.url);
    res.writeHead(206);
    stream.pipe(res);
  } else {
    console.log('m3u8 is not exist');
    res.status(500).json({
      status: 500,
      message: 'M3u8 is not exist! ' + req.url,
      path: req.url,
    });
  }
});

exports.TsHandler = catchAsync(async (req, res, next) => {
  console.log('ts is here');
  console.log(req.url);
  console.log(__dirname);

  // console.log(req);
  if (fs.existsSync('./' + req.url)) {
    console.log('rs is exist');
    const stream = fs.createReadStream('./' + req.url);
    res.writeHead(206);
    stream.pipe(res);
  } else {
    console.log('rs is not exist');
    res.status(500).json({
      status: 500,
      message: 'Ts is not exist! ' + req.url,
      path: req.url,
    });
  }
});

exports.GetVideoThumbnail = catchAsync(async (req, res, next) => {
  //console.log(req);
  const file = req.file;
  //console.log(file);
  const filePath = file.path;
  const destination = file.destination;
  const fileFolder = file.filename.split('.')[0];
  const ext = file.originalname.split('.')[1];
  const pictureID = helperAPI.GenerrateRandomString(7);
  fs.access(destination + fileFolder, (error) => {
    // To check if the given directory
    // already exists or not
    if (error) {
      // If current directory does not exist
      // then create it
      fs.mkdir(destination + fileFolder, (error) => {
        if (error) {
          console.log(error);
        } else {
          console.log('New Directory created successfully !!');
        }
      });
    } else {
      console.log('Given Directory already exists !!');
    }
  });
  console.log(file);
  console.log('Do ffmpeg shit');

  //#region old code
  // fluentFfmpeg(filePath)
  //   .on(
  //     'filenames',
  //     catchAsync(async (filenames) => {
  //       console.log('screenshots are ' + filenames.join(', '));
  //     })
  //   )
  //   .screenshots({
  //     timestamps: [helperAPI.GenerrateRandomNumberBetween(4, 9)],
  //     filename: 'thumbnail_' + pictureID + '.png',
  //     folder: 'resources-storage/uploads/',
  //     size: '320x240',
  //   })
  //   .on('end', async function () {
  //     console.log('Screenshots taken');
  //     const filename = 'resources-storage/uploads/thumbnail_' + pictureID + '.png';
  //     if (fs.existsSync(filename)) {
  //       console.log('yuyuko exist');
  //       console.log(filename);
  //       const photo = await imgurAPI({ image: fs.createReadStream(filename), type: 'stream' });

  //       req.thumbnail = photo.link || 'https://i.imgur.com/13KYZfX.jpg';

  //       fs.unlinkSync(filename, (err) => {
  //         if (err) {
  //           console.log(err);
  //         } else {
  //           console.log('thumbnail deleted!');
  //         }
  //       });
  //     } else {
  //       console.log('yuyuko is not exist');
  //       req.thumbnail = 'https://i.imgur.com/13KYZfX.jpg';
  //     }
  //     next();
  //   })
  //   .on('error', function (err) {
  //     console.error(err);
  //     req.thumbnail = 'https://i.imgur.com/13KYZfX.jpg';
  //     next();
  //   });

  //#endregion

  await fluentFfmpeg(filePath)
    .on('end', async function () {
      console.log('Screenshots scans taken');

      await fluentFfmpeg(filePath)
        .on(
          'filenames',
          catchAsync(async (filenames) => {
            console.log('screenshots are ' + filenames.join(', '));
          })
        )
        .screenshots({
          timestamps: [helperAPI.GenerrateRandomNumberBetween(4, 9)],
          filename: 'thumbnail_' + fileFolder + '.png',
          folder: destination,
          size: '900x600',
        })
        .on('end', async function () {
          console.log('Thumbnail taken');
          next();
        });
    })
    .output(destination + fileFolder + '/scans-%04d.png')
    .outputOptions('-vf', 'fps=1/8')
    .run();
});

exports.VideoStreamingFile = catchAsync(async (req, res, next) => {
  // Ensure there is a range given for the video
  const range = req.headers.range;
  if (!range) {
    res.status(400).send('Requires Range header');
  }
  console.log(req.headers);
  if (!range) {
    res.status(400).json({
      status: 'failed',
    });
    return;
  }
  const videoPath = 'videos/' + req.params.filename + '.mp4';
  const videoSize = fs.statSync(videoPath).size;
  console.log(videoSize);

  // Parse Range
  // Example: "bytes=32324-"
  const CHUNK_SIZE = 10 ** 6; // 1MB nên để tầm nhiêu đây thôi, chunk size cao hơn dễ bị lỗi
  const start = Number(range.replace(/\D/g, ''));
  const end = Math.min(start + CHUNK_SIZE, videoSize - 1);

  // Create headers
  const contentLength = end - start + 1;
  const headers = {
    'Content-Range': `bytes ${start}-${end}/${videoSize}`,
    'Accept-Ranges': 'bytes',
    'Content-Length': contentLength,
    'Content-Type': 'video/mp4',
  };

  // HTTP Status 206 for Partial Content
  res.writeHead(206, headers);

  // create video read stream for this particular chunk
  const videoStream = fs.createReadStream(videoPath, { start, end });

  // Stream the video chunk to the client
  videoStream.pipe(res);
});

exports.VideoStreamingHLS = catchAsync(async (req, res, next) => {
  var filename = req.params.filename.split('.')[0];
  var ext = req.params.filename.split('.')[1];
  if (!fs.existsSync('videos/convert/outputm3u8_' + filename + '.m3u8')) {
    if (!fs.existsSync('videos/' + req.params.filename)) {
      console.log('File not exist, please check name!: videos/' + req.params.filename);
      res.status(404).json({
        message: 'File not exist, please check name!: videos/' + req.params.filename,
      });
      return;
    }

    console.log('File not converted yet, start convert ...');

    fluentFfmpeg('videos/' + req.params.filename, { timeout: 432000 })
      .addOptions(['-profile:v baseline', '-level 3.0', '-start_number 0', '-hls_time 6', '-hls_list_size 0', '-f hls'])
      .output('videos/convert/' + filename + '.m3u8')
      .on('start', function () {})
      .on('end', function () {
        console.log('end ffmpeg');
        res.status(206).json({
          message: 'sucess' + 'videos/convert/outputm3u8_' + req.params.filename + '.m3u8',
        });
      })
      .on('progress', function (progress) {
        console.log('Processing: ' + progress.percent + '% done');
        console.log(progress);
      })
      .on('error', function (err, stdout, stderr) {
        if (err) {
          console.log(err.message);
          console.log('stdout:\n' + stdout);
          console.log('stderr:\n' + stderr);
          res.status(400).json({
            error: err,
          });
        }
      })
      .run();
  } else {
    console.log('File found, start streaming');
  }
  console.log('File found, start streaming');

  const range = req.headers.range;
  if (!range) {
    res.status(400).json({
      error: 'Requires Range header',
    });
  }

  const videoPath = 'videos/convert/' + filename + '.m3u8';
  const videoSize = fs.statSync(videoPath).size;
  console.log(videoSize);

  // const CHUNK_SIZE=20**6//1MB

  // const start=Number(range.replace(/\D/g,""));
  // const end=Math.min(start+CHUNK_SIZE,videoSize-1);

  // const contentLength=end-start+1;
  // const headers={
  //   'Content-Range':'bytes '+(start-end)/videoSize,
  //   'Accept-Ranges':'bytes',
  //   'Content-Length':contentLength,
  //   'Content-Type':'video/mp4',
  // };

  // res.writeHead(206, headers);
  // const videoStream = fs.createReadStream(videoPath, { start, end });
  // videoStream.pipe(res);

  res.status(206).json({
    status: 'done',
  });
});

exports.VideoTemplateHLSStreaming = catchAsync(async (req, res, next) => {
  var filename = req.params.filename.split('.')[0];
  req.filename = filename;
  var ext = req.params.filename.split('.')[1];
  if (!fs.existsSync('videos/convert/' + filename + '.m3u8')) {
    if (!fs.existsSync('videos/' + req.params.filename)) {
      console.log('File not exist, please check name!: videos/' + req.params.filename);
      next();
      return;
    }

    console.log('videos/convert/' + filename + '.m3u8');
    console.log('File not converted yet, start convert ...');

    await fluentFfmpeg('videos/' + req.params.filename, { timeout: 432000 })
      .addOptions(['-profile:v baseline', '-level 3.0', '-start_number 0', '-hls_time 6', '-hls_list_size 0', '-f hls'])
      .output('videos/convert/' + filename + '.m3u8')
      .on('start', function () {})
      .on('end', function () {
        console.log('end ffmpeg');
        next();
      })
      .on('progress', function (progress) {
        console.log('Processing: ' + progress.percent + '% done');
        console.log(progress);
      })
      .on('error', function (err, stdout, stderr) {
        if (err) {
          console.log(err.message);
          console.log('stdout:\n' + stdout);
          console.log('stderr:\n' + stderr);
          next();
        }
      })
      .run();
  } else {
    console.log('File found, start streaming');
  }

  next();
});

exports.VideoConverter = catchAsync(async (req, res, next) => {
  // exec('videos/ffmpeg_batch.bat', (error, stdout, stderr) => {
  //   if (error) {
  //     res.status(400).json({
  //       error: error,
  //     });
  //     return;
  //   }
  //   if (stdout) {
  //     res.status(400).json({
  //       info: stdout,
  //     });
  //     return;
  //   }
  //   if (stderr) {
  //     res.status(400).json({
  //       info: stderr,
  //     });
  //     return;
  //   }
  // });

  const filename = decodeURIComponent(req.params.filename);
  console.log('>>filename');
  console.log(filename);
  if (!fs.existsSync('videos/' + filename + '.mp4')) {
    console.log('File not found!: videos/' + filename + '.mp4');
    res.status(400).json({
      message: 'File not found! Video is not available ' + filename + '.mp4',
    });
    return;
  }

  //ưu tiên file nào có master trước
  if (fs.existsSync('videos/convert/' + filename + '_master.m3u8')) {
    console.log('File converted!: /videos/convert/' + filename);
    res.status(200).json({
      status: 'found and converted',
      message: 'File found and conveterd! ' + filename + '.m3u8',
      path: '/videos/convert/' + filename + '_master.m3u8',
    });
    return;
  }
  //sau đó mới tìm file không có master
  if (fs.existsSync('videos/convert/' + filename + '.m3u8')) {
    console.log('File converted!: /videos/convert/' + filename);
    res.status(200).json({
      status: 'found and converted',
      message: 'File found and conveterd! ' + filename + '.m3u8',
      path: '/videos/convert/' + filename + '.m3u8',
    });
    return;
  }

  // create embeded subtitle to hls
  // ưu tiên có sub ass trước
  // if(fs.existsSync('videos/' + filename + '.ass')){
  //   console.log('ass subtitle')

  //   fluentFfmpeg('videos/' + filename + '.mp4', { timeout: 432000 })
  //   .input('videos/' + filename + '.ass')
  //   .inputOptions(['-itsoffset 0.85'])
  //   .addOptions(['-c copy','-c:s webvtt', '-level 3.0', '-start_number 0', '-hls_time 10', '-hls_list_size 0', '-f hls'])
  //   .output('videos/convert/' + filename + '.m3u8')
  //   .on('start', function () {})
  //   .on('end', function () {
  //     console.log('end ffmpeg');
  //     res.status(206).json({
  //       message: 'sucess convert!',
  //       path: '/videos/convert/' + filename + '.m3u8',
  //     });
  //   })
  //   .on('progress', function (progress) {
  //     console.log('Processing: ' + progress.percent + '% done');
  //     console.log(progress);
  //   })
  //   .on('error', function (err, stdout, stderr) {
  //     if (err) {
  //       console.log(err.message);
  //       console.log('stdout:\n' + stdout);
  //       console.log('stderr:\n' + stderr);
  //       res.status(400).json({
  //         error: err,
  //       });
  //     }
  //   })
  //   .run();
  //   return;
  // }
  // //các tùy chỉnh cho file sub srt
  // if(fs.existsSync('videos/' + filename + '.srt')){
  //   console.log('srt subtitle')
  //   fluentFfmpeg('videos/' + filename + '.mp4', { timeout: 432000 })
  //   .input('videos/' + filename + '.srt')
  //   .inputOptions(['-itsoffset 0.85'])
  //   .addOptions(['-c copy','-c:s webvtt', '-level 3.0', '-start_number 0', '-hls_time 10', '-hls_list_size 0', '-f hls'])
  //   .output('videos/convert/' + filename + '.m3u8')
  //   .on('start', function () {})
  //   .on('end', function () {
  //     console.log('end ffmpeg');
  //     res.status(206).json({
  //       message: 'sucess convert!',
  //       path: '/videos/convert/' + filename + '.m3u8',
  //     });
  //   })
  //   .on('progress', function (progress) {
  //     console.log('Processing: ' + progress.percent + '% done');
  //     console.log(progress);
  //   })
  //   .on('error', function (err, stdout, stderr) {
  //     if (err) {
  //       console.log(err.message);
  //       console.log('stdout:\n' + stdout);
  //       console.log('stderr:\n' + stderr);
  //       res.status(400).json({
  //         error: err,
  //       });
  //     }
  //   })
  //   .run();
  //   return;
  // }

  fluentFfmpeg('videos/' + filename + '.mp4', { timeout: 432000 })
    .addOptions(['-profile:v baseline', '-level 3.0', '-start_number 0', '-hls_time 6', '-hls_list_size 0', '-f hls'])
    .output('videos/convert/' + filename + '.m3u8')
    .on('start', function () {})
    .on('end', function () {
      console.log('end ffmpeg');
      res.status(206).json({
        message: 'sucess convert!',
        path: '/videos/convert/' + filename + '.m3u8',
      });
    })
    .on('progress', function (progress) {
      console.log('Processing: ' + progress.percent + '% done');
      console.log(progress);
    })
    .on('error', function (err, stdout, stderr) {
      if (err) {
        console.log(err.message);
        console.log('stdout:\n' + stdout);
        console.log('stderr:\n' + stderr);
        res.status(400).json({
          error: err,
        });
      }
    })
    .run();
});
exports.VideoPlayOPTIONS = catchAsync(async (req, res, next) => {
  const filename = decodeURIComponent(req.params.filename);
  if (!fs.existsSync('videos/' + filename + '.mp4')) {
    console.log('File not found!: videos/' + filename + '.mp4');
    res.status(400).json({
      message: 'File not found! ' + filename + '.mp4',
    });
    return;
  }

  if (fs.existsSync('videos/convert/' + filename + '.m3u8')) {
    console.log('File converted!: /videos/convert/' + filename);
    const result = {
      status: 'found and converted',
      message: 'File found and conveterd! ' + filename + '.m3u8',
      path: '/videos/convert/' + filename + '.m3u8',
    };
    console.log(result);
    res.redirect('/videos/convert/' + filename + '.m3u8');
    return;
  }

  fluentFfmpeg('videos/' + filename + '.mp4', { timeout: 432000 })
    .addOptions(['-profile:v baseline', '-level 3.0', '-start_number 0', '-hls_time 6', '-hls_list_size 0', '-f hls'])
    .output('videos/convert/' + filename + '.m3u8')
    .on('start', function () {})
    .on('end', function () {
      console.log('end ffmpeg');
      const result = {
        message: 'sucess convert!',
        path: '/videos/convert/' + filename + '.m3u8',
      };
      console.log(result);
      res.redirect('/videos/convert/' + filename + '.m3u8');
    })
    .on('progress', function (progress) {
      console.log('Processing: ' + progress.percent + '% done');
      console.log(progress);
    })
    .on('error', function (err, stdout, stderr) {
      if (err) {
        console.log(err.message);
        console.log('stdout:\n' + stdout);
        console.log('stderr:\n' + stderr);
        res.status(400).json({
          error: err,
        });
      }
    })
    .run();
});

exports.UploadNewFile = async (req, res) => {
  //console.log(req);
  const file = req.file;

  // console.log(file);
  const fileID = helperAPI.GenerrateRandomString(15);

  const fileExtension = path.extname(file.path);
  // console.log(fileExtension);

  const driveFileName = fileID + fileExtension;
  // console.log(driveFileName);

  const GoogleDriveAPIFolerID = '1vb2ZGYvrqsz7Rrw3WErV91YxxpeL3Sxh';

  const videoMetaData = {
    name: driveFileName,
    parents: [GoogleDriveAPIFolerID],
  };
  const videoMedia = {
    mimeType: file.mimetype,
    body: fs.createReadStream(file.path),
  };

  const driveAPIResponse = await driveAPI(videoMetaData, videoMedia);

  const driveID = driveAPIResponse.data.id;
  fs.unlink(file.path, function (err) {
    if (err) throw err;
    console.log('File deleted!');
  });

  console.log(driveID);
  res.status(201).json({
    status: 'success upload',
    driveID: driveID,
  });
};

exports.UploadNewFileLarge = async (req, res) => {
  //console.log(req);
  const file = req.file;
  console.log(file);
  const fileExtension = path.extname(file.path);
  console.log(fileExtension);
  const videoMedia = {
    mimeType: file.mimetype,
    body: fs.createReadStream(file.path),
  };
  console.log(videoMedia);
  res.status(201).json({
    status: 'success upload',
    videoMedia,
  });
};

exports.UploadNewFileLargeMultilpart = catchAsync(async (req, res, next) => {
  console.log('use ' + req.method + ' UploadNewFileLargeMultilpart');
  console.log('Dealing with request');
  //console.log(req.headers);
  const file = req.file;
  console.log(file);
  const destination = req.file.destination;
  console.log(destination);
  //const fileExtension = path.extname(req.file.path);
  let arrayChunkName = req.body.arraychunkname.split(',');
  console.log(arrayChunkName);
  let flag = true;
  arrayChunkName.forEach((chunkName) => {
    if (!fs.existsSync(destination + chunkName)) {
      flag = false;
    }
  });
  let filename = req.body.filename;
  let chunkname = req.body.chunkname;
  if (flag) {
    console.log('file is completed');
    console.log(filename);
    res.status(201).json({
      message: 'success full upload',
      filename,
      destination,
      full: true,
    });
    return;
  }
  res.status(201).json({
    message: 'success upload chunk',
    chunkname,
    destination,
    full: false,
  });
});

exports.UploadNewFileLargeMultilpartConcatenate = catchAsync(async (req, res, next) => {
  console.log(req.body);
  console.log(req.headers);
  let arrayChunkName = req.body.arraychunkname;
  let filename = req.body.filename;
  let ext = req.body.ext;
  let destination = req.body.destination;
  console.log('file is completed, begin concat');
  arrayChunkName.forEach((chunkName) => {
    console.log(chunkName);
    console.log('begin append');
    console.log(destination);
    console.log('./' + destination + chunkName);
    const data = fs.readFileSync('./' + destination + chunkName);
    fs.appendFileSync('./' + destination + filename + '.' + ext, data);
    console.log('complete append');
    console.log('begin delete');
    fs.unlinkSync('./' + destination + chunkName);
    console.log('complete delete ' + chunkName);
  });
  console.log(filename);
  req.file = {
    path: destination + filename + '.' + ext,
    destination,
    filename: filename + '.' + ext,
  };
  // res.status(201).json({
  //   status: 'success concat',
  //   filename,
  // });
  next();
});

exports.UploadNewFileLargeGetVideoThumbnail = catchAsync(async (req, res, next) => {
  const file = req.file;
  const filePath = file.path;
  const destination = file.destination;
  const fileFolder = file.filename.split('.')[0];
  fs.access(destination + fileFolder, (error) => {
    // To check if the given directory
    // already exists or not
    if (error) {
      // If current directory does not exist
      // then create it
      fs.mkdir(destination + fileFolder, (error) => {
        if (error) {
          console.log(error);
        } else {
          console.log('New Directory created successfully !!');
        }
      });
    } else {
      console.log('Given Directory already exists !!');
    }
  });
  console.log(file);
  console.log('Do ffmpeg shit');

  await fluentFfmpeg(filePath)
    .on('end', async function () {
      console.log('Screenshots scans taken');

      await fluentFfmpeg(filePath)
        .on(
          'filenames',
          catchAsync(async (filenames) => {
            console.log('screenshots are ' + filenames.join(', '));
          })
        )
        .screenshots({
          timestamps: [helperAPI.GenerrateRandomNumberBetween(4, 9)],
          filename: 'thumbnail_' + fileFolder + '.png',
          folder: destination,
          size: '900x600',
        })
        .on('end', async function () {
          console.log('Thumbnail taken');
          res.status(201).json({
            status: 'success concat, get thumbnail',
            file,
          });
        });
    })
    .output(destination + fileFolder + '/scans-%04d.png')
    .outputOptions('-vf', 'fps=1/8')
    .run();
});

// exports.UploadNewFileLargeConvertToHls = catchAsync(async (req, res, next) => {
//   const file = req.file;
//   const filePath = file.path;
//   const destination = file.destination;
//   const filenameWithoutExt = file.filename.split('.')[0];
//   const outputFolder = destination + filenameWithoutExt + 'Hls';
//   const outputResult = outputFolder + '/' + filenameWithoutExt + '.m3u8';
//   fs.access(outputFolder, (error) => {
//     // To check if the given directory
//     // already exists or not
//     if (error) {
//       // If current directory does not exist
//       // then create it
//       fs.mkdir(outputFolder, (error) => {
//         if (error) {
//           console.log(error);
//         } else {
//           console.log('New Directory created successfully !!');
//         }
//       });
//     } else {
//       console.log('Given Directory already exists !!');
//     }
//   });
//   console.log(file);
//   console.log('Do ffmpeg shit');

//   // await fluentFfmpeg(filePath)
//   //   .on('end', async function () {
//   //     console.log('Hls Converted');

//   //     await fluentFfmpeg(filePath)
//   //       .on(
//   //         'filenames',
//   //         catchAsync(async (filenames) => {
//   //           console.log('Hls are ' + filenames.join(', '));
//   //         })
//   //       )
//   //       .on('end', async function () {
//   //         console.log('Hls Converted');
//   //  res.status(201).json({
//   //    status: 'success concat, convert to Hls',
//   //    file,
//   //  });       });
//   //   })
//   //   .output(outputFolder + '/scans-%04d.png')
//   //   .outputOptions('-vf', 'fps=1/8')
//   //   .run();

//   await new ffmpeg()
//     .addInput(filePath)
//     .outputOptions([
//       // '-map 0:v',
//       // '-map 0:v',
//       // '-map 0:a',
//       // '-map 0:a',
//       // '-s:v:0 426x240',
//       // '-c:v:0 libx264',
//       // '-b:v:0 400k',
//       // '-c:a:0 aac',
//       // '-b:a:0 64k',
//       // '-s:v:1 640x360',
//       // '-c:v:1 libx264',
//       // '-b:v:1 700k',
//       // '-c:a:1 aac',
//       // '-b:a:1 96k',
//       // //'-var_stream_map', '"v:0,a:0 v:1,a:1"',
//       // '-master_pl_name '+filenameWithoutExt+'_master.m3u8',
//       // '-f hls',
//       // '-max_muxing_queue_size 1024',
//       // '-hls_time 4',
//       // '-hls_playlist_type vod',
//       // '-hls_list_size 0',
//       // // '-hls_segment_filename ./videos/output/v%v/segment%03d.ts',

//       '-c:v copy',
//       '-c:a copy',
//       //'-var_stream_map', '"v:0,a:0 v:1,a:1"',
//       '-level 3.0',
//       '-start_number 0',
//       '-master_pl_name ' + filenameWithoutExt + '_master.m3u8',
//       '-f hls',
//       '-hls_list_size 0',
//       '-hls_time 10',
//       '-hls_playlist_type vod',
//       // '-hls_segment_filename ./videos/output/v%v/segment%03d.ts',
//     ])
//     .output(outputResult)
//     .on('start', function (commandLine) {
//       console.log('Spawned Ffmpeg with command: ' + commandLine);
//     })
//     .on('error', function (err, stdout, stderr) {
//       console.error('An error occurred: ' + err.message, err, stderr);
//     })
//     .on('progress', function (progress) {
//       console.log('Processing: ' + progress.percent + '% done');
//       console.log(progress);
//       /*percent = progress.percent;
//       res.write('<h1>' + percent + '</h1>');*/
//     })
//     .on('end', function (err, stdout, stderr) {
//       console.log('Finished processing!' /*, err, stdout, stderr*/);
//       fs.unlinkSync(filePath, function (err) {
//         if (err) throw err;
//         console.log(filePath + ' deleted!');
//       });
//       res.status(201).json({
//         status: 'success concat, convert to Hls',
//         path: outputResult,
//       });
//     })
//     .run();
// });

//eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzZWNyZXQiOiIxMjM0NTY3ODkwIiwidXJsIjoidmlkZW9zL3FCc0xtMDZEYXNoIn0.LGV05FLUhTh4etkEa10MLki-02dC4MW2Gd4FaTbt438
exports.MPDTokenHandler = catchAsync(async (req, res, next) => {
  console.log('videoController.MPDTokenHandler -> ');
  console.log(req.params);
  let JWTPacket = req.params.token;
  let requestURL = '';
  let decoded = null;
  let isMPDLegit = true;
  try {
    decoded = helperAPI.DecodeToken(JWTPacket);
    isMPDLegit = await checkJWTToken(decoded);
  } catch (e) {
    helperAPI.EnhaceConsoleLogType(e, 'ERR');
  } finally {
    if (decoded === null || !isMPDLegit) {
      helperAPI.EnhaceConsoleLogType('invalid request!', 'NOTI');
      res.end();
      return;
    }
    requestURL = decoded.url;
  }
  if (fs.existsSync('./' + requestURL)) {
    console.log('mpd token is exist');
    fs.readFile(requestURL + '/init.mpd', 'utf8', (err, data) => {
      if (err) {
        helperAPI.EnhaceConsoleLogType('MPD file not found!', 'NOTI');
        return res.status(404).send('MPD file not found');
      }

      // Parse the MPD XML
      const parser = new DOMParser();
      const serializer = new XMLSerializer();
      const xmlDoc = parser.parseFromString(data, 'text/xml');

      // Find all segment URLs (SegmentTemplate elements with media attributes)
      const segmentTemplates = xmlDoc.getElementsByTagName('SegmentTemplate');

      for (let i = 0; i < segmentTemplates.length; i++) {
        const segmentTemplate = segmentTemplates[i];
        if (segmentTemplate.hasAttribute('media')) {
          // Get the current media attribute
          const mediaPattern = segmentTemplate.getAttribute('media');

          // Modify to include the token
          // The path needs to be structured to include the token in your routing
          segmentTemplate.setAttribute('media', JWTPacket + `/${mediaPattern}`);
        }

        // Do the same for initialization segments if present
        if (segmentTemplate.hasAttribute('initialization')) {
          const initPattern = segmentTemplate.getAttribute('initialization');
          segmentTemplate.setAttribute('initialization', JWTPacket + `/${initPattern}`);
        }
      }

      // Serialize back to XML
      const modifiedMPD = serializer.serializeToString(xmlDoc);

      var stream = fs.createReadStream('./' + requestURL);
      stream = modifiedMPD;
      // res.writeHead(206);
      // Không nên để m4s header status code là 206 vì có thể không chơi được trên VLC hoặc mpv trên android
      res.setHeader('Content-Type', 'application/dash+xml');
      res.statusCode = 200;
      // stream.pipe(res);
      res.send(modifiedMPD);
    });
  } else {
    console.log('mpd token is not exist');
    res.end();
    return;
  }
});
exports.M4STokenHandler = catchAsync(async (req, res, next) => {
  console.log('videoController.M4STokenHandler -> ');
  console.log(req.params);

  let segment = req.params.segment;
  let JWTPacket = req.params.token;
  let requestURL = '';
  let decoded = null;
  let isM4SLegit = true;
  try {
    decoded = helperAPI.DecodeToken(JWTPacket);
    //kiểm tra token mỗi 5s
    // if (flagCheckM4SToken) {
    //   flagCheckM4SToken = false;
    //   isM4SLegit = await checkJWTToken(decoded);
    // }
    isM4SLegit = await checkJWTToken(decoded);
  } catch (e) {
    helperAPI.EnhaceConsoleLogType(e, 'ERR');
    decoded = null;
    isM4SLegit = false;
  } finally {
    if (decoded === null || !isM4SLegit) {
      // flagCheckM4SToken = false;
      helperAPI.EnhaceConsoleLogType('Session is invalid, shutting down!!', 'ERR');
      res.end();
      return;
    }
    requestURL = decoded.url;
  }

  if (fs.existsSync('./' + requestURL + '/' + segment + '.m4s')) {
    console.log('m4s token is exist');
    const stream = fs.createReadStream('./' + requestURL + '/' + segment + '.m4s');
    // res.writeHead(206);
    // Không nên để m4s header status code là 206 vì có thể không chơi được trên VLC hoặc mpv trên android
    res.setHeader('Content-Type', 'video/iso.segment');
    res.statusCode = 200;
    stream.pipe(res);
  } else {
    console.log('m4s token is not exist');
    res.end();
    return;
  }
});
const checkJWTToken = async (decoded) => {
  helperAPI.EnhaceConsoleLogType('checkJWTToken', 'NOTI');
  if (decoded === null) {
    return false;
  }
  console.log(decoded);
  var sessionID = decoded.sessionID;
  console.log(blacklist.blacklist);
  let indexOfSessionID = blacklist.blacklist.findIndex((e) => e.sessionID === sessionID);
  console.log(indexOfSessionID);
  if (indexOfSessionID > -1) {
    return false;
  }

  return true;
};
let flagCheckM4SToken = true;
// setInterval(function () {
//   // helperAPI.EnhaceConsoleLogType('interval VideoController', 'NOTI');
//   flagCheckM4SToken = true;
// }, 8000);
