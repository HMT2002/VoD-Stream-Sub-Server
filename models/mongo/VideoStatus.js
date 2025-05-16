const mongoose = require('mongoose');

const videoStatusSchema = new mongoose.Schema({
  server: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Server',
  },
  video: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Video',
  },
  status: { type: String, enum: ['ready', 'encoding', 'transfering', 'uploading'], default: 'ready' },

  createDate: { type: Date, required: false, default: Date.now },
  updateDate: { type: Date, required: false, default: Date.now },
  videoDuration: { type: Number, default: 0 * 1 },
  encodeDuration: { type: Number, default: 0 * 1 },
});
const VideoStatus = mongoose.model('VideoStatus', videoStatusSchema);

module.exports = VideoStatus;
