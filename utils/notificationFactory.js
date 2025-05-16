const moment = require('moment');

const Notification=require('../models/mongo/Notification')
class NotificationFactory {
  
  constructor(message, notitype,sender,receiver,thread) {
    this.message = message;
    this.notitype = notitype;
    this.sender=sender;
    this.receiver=receiver;
    this.thread=thread;
  }

   async create(){

    const notification=await Notification.create({thread:this.thread,message:this.message,notitype:this.notitype,sender:this.sender,receiver:this.receiver});
    // console.log(notification);
    return notification;
  }

}
module.exports = NotificationFactory;
