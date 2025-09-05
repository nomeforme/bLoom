#!/usr/bin/env node

/**
 * Deploy script that accepts chain alias as argument
 * Usage: node scripts/deploy-to.js <chain-alias>
 */

const { spawn } = require('child_process');
const path = require('path');

// Load chainConfig to validate the chain
require('dotenv').config();
const { getChainConfig } = require('../backend/config/chainConfig');

const args = process.argv.slice(2);
const chainAlias = args[0];

if (!chainAlias) {
  console.error('Usage: node scripts/deploy-to.js <chain-alias>');
  console.error('Examples:');
  console.error('  node scripts/deploy-to.js local');
  console.error('  node scripts/deploy-to.js sepolia');
  console.error('  node scripts/deploy-to.js scroll');
  process.exit(1);
}

try {
  // Validate chain exists
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

} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}