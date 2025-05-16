let blacklist = [];

const AddToBlacklist = (data) => {
  let index = blacklist.findIndex((e) => e.sessionID === data.sessionID);

  if (index <= -1) {
    blacklist.push(data);
  }
  console.log(blacklist);
};
const RemoveFromBlacklist = (data) => {
  const sessionID = data.sessionID;
  let index = blacklist.findIndex((e) => e.sessionID === sessionID);
  if (index > -1) {
    blacklist.splice(index, 1);
  }
  console.log(blacklist);
  return blacklist;
};
const Blacklist = () => {
  return blacklist;
};

module.exports = {
  AddToBlacklist,
  RemoveFromBlacklist,
  blacklist,
};
