#!/usr/bin/env node

/**
 * Deploy script that accepts chain alias as argument
 * Usage: node scripts/deploy-to.js <chain-alias>
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

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

  // Execute forge command and capture output
  let deploymentOutput = '';
  
  const forge = spawn('forge', forgeArgs, {
    stdio: ['inherit', 'pipe', 'inherit'],
    cwd: path.join(__dirname, '..')
  });

  // Capture stdout to extract factory address
  forge.stdout.on('data', (data) => {
    const output = data.toString();
    process.stdout.write(output); // Still show output to user
    deploymentOutput += output;
  });

  forge.on('close', (code) => {
    if (code === 0) {
      // Parse factory address from deployment output
      const factoryMatch = deploymentOutput.match(/LoomFactory deployed to: (0x[a-fA-F0-9]{40})/);
      
      if (factoryMatch) {
        const factoryAddress = factoryMatch[1];
        updateChainsJson(chainAlias, chainConfig.chainId, factoryAddress);
      } else {
        console.warn('Warning: Could not extract factory address from deployment output');
      }
    }
    process.exit(code);
  });

} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}

function updateChainsJson(chainAlias, chainId, factoryAddress) {
  try {
    const chainsPath = path.join(__dirname, '../backend/config/chains.json');
    const chainsData = JSON.parse(fs.readFileSync(chainsPath, 'utf8'));
    
    // Update factory address for the chain
    const chainIdStr = chainId.toString();
    if (chainsData.chains[chainIdStr]) {
      const oldAddress = chainsData.chains[chainIdStr].factoryAddress;
      chainsData.chains[chainIdStr].factoryAddress = factoryAddress;
      
      // Write back to file
      fs.writeFileSync(chainsPath, JSON.stringify(chainsData, null, 2));
      
      console.log(`\n✅ Updated chains.json for ${chainAlias}:`);
      console.log(`   Old factory address: ${oldAddress || 'empty'}`);
      console.log(`   New factory address: ${factoryAddress}`);
    } else {
      console.warn(`Warning: Chain ${chainIdStr} not found in chains.json`);
    }
  } catch (error) {
    console.error('Error updating chains.json:', error.message);
  }
}