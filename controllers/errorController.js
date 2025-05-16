const AppError = require('../utils/appError');

const handleValidationError = () =>
  new AppError('There something wrong with the data you sent, please check again', 400);
const handleJWTValidationError = () => new AppError('You are not login', 401);

const handleDuplicateFieldsDB = (error) => {
  // console.log(error);

  if (error.keyPattern.account) {
    return new AppError('The account is already existed', 400);
  }
  if (error.keyPattern.email) {
    return new AppError('The email is already existed', 400);
  }
  if (error.keyPattern.title) {
    return new AppError('The title is already existed', 400);
  }
  if (error.keyPattern.slug) {
    return new AppError('The slug is already existed', 400);
  }
  return new AppError('Some fields are duplicated', 400);
};

const sendErrorProd = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    message: 'There something wrong!',
  });
};

const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};
module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // console.log('Err in error controller ');
  // console.log(err.message);

  if (process.env.NODE_ENV === 'development') {
    // console.log('jump!');
    if (err.code === 11000) err = handleDuplicateFieldsDB(err);

    sendErrorDev(err, res);
  } else {
    let error = { ...err };
    // console.log('Error in error controller ');
    // console.log(error.name);
    // if (error.name === 'CastError') error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error.name === 'ValidationError') error = handleValidationError();
    if (error.name === 'JsonWebTokenError') error = handleJWTValidationError();

    sendErrorProd(error, res);
  }
};
