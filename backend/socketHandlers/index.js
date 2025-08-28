const { handleGenerateNodes } = require('./nodeGeneration');
const { handleUpdateNode } = require('./nodeUpdate');
const { handleImportNodes } = require('./nodeImport');
const { handleTokenBalance, handleReportGasCost } = require('./tokenBalance');

function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Register all socket handlers
    handleGenerateNodes(socket, io);
    handleUpdateNode(socket, io);
    handleImportNodes(socket, io);
    handleTokenBalance(socket, io);
    handleReportGasCost(socket, io);

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
}

module.exports = {
  setupSocketHandlers
};