const mongoose = require('mongoose');

const DB_LOCAL = 'mongodb://127.0.0.1:27017/LearnNodeJS';
const DB_LOCAL_NEW = 'mongodb://127.0.0.1:27017/VideoSharing';
const DB_LOCAL_ALPHA_TEST = 'mongodb://127.0.0.1:27017/LOCALSERVER';

const DB_CLOUD = process.env.DATABASE.replace('<PASSWORD>', process.env.DATABASE_PASSWORD);

const connect = async () => {
  try {
    // await mongoose.connect(DB_CLOUD, {}).then((con) => {
    //   console.log('Mongo connected! ');
    //   console.log(con.connections);
    // });
    await mongoose.connect(DB_LOCAL_ALPHA_TEST, {}).then((con) => {
      console.log('Mongo connected! ');
      //console.log(con.connections);
    });
  } catch (err) {
    console.log(err);
  }
};
module.exports = { connect };
