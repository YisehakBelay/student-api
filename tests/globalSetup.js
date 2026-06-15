const { MongoMemoryServer } = require("mongodb-memory-server");

module.exports = async function () {
  const mongoServer = await MongoMemoryServer.create();
  process.env.MONGO_TEST_URI = mongoServer.getUri();
  // store on global so globalTeardown (same process) can stop it
  global.__MONGOSERVER__ = mongoServer;
};
