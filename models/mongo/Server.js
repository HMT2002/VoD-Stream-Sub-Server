const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const serverSchema = new mongoose.Schema({
  port: { type: String },
  URL: { type: String, required: [true, 'Yêu cầu cần URL'] },
  avarageSpeed: { type: Number, default: 0 * 1 },
  numberOfRequest: { type: Number, default: 0 * 1 },
  description: { type: String, default: 'no' },
  videos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Video' }],
  createdDate: { type: Date, default: Date.now },
  lastUpdated: { type: Date, default: Date.now },
  storage: { type: Number, default: 0 * 1 },
  occupy: { type: Number, default: 0 * 1 },
  occupyPercentage: { type: Number, default: 0 * 1 },
});

const Server = mongoose.model('Server', serverSchema);

module.exports = Server;
