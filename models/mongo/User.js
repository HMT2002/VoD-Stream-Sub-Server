const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  username: { type: String, required: [true, 'Account required'] },
  password: { type: String, required: [true, 'Account required'], select: false },
  passwordConfirm: {
    type: String,
    required: [true, 'Please confirm your password'],
    validate: {
      validator: function (el) {
        // This only works on CREATE and SAVE!
        console.log(this);
        return el === this.password; // passwordConfirm===password
      },
      message: 'Password are not the same',
    },
  },
  passwordChangedAt: Date,
  account: { type: String, required: [true, 'Account required'], unique: true },
  email: { type: String, required: [true, 'Account required'], unique: true },
  cert_paper: { type: String, default: '', required: false },
  living_city: { type: String, default: '', required: false },
  phone: { type: String, default: '', required: false },
  address: { type: String, default: '', required: false },
  birthday: { type: Date, default: null, required: false },
  createdDate: { type: Date, default: Date.now },
  lastUpdated: { type: Date, default: Date.now },
  premium: { type: String, enum: ['normal', 'premium', 'vip', 'admin'], default: 'normal' },

  role: { type: String, enum: ['guest', 'user', 'content-creator', 'admin'], default: 'guest' },
  photo: {
    link: { type: String, default: 'https://i.imgur.com/KNJnIR0.jpg' },
  },
  points: { type: Number, default: 0 * 1 },
  identifyNumber: {
    type: String,
    default: (generateRandom = () => {
      const randomInteger = (min, max) => {
        return Math.floor(Math.random() * (max - min + 1)) + min;
      };
      return randomInteger(10000, 99999).toString();
    }),
  },

  passwordResetToken: String,
  passwordResetExpires: Date,
});

userSchema.pre('save', async function (next) {
  // Only run this function if password actually modified
  if (!this.isModified('password')) {
    return next();
  }
  this.password = await bcrypt.hash(this.password, 10);

  // Delete passwordConfirm field
  this.passwordConfirm = undefined;
  next();
});

userSchema.pre('save', async function (next) {
  // Only run this function if password actually modified
  if (!this.isModified('password') || this.isNew) {
    return next();
  }
  this.passwordChangedAt = Date.now - 3000;
  next();
});

//Generate user identifyNumber when save
userSchema.pre('save', async function (next) {
  const randomInteger = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };
  this.identifyNumber = randomInteger(10000, 99999).toString();
  next();
});

userSchema.methods.correctPassword = async function (candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.changePasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    console.log(changedTimestamp, JWTTimestamp);
    return JWTTimestamp < changedTimestamp;
  }
  // false is NOT changed
  return false;
};

userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(7).toString('hex');

  this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');

  console.log({ resetToken }, this.passwordResetToken);

  this.passwordResetExpires = Date.now + 10 * 60 * 1000; // 10 minutes

  return resetToken;
};
const User = mongoose.model('User', userSchema);

module.exports = User;
