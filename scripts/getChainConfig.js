#!/usr/bin/env node

/**
 * Utility script to get chain configuration values for npm scripts
 * Usage: node scripts/getChainConfig.js [chainId|alias|active] [property]
 */

require('dotenv').config();
const { getChainConfig, getActiveChainConfig, setActiveChain, getAllChainConfigs, getAliases, getSupportedChainIds } = require('../backend/config/chainConfig');

const args = process.argv.slice(2);
const command = args[0];
const property = args[1];

function showUsage() {
  console.error('Usage: node scripts/getChainConfig.js <command> [property]');
  console.error('');
  console.error('Commands:');
  console.error('  active                    Get active chain configuration');
  console.error('  list                      List all available chains');
  console.error('  aliases                   List all chain aliases');
  console.error('  set <chainId|alias>       Set active chain');
  console.error('  <chainId|alias>           Get specific chain configuration');
  console.error('');
  console.error('Properties (when getting config):');
  console.error('  chainId, name, rpcUrl, factoryAddress, privateKey, gasPrice, baseFee, explorerUrl');
  console.error('');
  console.error('Examples:');
  console.error('  node scripts/getChainConfig.js active');
  console.error('  node scripts/getChainConfig.js active rpcUrl');
  console.error('  node scripts/getChainConfig.js sepolia');
  console.error('  node scripts/getChainConfig.js set local');
  console.error('  node scripts/getChainConfig.js list');
}

if (!command) {
  showUsage();
  process.exit(1);
}

try {
  switch (command) {
    case 'active':
      const activeConfig = getActiveChainConfig();
      if (property) {
        const value = activeConfig[property];
        if (value === undefined) {
          console.error(`Property '${property}' not found in active chain configuration`);
          process.exit(1);
        }
        console.log(value);
      } else {
        console.log(JSON.stringify(activeConfig, null, 2));
      }
      break;

    case 'list':
      const allChains = getAllChainConfigs();
      Object.keys(allChains).forEach(chainId => {
        const chain = allChains[chainId];
        console.log(`${chainId}: ${chain.name}`);
      });
      break;

    case 'aliases':
      const aliases = getAliases();
      console.log(JSON.stringify(aliases, null, 2));
      break;

    case 'supported':
      const supportedIds = getSupportedChainIds();
      console.log(supportedIds.join(', '));
      break;

    case 'set':
      if (!property) {
        console.error('Chain ID or alias required for set command');
        console.error('Usage: node scripts/getChainConfig.js set <chainId|alias>');
        process.exit(1);
      }
      setActiveChain(property);
      const newActive = getActiveChainConfig();
      console.log(`Successfully switched to ${newActive.name} (${newActive.chainId})`);
      break;

    default:
      // Treat as chain ID or alias
      const config = getChainConfig(command);
      if (property) {
        const value = config[property];
        if (value === undefined) {
          console.error(`Property '${property}' not found in configuration for chain ${command}`);
          process.exit(1);
        }
        console.log(value);
      } else {
        console.log(JSON.stringify(config, null, 2));
      }
      break;
  }
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}