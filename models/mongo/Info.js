const mongoose = require('mongoose');

const infoSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, required: [true, 'Info required'] },
  createDate: { type: Date, default: Date.now() },
  filmID: { type: String, required: [true, 'Info required'] },
  filmType: { type: String, required: [true, 'Info required'] },
  filmInfo:{ type: Object, default: {}},
  videos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Video', default: null}],
  premium: { type: Boolean,  default: false },

});
const Info = mongoose.model('Info', infoSchema);

module.exports = Info;
