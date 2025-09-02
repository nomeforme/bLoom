const cors = require('cors');

const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

const corsOptions = {
  origin: frontendUrl,
  methods: ["GET", "POST"]
};

module.exports = cors(corsOptions);