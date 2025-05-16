const moment = require('moment');

class APIFeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
  }

  filter() {
    const queryObj = { ...this.queryString };
    const excludedFields = ['page', 'sort', 'limit', 'fields', 'populateObjects', 'category', 'timeline'];
    excludedFields.forEach((el) => delete queryObj[el]);

    // 1B) Advanced filtering
    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);

    this.query = this.query.find(JSON.parse(queryStr));
    return this;
  }

  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(',').join(' ');
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort('-createdAt');
    }

    return this;
  }

  limitFields() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(',').join(' ');
      this.query = this.query.select(fields);
    } else {
      this.query = this.query.select('-__v');
    }

    return this;
  }

  paginate() {
    const page = this.queryString.page * 1 || 1;
    const limit = this.queryString.limit * 1 || 100;
    const skip = (page - 1) * limit;

    this.query = this.query.skip(skip).limit(limit);

    return this;
  }

  //pass object seperate with "," that want to populate like req.query.objects='user,video'
  populateObjects() {
    if (this.queryString.populateObjects) {
      const objs = this.queryString.populateObjects.split(',').join(' ');

      this.query = this.query.populate(objs);
    }

    return this;
  }

  //pass object seperate with "," that want to query like req.query.category='Daily life,Technique'
  category() {
    if (this.queryString.category) {
      const categorys = this.queryString.category.split(',');
      this.query = this.query.find({ tag: { $in: [...categorys] } });
    }

    return this;
  }

  //pass datetime object want to populate like req.query.timeline='new Date('1987-10-26')'
  timeline() {
    if (this.queryString.timeline) {
      const timeline = moment(this.queryString.timeline);
      console.log(timeline);
      this.query = this.query.find({
        createDate: {
          $gt: moment(timeline).format(),
          $lt: moment(timeline).add(1, 'days'),
        },
      });
    }

    return this;
  }
}
module.exports = APIFeatures;
