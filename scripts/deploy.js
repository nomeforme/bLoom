#!/usr/bin/env node

/**
 * Deploy script that accepts chain alias or ID (JavaScript version)
 * Usage: node backend/scripts/deploy.js <chain-alias>
 */

const { spawn } = require('child_process');
const path = require('path');
const { getChainConfig } = require('../backend/config/chainConfig');

function showUsage() {
  console.error('Usage: node backend/scripts/deploy.js <chain-alias>');
  console.error('Example: node backend/scripts/deploy.js sepolia');
  console.error('         node backend/scripts/deploy.js local');
  console.error('         node backend/scripts/deploy.js scroll');
}

function deployToChain(chainAlias) {
  try {
    // Get chain configuration
    const chainConfig = getChainConfig(chainAlias);
    console.log(`Deploying to ${chainConfig.name}...`);

    // Build forge command arguments
    const forgeArgs = [
      'script',
      'scripts/Deploy.s.sol',
      '--rpc-url',
      chainConfig.rpcUrl,
      '--private-key',
      chainConfig.privateKey,
      '--broadcast'
    ];

    // Add gas price if available
    if (chainConfig.gasPrice) {
      forgeArgs.push('--with-gas-price', chainConfig.gasPrice);
    }

    // Execute forge command
    const forge = spawn('forge', forgeArgs, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });

    forge.on('close', (code) => {
      process.exit(code);
    });

    forge.on('error', (error) => {
      console.error('Error executing forge:', error.message);
      process.exit(1);
    });

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Main script logic
function main() {
  const args = process.argv.slice(2);
  const chainAlias = args[0];

  if (!chainAlias) {
    showUsage();
    process.exit(1);
  }

  deployToChain(chainAlias);
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

if (require.main === module) {
  main();
}

module.exports = {
  deployToChain,
  showUsage
};