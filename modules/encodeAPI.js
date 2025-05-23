const fs = require('fs');
const path = require('path');

const axios = require('axios');
const fluentFfmpeg = require('fluent-ffmpeg');
const ffmpeg = require('fluent-ffmpeg');
const Video = require('../models/mongo/Video');
const VideoStatus = require('../models/mongo/VideoStatus');
const Server = require('../models/mongo/Server');

//const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpegPath = '..\\ffmpeg.exe';
const { exec, spawn } = require('child_process');

fluentFfmpeg.setFfmpegPath(ffmpegPath);

const sizes = [
  [240, 350],
  [480, 700],
  [720, 2500],
];

const encodeCommand = (index, filePath, outputFolder, outputResult) => {
  let encodeCmd = '';
  switch (index) {
    case 0:
      encodeCmd =
        'ffmpeg -ss 10 -i ' +
        filePath +
        ' -qscale:v 2 -frames:v 1 ' +
        outputFolder +
        '/thumbnail.png ' +
        ' | ' +
        'ffmpeg -i ' +
        filePath +
        ' -c:v libx264' +
        ' -c:a aac -b:a 128k' +
        ' -preset veryfast' +
        ' -bf 1 -b_strategy 0 -sc_threshold 0 -pix_fmt yuv420p' +
        ' -map 0:v:0 -map 0:a:0 -map 0:v:0 -map 0:v:0 -map 0:v:0' +
        ' -b:v:0 300k -s:v:0 720x480 -profile:v:0 baseline' +
        ' -b:v:1 700k -s:v:1 1080x720 -profile:v:1 main' +
        ' -b:v:2 1300k -s:v:2 1920x1080 -profile:v:2 high' +
        ' -b:v:3 2500k -profile:v:3 high' +
        ' -f mpegts -' +
        ' | ' +
        'ffmpeg -i - ' +
        ' -map 0' +
        ' -use_timeline 1' +
        ' -single_file 0' +
        ' -use_template 1' +
        ' -adaptation_sets "id=0,streams=v id=1,streams=a"' +
        ' -init_seg_name init_$RepresentationID$.m4s' +
        ' -media_seg_name chunk_$RepresentationID$_$Number%05d$.m4s' +
        ' -f dash ' +
        outputResult;
      break;
    case 1:
      encodeCmd =
        'ffmpeg -ss 10 -i ' +
        filePath +
        ' -qscale:v 2 -frames:v 1 ' +
        outputFolder +
        '/thumbnail.png ' +
        ' | ' +
        'ffmpeg -i ' +
        filePath +
        ' -c:v hevc_nvenc' +
        ' -c:a aac -b:a 128k' +
        ' -preset 4' +
        ' -bf 1 -b_strategy 0 -sc_threshold 0 -pix_fmt yuv420p -preset p4 -rc vbr -threads 3' +
        ' -g 120 -keyint_min 120 -force_key_frames "expr:gte(t,n_forced*3)"' +
        ' -map 0:v:0 -map 0:a:0 -map 0:v:0 -map 0:v:0 -map 0:v:0' +
        ' -b:v:0 300k -s:v:0 720x480 -profile:v:0 1' +
        ' -b:v:1 700k -s:v:1 1080x720 -profile:v:1 1' +
        ' -b:v:2 1300k -s:v:2 1920x1080 -profile:v:2 2' +
        ' -b:v:3 2500k -profile:v:3 2' +
        ' -f mpegts -' +
        ' | ' +
        'ffmpeg -i - ' +
        ' -map 0' +
        ' -use_timeline 1' +
        ' -single_file 0' +
        ' -use_template 1' +
        ' -seg_duration 10' +
        ' -adaptation_sets "id=0,streams=v id=1,streams=a"' +
        ' -init_seg_name init_$RepresentationID$.m4s' +
        ' -media_seg_name chunk_$RepresentationID$_$Number%05d$.m4s' +
        ' -f dash ' +
        outputResult;
      break;
    case 2:
      encodeCmd =
        'ffmpeg -ss 10 -i ' +
        filePath +
        ' -qscale:v 2 -frames:v 1 ' +
        outputFolder +
        '/thumbnail.png ' +
        ' | ' +
        'ffmpeg -hwaccel cuda -i ' +
        filePath +
        ' -filter_complex "[0:v]split=4[v1][v2][v3][v4];[v1]scale=720x480[v1out];[v2]scale=1080x720[v2out];[v3]scale=1920x1080[v3out];[v4]copy[v4out]" ' +
        ' -map "[v1out]" -c:v:0 hevc_nvenc -b:v:0 300k  -rc vbr -preset p3 -bf 1 -b_strategy 0 -sc_threshold 0 -pix_fmt yuv420p -c:a:0 aac -b:a:0 128k' +
        ' -map "[v2out]" -c:v:1 hevc_nvenc -b:v:1 700k  -rc vbr -preset p3 -bf 1 -b_strategy 0 -sc_threshold 0 -pix_fmt yuv420p -c:a:1 aac -b:a:1 128k' +
        ' -map "[v3out]" -c:v:2 hevc_nvenc -b:v:2 1300k -rc vbr -preset p3 -bf 1 -b_strategy 0 -sc_threshold 0 -pix_fmt yuv420p -c:a:2 aac -b:a:2 128k' +
        ' -map "[v4out]" -map 0:a:0 -c:v:3 hevc_nvenc -b:v:3 2500k -rc vbr -preset p3 -bf 1 -b_strategy 0 -sc_threshold 0 -pix_fmt yuv420p -c:a:3 aac -b:a:3 128k' +
        ' -f mpegts -' +
        ' | ' +
        'ffmpeg -i - ' +
        ' -map 0' +
        ' -use_timeline 1' +
        ' -single_file 0' +
        ' -use_template 1' +
        ' -adaptation_sets "id=0,streams=v id=1,streams=a"' +
        ' -init_seg_name init_$RepresentationID$.m4s' +
        ' -media_seg_name chunk_$RepresentationID$_$Number%05d$.m4s' +
        ' -f dash ' +
        outputResult;
      break;
    default:
      break;
  }
  return encodeCmd;
};

const encodeIntoDash = async (destination, originalname) => {
  console.log({ destination, originalname });
  const filePath = destination + originalname;
  const filenameWithoutExt = originalname.split('.')[0];
  const outputFolder = destination + filenameWithoutExt + 'Dash';
  const outputResult = outputFolder + '/init.mpd';
  fs.access(outputFolder, (error) => {
    if (error) {
      fs.mkdir(outputFolder, (error) => {
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
  console.log('Do ffmpeg shit');

  await new ffmpeg()
    .addInput(filePath)
    .outputOptions([
      '-re',
      '-preset veryfast',
      // '-c:v copy',
      '-c:v libx264',
      // '-c:a copy',
      '-c:a aac',
      '-c:s srt',
      '-crf 28',
      '-f dash',
      '-map 0:v:0',
      '-map 0:a:0',
      '-ar 44100',

      '-b:v:0 750k -filter:v:0 scale=-2:480',
      '-b:v:1 1000k -filter:v:1 scale=-2:720',
      '-b:v:2 1500k -filter:v:2 scale=-2:1080',

      // '-filter:v:0 scale=-2:360',
      // '-maxrate:v:0 600k',
      // '-b:a:0 500k',
      // '-filter:v:1 scale=-2:480',
      // '-maxrate:v:1 1500k',
      // '-b:a:1 1000k',
      // '-filter:v:2 scale=-2:1080',
      // '-maxrate:v:2 3000k',
      // '-b:a:2 2000k',
      // '-var_stream_map',
      // '"v:0,a:0,s:0 v:1,a:0,s:0 v:2,a:0,s:0"',
      '-use_timeline 1',
      '-single_file 0',
      '-use_template 1',
      '-seg_duration 10',
      // '-adaptation_sets "id=0,streams=v id=1,streams=a"',
      '-bf 1',
      '-keyint_min 120',
      '-g 120',
      '-sc_threshold 0',
      '-b_strategy 0',
      '-ar:a:1 22050',
      '-init_seg_name init_$RepresentationID$.m4s',
      '-media_seg_name chunk_$RepresentationID$_$Number%05d$.m4s',
    ])
    // .outputOption('-adaptation_sets', 'id=0,streams=v id=1,streams=a')
    .output(outputResult)

    .on('start', function (commandLine) {
      console.log('Spawned Ffmpeg with command: ' + commandLine);
    })
    .on('error', function (err, stdout, stderr) {
      console.error('An error occurred: ' + err.message, err, stderr);
      // fs.unlinkSync(filePath, function (err) {
      //   if (err) throw err;
      //   console.log(filePath + ' deleted!');
      // });
    })
    .on('progress', function (progress) {
      console.log('Processing: ' + progress.percent + '% done');
      console.log(progress);
      /*percent = progress.percent;
      res.write('<h1>' + percent + '</h1>');*/
    })
    .on('end', function (err, stdout, stderr) {
      console.log('Finished processing!' /*, err, stdout, stderr*/);

      fs.unlinkSync(filePath, function (err) {
        if (err) throw err;
        console.log(filePath + ' deleted!');
      });
    })
    .run();
};

const encodeIntoDashVer4 = async (destination, originalname, statusId) => {
  console.log('encodeAPI.encodeIntoDashVer4 -> ');
  console.log({ destination, originalname });
  const filePath = destination + originalname;
  const filenameWithoutExt = originalname.split('.')[0];
  const outputFolder = destination + filenameWithoutExt + 'Dash';
  const outputResult = outputFolder + '/init.mpd';
  const videoStatus = await VideoStatus.findById(statusId);
  fs.access(outputFolder, (error) => {
    if (error) {
      fs.mkdir(outputFolder, (error) => {
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
  console.log('Do ffmpeg shit');
  let startTime;
  let encodeDuration = 0;
  let videoDuration = 0;

  let commandCombine = encodeCommand(1, filePath, outputFolder, outputResult);

  console.log(commandCombine);

  fluentFfmpeg.ffprobe(filePath, function (error, metadata) {
    if (error) {
      console.log(error);
      return;
    }
    console.log('Video duration: ' + metadata.format.duration);
    videoDuration = metadata.format.duration || 0;
  });

  const process_combine = spawn(commandCombine, [], { shell: true, windowsHide: true });

  // This event fires as soon as the process is successfully spawned
  process_combine.on('spawn', () => {
    console.log('FFmpeg process has been spawned successfully');
    // You can add any code here that needs to run when the process starts
    startTime = new Date().getTime();
  });

  // Capture and display output in real-time
  process_combine.stdout.on('data', (data) => {
    console.log(`process_combine.stdout.on('data', (data) ${data}`);
  });

  process_combine.stderr.on('data', (data) => {
    console.log(`process_combine.stderr.on('data', (data) ${data}`);
  });

  // Handle completion
  process_combine.on('close', async (code) => {
    if (code === 0) {
      console.log('Video conversion completed successfully');
    } else {
      const error = new Error(`FFmpeg process_combine exited with code ${code}`);
      console.error(error.message);
    }

    console.log(`process_combine.on('close', async (code) ${code}`);

    fs.unlinkSync(filePath, function (err) {
      if (err) throw err;
      console.log(filePath + ' deleted!');
    });
    const endTime = new Date().getTime();
    encodeDuration = (endTime - startTime) / 1000;
    console.log(
      'Start at ' +
        startTime +
        ' and finished at ' +
        endTime +
        ', took ' +
        encodeDuration +
        ' seconds to encode a ' +
        videoDuration +
        ' seconds video'
    );
    console.log(encodeDuration);
    console.log(commandCombine);

    if (videoStatus !== null) {
      videoStatus.status = 'ready';
      videoStatus.videoDuration = videoDuration;
      videoStatus.encodeDuration = encodeDuration;
      await videoStatus.save();
    }
  });
};

const encodeIntoDash_test = async (videoname) => {
  console.log('encodeAPI.encodeIntoDash_test -> ');
  console.log({ videoname });
  const filePath = videoname;
  const filenameWithoutExt = videoname.split('.')[0];
  const outputFolder = filenameWithoutExt + 'Dash';
  const outputResult = outputFolder + '/init.mpd';
  fs.access(outputFolder, (error) => {
    if (error) {
      fs.mkdir(outputFolder, (error) => {
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
  console.log('Do ffmpeg');
  let startTime = 0;
  let encodeDuration = 0;
  let videoDuration = 0;

  let commandCombine =
    'ffmpeg -ss 10 -i ' +
    filePath +
    ' -qscale:v 2 -frames:v 1 ' +
    outputFolder +
    '/thumbnail.png ' +
    ' | ' +
    'ffmpeg -i ' +
    filePath +
    ' -c:v libx264' +
    ' -c:a aac -b:a 128k' +
    ' -preset veryfast' +
    ' -bf 1 -b_strategy 0 -sc_threshold 0 -pix_fmt yuv420p' +
    ' -map 0:v:0 -map 0:a:0 -map 0:v:0 -map 0:v:0 -map 0:v:0' +
    ' -b:v:0 300k -s:v:0 720x480 -profile:v:0 baseline' +
    ' -b:v:1 700k -s:v:1 1080x720 -profile:v:1 main' +
    ' -b:v:2 1300k -s:v:2 1920x1080 -profile:v:2 high' +
    ' -b:v:3 2500k' +
    ' -f mpegts -' +
    ' | ' +
    'ffmpeg -i - ' +
    ' -map 0' +
    ' -use_timeline 1' +
    ' -single_file 0' +
    ' -use_template 1' +
    ' -adaptation_sets "id=0,streams=v id=1,streams=a"' +
    ' -init_seg_name init_$RepresentationID$.m4s' +
    ' -media_seg_name chunk_$RepresentationID$_$Number%05d$.m4s' +
    ' -f dash ' +
    outputResult;

  console.log(commandCombine);

  const process_combine = spawn(commandCombine, [], { shell: true });
  // This event fires as soon as the process is successfully spawned
  process_combine.on('spawn', () => {
    console.log('FFmpeg process has been spawned successfully');
    // You can add any code here that needs to run when the process starts
    startTime = new Date().getTime();
  });
  // Capture and display output in real-time
  process_combine.stdout.on('data', (data) => {
    console.log(`${data}`);
  });
  process_combine.stderr.on('data', (data) => {
    console.log(`${data}`);
  });
  // Handle completion
  process_combine.on('close', async (code) => {
    if (code === 0) {
      console.log('Video conversion completed successfully');
    } else {
      const error = new Error(`FFmpeg process_2 exited with code ${code}`);
      console.error(error.message);
    }
    // fs.unlinkSync(filePath, function (err) {
    //   if (err) throw err;
    //   console.log(filePath + ' deleted!');
    // });
    const endTime = new Date().getTime();
    encodeDuration = (endTime - startTime) / 1000;
    console.log(
      'Start at ' +
        startTime +
        ' and finished at ' +
        endTime +
        ', took ' +
        encodeDuration +
        ' seconds to encode a ' +
        videoDuration +
        ' seconds video'
    );
    console.log(encodeDuration);
    console.log(commandCombine);
  });
};

const concaterServer = async (chunkNames, destination, originalname) => {
  console.log(chunkNames);
  chunkNames.forEach((chunkName) => {
    console.log('encodeAPI.concaterServer -> ');
    try {
      const data = fs.readFileSync('./' + destination + chunkName);
      fs.appendFileSync('./' + destination + originalname, data);
      fs.unlinkSync('./' + destination + chunkName);
    } catch (err) {
      console.log(err);
    }
  });
};

module.exports = {
  encodeIntoDash,
  concaterServer,
  encodeIntoDashVer4,
  encodeIntoDash_test,
};

/*

ffmpeg -i video.mp4 \
  -map 0 \
  -c:v libx265 -preset fast \
  -c:a aac \
  \
  # Video representation 1: Low quality (480p)
  -b:v:0 300k -s:v:0 720x480 \
  \
  # Video representation 2: Medium quality (720p)
  -b:v:1 700k -s:v:1 1080x720 \
  \
  # Video representation 3: High quality (1080p)
  -b:v:2 1300k -s:v:2 1920x1080 \
  \  
  # Common video encoding parameters
  -bf 1 -keyint_min 120 -g 120 -sc_threshold 0 -b_strategy 0 \
  \
  # Audio configuration
  -ar:a:1 44100 \
  \
  # DASH output parameters
  -use_timeline 1 \
  -single_file 0 \
  -use_template 1 \
  -seg_duration 10 \
  -init_seg_name init_$RepresentationID$.m4s \
  -media_seg_name chunk_$RepresentationID$_$Number%05d$.m4s \
  -f dash videos/init.mpd
*/
