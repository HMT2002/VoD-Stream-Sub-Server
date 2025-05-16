const fs = require('fs');
const path = require('path');
const helperAPI = require('../modules/helperAPI');
const encodeAPI = require('../modules/encodeAPI');

const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');
const APIFeatures = require('./../utils/apiFeatures');
var FormData = require('form-data');
const axios = require('axios');
const fluentFfmpeg = require('fluent-ffmpeg');
const ffmpeg = require('fluent-ffmpeg');

const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
fluentFfmpeg.setFfmpegPath(ffmpegPath);
const { CONSTANTS } = require('../constants/constants');

async function concater(arrayChunkName, destination, filename, ext) {
  arrayChunkName.forEach((chunkName) => {
    const data = fs.readFileSync('./' + destination + chunkName);
    fs.appendFileSync('./' + destination + filename + '.' + ext, data);
    //fs.unlinkSync('./' + destination + chunkName);
  });
}

// async function encodeIntoHls(destination, originalname) {
//   console.log({ destination, originalname });
//   const filePath = destination + originalname;
//   const filenameWithoutExt = originalname.split('.')[0];
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
//   console.log('Do ffmpeg shit');

//   await new ffmpeg()
//     .addInput(filePath)
//     .outputOptions([
//       '-map 0:v',
//       '-map 0:a',
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

//       '-map 0:v:0 -map 0:a:0 -map 0:v:0 -map 0:a:0 -map 0:v:0 -map 0:a:0',
//       '-c:v libx265 -crf 22',
//       '-c:a aac -ar 44100',
//       '-filter:v:0 scale=w=480:h=360  -maxrate:v:0 600k -b:a:0 500k',
//       '-filter:v:1 scale=w=640:h=480  -maxrate:v:1 1500k -b:a:1 1000k',
//       '-filter:v:2 scale=w=1280:h=720 -maxrate:v:2 3000k -b:a:2 2000k',
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
//       // fs.unlinkSync(filePath, function (err) {
//       //   if (err) throw err;
//       //   console.log(filePath + ' deleted!');
//       // });
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
//     })
//     .run();
// }

// async function encodeIntoDash(destination, originalname) {
//   console.log({ destination, originalname });
//   const filePath = destination + originalname;
//   const filenameWithoutExt = originalname.split('.')[0];
//   const outputFolder = destination + filenameWithoutExt + 'Dash';
//   const outputResult = outputFolder + '/init.mpd';
//   fs.access(outputFolder, (error) => {
//     if (error) {
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
//   console.log('Do ffmpeg shit');

//   await new ffmpeg()
//     .addInput(filePath)
//     .outputOptions([
//       '-f dash',
//       '-preset veryfast',
//       '-use_timeline 1',
//       '-single_file 0',
//       '-use_template 1',
//       '-seg_duration 10',
//       // '-adaptation_sets "id=0,streams=v id=1,streams=a"',
//       '-init_seg_name init_$RepresentationID$.m4s',
//       '-media_seg_name chunk_$RepresentationID$_$Number%05d$.m4s',
//       // '-c:v copy',
//       '-c:a copy',
//       //'-var_stream_map', '"v:0,a:0 v:1,a:1"',
//       '-b:v:0 750k',
//       '-filter:v:0 scale=-2:480',
//       '-b:v:1 1000k',
//       '-filter:v:1 scale=-2:720',
//       '-b:v:2 1500k',
//       '-filter:v:2 scale=-2:1080',
//       // '-s:v:1 320x170',
//       '-bf 1',
//       '-keyint_min 120',
//       '-g 120',
//       '-sc_threshold 0',
//       '-b_strategy 0',
//       '-ar:a:1 22050',
//     ])
//     .outputOption('-adaptation_sets', 'id=0,streams=v id=1,streams=a')
//     .output(outputResult)
//     .on('start', function (commandLine) {
//       console.log('Spawned Ffmpeg with command: ' + commandLine);
//     })
//     .on('error', function (err, stdout, stderr) {
//       console.error('An error occurred: ' + err.message, err, stderr);
//       // fs.unlinkSync(filePath, function (err) {
//       //   if (err) throw err;
//       //   console.log(filePath + ' deleted!');
//       // });
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
//     })
//     .run();
// }

async function concaterServer(arrayChunkName, destination, originalname) {
  arrayChunkName.forEach((chunkName) => {
    try {
      const data = fs.readFileSync('./' + destination + chunkName);
      fs.appendFileSync('./' + destination + originalname, data);
      fs.unlinkSync('./' + destination + chunkName);
    } catch (err) {
      console.log(err);
    }
  });
}

exports.SendFileToOtherNode = catchAsync(async (req, res, next) => {
  const filename = req.body.filename || 'largetest.mp4';
  const videoPath = 'videos/' + filename;
  const url = req.body.url || 'http://localhost';
  const port = req.body.port || '';
  if (!fs.existsSync(videoPath)) {
    res.status(200).json({
      message: 'File not found',
      path: videoPath,
      url,
      port,
    });
    return;
  }

  const baseUrl = url + port + CONSTANTS.SUB_SERVER_CHECK_API + '/file/' + filename;
  console.log(baseUrl);
  const { data: check } = await axios.get(baseUrl);
  console.log(check);
  if (check.existed === true) {
    res.status(200).json({
      message: 'File already existed on sub server',
      check,
    });
    return;
  }

  console.log('File converted!: ' + videoPath);
  const videoSize = fs.statSync(videoPath).size;
  let chunkName = helperAPI.GenerrateRandomString(7);
  let arrayChunkName = [];
  const CHUNK_SIZE = 30 * 1024 * 1024; // 30MB
  const totalChunks = Math.ceil(videoSize / CHUNK_SIZE);
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    arrayChunkName.push(chunkName + '_' + chunkIndex);
  }
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    let start = chunkIndex * CHUNK_SIZE;
    let end = Math.min(start + CHUNK_SIZE, videoSize);
    const readStream = fs.createReadStream(videoPath, { start: start, end: end - 1 });
    var form = new FormData();
    form.append('myMultilPartFileChunk', readStream);
    form.append('arraychunkname', JSON.stringify(arrayChunkName));

    const { data: send } = await axios({
      method: 'post',
      url: url + port + CONSTANTS.SUB_SERVER_REPLICATE_API + '/receive',
      data: form,
      headers: { ...form.getHeaders(), chunkname: chunkName + chunkIndex, ext: filename.split('.')[1] },
    });
    console.log(send);
    if (send.message == CONSTANTS.ENOUGH_FOR_CONCATE_MESSAGE) {
      const { data: concate } = await axios({
        method: 'post',
        url: url + port + CONSTANTS.SUB_SERVER_REPLICATE_API + '/concate',
        data: {
          arraychunkname: arrayChunkName,
          filename: filename,
        },
      });
      console.log(concate);
    }
  }
  res.status(200).json({
    message: 'File found',
    path: videoPath,
  });
  return;
});

exports.CheckFileBeforeReceive = catchAsync(async (req, res, next) => {
  console.log('check file before receive');
  const videoPath = 'videos/' + req.body.filename;
  if (fs.existsSync(videoPath)) {
    res.status(200).json({
      message: 'File already existed on this server',
      path: videoPath,
      url,
      port,
    });
    return;
  }
  next();
});

exports.CheckFolderBeforeReceive = catchAsync(async (req, res, next) => {
  console.log('check folder before receive');
  const videoPath = 'videos/' + req.body.filename;
  if (fs.existsSync(videoPath)) {
    res.status(200).json({
      message: 'Folder already existed on this server',
      path: videoPath,
      url,
      port,
    });
    return;
  }
  next();
});

exports.ReceiveFileFromOtherNode = catchAsync(async (req, res, next) => {
  console.log('received');
  let arrayChunkName = JSON.parse(req.body.arraychunkname);
  let destination = req.file.destination;
  let flag = true;
  arrayChunkName.forEach((chunkName) => {
    if (!fs.existsSync(destination + chunkName)) {
      flag = false;
    }
  });
  if (flag) {
    console.log('enough');
    res.status(201).json({
      message: CONSTANTS.ENOUGH_FOR_CONCATE_MESSAGE,
    });
  } else {
    console.log('not enough');
    res.status(201).json({
      message: CONSTANTS.NOT_ENOUGH_FOR_CONCATE_MESSAGE,
    });
  }
});

exports.ConcateRequest = catchAsync(async (req, res, next) => {
  let arrayChunkName = req.body.arraychunkname;
  const originalname = req.body.filename;
  const destination = 'videos/';
  let flag = checkEnoughFile(arrayChunkName);
  if (flag) {
    concaterServer(arrayChunkName, destination, originalname);

    res.status(201).json({
      message: 'concated',
    });
    return;
  }
  res.status(201).json({
    message: 'still in development',
  });
});

const checkEnoughFile = async (arrayChunkName) => {
  const destination = 'videos/';
  arrayChunkName.forEach((chunkName) => {
    if (!fs.existsSync(destination + chunkName)) {
      return false;
    }
  });
  return true;
};

exports.ConcateAndEncodeToHlsRequest = catchAsync(async (req, res, next) => {
  let arrayChunkName = req.body.arraychunkname;
  const originalname = req.body.filename;
  const destination = 'videos/';
  let flag = checkEnoughFile(arrayChunkName);
  if (flag) {
    concaterServer(arrayChunkName, destination, originalname);
    encodeAPI.encodeIntoHls(destination, originalname);

    const filePath = destination + originalname;

    // fs.unlinkSync(filePath, function (err) {
    //   if (err) throw err;
    //   console.log(filePath + ' deleted!');
    // });

    res.status(201).json({
      message: 'concated',
    });
    return;
  }
  res.status(201).json({
    message: 'still in development',
  });
});

exports.ConcateAndEncodeToDashRequest = catchAsync(async (req, res, next) => {
  let arrayChunkName = req.body.arraychunkname;
  const originalname = req.body.filename;
  const destination = 'videos/';
  let flag = checkEnoughFile(arrayChunkName);
  if (flag) {
    concaterServer(arrayChunkName, destination, originalname);
    encodeAPI.encodeIntoDash(destination, originalname);

    const filePath = destination + originalname;

    // fs.unlinkSync(filePath, function (err) {
    //   if (err) throw err;
    //   console.log(filePath + ' deleted!');
    // });

    res.status(201).json({
      message: 'concated and convert to',
    });
    return;
  }
  res.status(201).json({
    message: 'not enough for concate',
  });
});

exports.SendFolderFileToOtherNode = catchAsync(async (req, res, next) => {
  console.log('replicate folder controller');
  const filename = req.body.filename || 'World Domination How-ToHls';
  const videoFolderPath = 'videos/' + filename + '/';
  const url = req.body.url || 'localhost';
  const port = req.body.port || '';

  const baseUrl = 'http://' + url + port + CONSTANTS.SUB_SERVER_CHECK_API + '/file/' + filename;
  console.log(baseUrl);
  const { data: check } = await axios.get(baseUrl);
  console.log(check);
  if (check.existed === true) {
    res.status(200).json({
      message: 'Folder already existed on sub server',
      check,
    });
    return;
  }

  if (!fs.existsSync(videoFolderPath)) {
    res.status(200).json({
      message: 'Folder not found',
      path: videoFolderPath,
    });
    return;
  }
  console.log('File found!: ' + videoFolderPath);
  const dir = 'videos/' + filename;
  console.log(dir);
  const fileList = fs.readdirSync(dir);
  console.log(fileList);
  for (let i = 0; i < fileList.length; i++) {
    const filePath = videoFolderPath + '/' + fileList[i];
    console.log(filePath);
    console.log(fs.existsSync(filePath));
    const readStream = fs.createReadStream(filePath);
    var form = new FormData();
    form.append('myFolderFile', readStream);
    const { data } = await axios({
      method: 'post',
      url: 'http://' + url + port + CONSTANTS.SUB_SERVER_REPLICATE_API + '/receive-folder',
      data: form,
      headers: { ...form.getHeaders(), filename: fileList[i], folder: filename },
    });
    console.log(data);
  }
  res.status(200).json({
    message: 'Folder sent!',
    videoFolderPath,
  });
  return;
});

exports.ReceiveFolderFileFromOtherNode = catchAsync(async (req, res, next) => {
  let destination = req.file.destination;
  res.status(200).json({
    message: 'success receive folder files',
    destination,
  });
});
exports.SendIndIndividualFileToOtherNode = catchAsync(async (req, res, next) => {
  console.log('replicate file controller');
  const filename = req.body.filename || '';
  const filePath = 'videos/' + filename;
  const url = req.body.url || 'localhost';
  const port = req.body.port || '';

  const baseUrl = 'http://' + url + port + CONSTANTS.SUB_SERVER_CHECK_API + '/file/' + filename;
  console.log(baseUrl);
  const { data: check } = await axios.get(baseUrl);
  console.log(check);
  if (check.existed === true) {
    res.status(200).json({
      message: 'File already existed on sub server',
      check,
    });
    return;
  }

  if (!fs.existsSync(filePath)) {
    res.status(200).json({
      message: 'File not found',
      path: filePath,
    });
    return;
  }
  console.log('File found!: ' + filePath);
  console.log(filePath);
  console.log(fs.existsSync(filePath));
  const readStream = fs.createReadStream(filePath);
  var form = new FormData();
  form.append('myIndividualFile', readStream);
  const { data } = await axios({
    method: 'post',
    url: 'http://' + url + port + CONSTANTS.SUB_SERVER_REPLICATE_API + '/receive-file',
    data: form,
    headers: { ...form.getHeaders(), filename: filename },
  });
  console.log(data);
  res.status(200).json({
    message: 'File sent!',
    filePath,
  });
  return;
});

exports.ReceiveIndividualFileFromOtherNode = catchAsync(async (req, res, next) => {
  let destination = req.file.destination;
  res.status(200).json({
    message: CONSTANTS.SUCCESS_RECEIVE_INDIVIDUAL_FILE,
    destination,
  });
});
