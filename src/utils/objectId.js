const { ObjectId } = require("mongodb");

function toObjectId(id) {
  try {
    return new ObjectId(id);
  } catch {
    const err = new Error("invalid id");
    err.status = 400;
    throw err;
  }
}

function isValidObjectId(id) {
  try {
    new ObjectId(id);
    return true;
  } catch {
    return false;
  }
}

module.exports = { toObjectId, isValidObjectId, ObjectId };
