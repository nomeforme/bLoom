#!/usr/bin/env node

/**
 * Utility script to get chain configuration values for npm scripts
 * Usage: node scripts/getChainConfig.js [chainId] [property]
 */

require('dotenv').config();
const { getChainConfig, getActiveChainConfig } = require('../backend/config/chainConfig');

const args = process.argv.slice(2);
const chainId = args[0];
const property = args[1];

if (!chainId) {
  console.error('Usage: node scripts/getChainConfig.js [chainId|active] [property]');
  console.error('Properties: rpcUrl, factoryAddress, privateKey, gasPrice, baseFee');
  process.exit(1);
}

try {
  let config;
  
  if (chainId === 'active') {
    config = getActiveChainConfig();
  } else {
    config = getChainConfig(chainId);
  }

  if (property) {
    const value = config[property];
    if (value === undefined) {
      console.error(`Property '${property}' not found in configuration for chain ${chainId}`);
      process.exit(1);
    }
    console.log(value);
  } else {
    console.log(JSON.stringify(config, null, 2));
  }
} catch (error) {
  console.error('Error getting chain configuration:', error.message);
  process.exit(1);
}