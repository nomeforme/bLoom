const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { getActiveChainConfig } = require('./config/chainConfig');
require('dotenv').config();

// Import middleware
const corsMiddleware = require('./middleware/cors');

// Import routes
const healthRoutes = require('./routes/health');
const tokenBalanceRoutes = require('./routes/tokenBalance');
const modelsRoutes = require('./routes/models');
const generateRoutes = require('./routes/generate');
const ipfsRoutes = require('./routes/ipfs');

// Import services
const { setupSocketHandlers } = require('./socketHandlers');
const { setupBlockchainListeners } = require('./services/blockchainEvents');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
const io = socketIo(server, {
  cors: {
    origin: frontendUrl,
    methods: ["GET", "POST"]
  }
});

// Apply middleware
app.use(corsMiddleware);
app.use(express.json());

// Setup routes
app.use('/health', healthRoutes);
app.use('/api/token-balance', tokenBalanceRoutes);
app.use('/api/models', modelsRoutes);
app.use('/api/generate', generateRoutes);
app.use('/api/ipfs', ipfsRoutes);

// Setup Socket.IO handlers
setupSocketHandlers(io);

// Start server
const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  const chainConfig = getActiveChainConfig();
  console.log(`🚀 Blockchain Loom Backend running on port ${PORT}`);
  console.log(`📡 Socket.IO server ready for connections`);
  console.log(`🔗 Connected to ${chainConfig.name} (${chainConfig.chainId}) at ${chainConfig.rpcUrl}`);
  console.log(`📋 Factory contract: ${chainConfig.factoryAddress}`);
  
  setupBlockchainListeners(io);
});