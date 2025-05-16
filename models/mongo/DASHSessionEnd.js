const mongoose = require('mongoose');

const _DASHSessionEndSchema = new mongoose.Schema({
  sessionID: { type: String, required: [true, 'Session required'] },

  isStopSession: { type: Boolean, default: false },
});
const DASHSessionEnd = mongoose.model('DASHSessionEnd', _DASHSessionEndSchema);

module.exports = DASHSessionEnd;
