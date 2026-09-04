const jwt = require("jsonwebtoken");
const env = require("../config/env");

async function postJwt(req, res) {
  const user = req.body;
  const token = await new Promise((resolve, reject) => {
    jwt.sign(user, env.ACCESS_TOKEN_SECRET, { expiresIn: "10h" }, (err, t) => (err ? reject(err) : resolve(t)));
  });
  res
    .cookie("token", token, {
      httpOnly: true,
      sameSite: env.NODE_ENV === "production" ? "none" : "strict",
      secure: env.NODE_ENV === "production",
    })
    .send({ success: true, token });
}

async function clearJwt(req, res) {
  res
    .clearCookie("token", {
      httpOnly: true,
      sameSite: env.NODE_ENV === "production" ? "none" : "strict",
      secure: env.NODE_ENV === "production",
    })
    .send({ success: true });
}

module.exports = { postJwt, clearJwt };
