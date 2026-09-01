const { getCollections } = require("../config/db");

async function loadAuthUser(req, res, next) {
  try {
    const { users } = getCollections();
    req.authUser = await users.findOne({ email: req.decoded.email });
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = loadAuthUser;
