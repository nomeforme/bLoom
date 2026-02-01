const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { getActiveChainConfig } = require('./config/chainConfig');
const { getEnvironmentConfig } = require('./utils/envConfig');
require('dotenv').config();

// Import middleware
const corsMiddleware = require('./middleware/cors');

// Import routes
const healthRoutes = require('./routes/health');
const tokenBalanceRoutes = require('./routes/tokenBalance');
const modelsRoutes = require('./routes/models');
const generateRoutes = require('./routes/generate');
const ipfsRoutes = require('./routes/ipfs');
const chainsRoutes = require('./routes/chains');

// Import services
const { setupSocketHandlers } = require('./socketHandlers');
const { setupBlockchainListeners } = require('./services/blockchainEvents');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const { frontendUrl } = getEnvironmentConfig();
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
app.use('/api/chains', chainsRoutes);

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

// Graceful shutdown
let isShuttingDown = false;

async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);

  // Close Socket.IO connections
  console.log('📡 Closing Socket.IO connections...');
  io.close();

  // Remove blockchain event listeners
  const { factory, provider } = require('./config/blockchain');
  console.log('🔗 Removing blockchain listeners...');
  factory.removeAllListeners();

  // Destroy provider if possible
  if (provider.destroy) {
    provider.destroy();
  }

  // Close HTTP server
  console.log('🌐 Closing HTTP server...');
  server.close((err) => {
    if (err) {
      console.error('❌ Error closing server:', err);
      process.exit(1);
    }
    console.log('✅ Server closed successfully');
    process.exit(0);
  });

  // Force exit after timeout
  setTimeout(() => {
    console.error('⚠️ Forced shutdown after timeout');
    process.exit(1);
  }, 5000);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));