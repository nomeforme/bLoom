#!/usr/bin/env node

/**
 * Post-deployment script to update chains.json with deployed factory address
 * Usage: node scripts/postDeploy.js <chain-alias> <factory-address>
 */

const fs = require('fs');
const path = require('path');

// Load chainConfig to validate the chain
require('dotenv').config();
const { getChainConfig } = require('../backend/config/chainConfig');

const args = process.argv.slice(2);
const chainAlias = args[0];
const factoryAddress = args[1];

if (!chainAlias || !factoryAddress) {
  console.error('Usage: node scripts/postDeploy.js <chain-alias> <factory-address>');
  console.error('Examples:');
  console.error('  node scripts/postDeploy.js local 0x5FbDB2315678afecb367f032d93F642f64180aa3');
  console.error('  node scripts/postDeploy.js sepolia 0x1234567890123456789012345678901234567890');
  process.exit(1);
}

// Validate factory address format
if (!/^0x[a-fA-F0-9]{40}$/.test(factoryAddress)) {
  console.error('Error: Invalid factory address format. Must be a valid Ethereum address.');
  process.exit(1);
}

try {
  // Validate chain exists
  const chainConfig = getChainConfig(chainAlias);
  console.log(`Updating factory address for ${chainConfig.name}...`);

  // Read current chains.json
  const chainsPath = path.join(__dirname, '../backend/config/chains.json');
  const chainsData = JSON.parse(fs.readFileSync(chainsPath, 'utf8'));

  // Find the chain by chainId
  const chainId = chainConfig.chainId.toString();
  if (!chainsData.chains[chainId]) {
    console.error(`Error: Chain ${chainId} not found in chains.json`);
    process.exit(1);
  }

  // Update factory address
  const oldAddress = chainsData.chains[chainId].factoryAddress;
  chainsData.chains[chainId].factoryAddress = factoryAddress;

  // Write back to file
  fs.writeFileSync(chainsPath, JSON.stringify(chainsData, null, 2));

  console.log(`✅ Factory address updated successfully!`);
  console.log(`   Chain: ${chainConfig.name}`);
  console.log(`   Old address: ${oldAddress || 'empty'}`);
  console.log(`   New address: ${factoryAddress}`);

} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}