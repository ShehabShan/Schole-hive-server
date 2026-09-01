const jwt = require("jsonwebtoken");
const env = require("../config/env");

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : req?.cookies?.token;

  if (!token) return res.status(401).send({ message: "unauthorize access" });

  jwt.verify(token, env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) return res.status(403).send({ message: "unauthorize access" });
    req.decoded = decoded;
    next();
  });
}

module.exports = verifyToken;
