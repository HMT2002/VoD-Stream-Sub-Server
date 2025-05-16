const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const videoSchema = new mongoose.Schema({
  videoname: { type: String, required: [true, 'Yêu cầu cần có tên video'] },
  type: { type: String, enum: ['HLS', 'DASH'], default: 'HLS' },
  size: { type: Number, default: 0 * 1 },
  numberOfRequest: { type: Number, default: 0 * 1 },
  numberOfReplicant: { type: Number, default: 1 * 1 },
  avarageSpeed: { type: Number, default: 0 * 1 },
  createdDate: { type: Date, default: Date.now },
  lastUpdated: { type: Date, default: Date.now },
  title: { type: String, default: 'no default title' },
});

const Video = mongoose.model('Video', videoSchema);

module.exports = Video;
