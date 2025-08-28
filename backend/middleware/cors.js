const cors = require('cors');

const corsOptions = {
  origin: "http://localhost:3000",
  methods: ["GET", "POST"]
};

module.exports = cors(corsOptions);