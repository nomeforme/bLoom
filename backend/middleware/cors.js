const cors = require('cors');
const { getEnvironmentConfig } = require('../utils/envConfig');

const { frontendUrl } = getEnvironmentConfig();

const corsOptions = {
  origin: frontendUrl,
  methods: ["GET", "POST"]
};

module.exports = cors(corsOptions);