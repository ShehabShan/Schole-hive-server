const createApp = require("./app");
const env = require("./config/env");

const app = createApp();
const port = env.PORT;

if (require.main === module) {
  app.listen(port, () => console.log(`School Hive server running on ${port}`));
}

module.exports = app;
