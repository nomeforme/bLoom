#!/usr/bin/env node

/**
 * Chain management script for Loom Chain (JavaScript version)
 * Usage: node backend/scripts/chain.js [command] [options]
 */

const path = require('path');
const { 
  getChainConfig, 
  getActiveChainConfig,
  setActiveChain,
  getAllChainConfigs,
  getAliases,
  getSupportedChainIds,
  isChainConfigured,
  getChainName
} = require('../backend/config/chainConfig');
const { spawn } = require('child_process');

// Colors for output
const colors = {
  RED: '\x1b[0;31m',
  GREEN: '\x1b[0;32m',
  BLUE: '\x1b[0;34m',
  YELLOW: '\x1b[0;33m',
  NC: '\x1b[0m' // No Color
};

function showUsage() {
  console.log(`${colors.BLUE}Loom Chain Management Script${colors.NC}`);
  console.log('');
  console.log('Usage: node backend/scripts/chain.js [command] [options]');
  console.log('');
  console.log('Commands:');
  console.log(`  ${colors.GREEN}info${colors.NC}          Show current active chain configuration`);
  console.log(`  ${colors.GREEN}list${colors.NC}          List all configured chains`);
  console.log(`  ${colors.GREEN}local${colors.NC}         Switch to local Anvil chain`);
  console.log(`  ${colors.GREEN}sepolia${colors.NC}       Switch to Sepolia testnet`);
  console.log(`  ${colors.GREEN}scroll-sepolia${colors.NC} Switch to Scroll Sepolia testnet`);
  console.log(`  ${colors.GREEN}switch${colors.NC} <alias> Switch to specific chain by alias or ID`);
  console.log(`  ${colors.GREEN}config${colors.NC} <alias> Show configuration for specific chain`);
  console.log(`  ${colors.GREEN}deploy${colors.NC}        Deploy contracts to active chain`);
  console.log(`  ${colors.GREEN}deploy${colors.NC} <id>   Deploy contracts to specific chain`);
  console.log('');
  console.log('Options:');
  console.log(`  ${colors.YELLOW}-h, --help${colors.NC}    Show this help message`);
  console.log('');
  console.log('Examples:');
  console.log('  node backend/scripts/chain.js info');
  console.log('  node backend/scripts/chain.js sepolia');
  console.log('  node backend/scripts/chain.js switch local');
  console.log('  node backend/scripts/chain.js deploy sepolia');
  console.log('  node backend/scripts/chain.js config scroll-sepolia');
}

function showChainInfo() {
  try {
    console.log(`${colors.BLUE}Current Active Chain Configuration:${colors.NC}`);
    const activeConfig = getActiveChainConfig();
    console.log(`  Chain ID: ${activeConfig.chainId}`);
    console.log(`  Name: ${activeConfig.name || 'Unknown'}`);
    console.log(`  RPC URL: ${activeConfig.rpcUrl || 'Not configured'}`);
    console.log(`  Factory Address: ${activeConfig.factoryAddress || 'Not configured'}`);
    console.log(`  Explorer URL: ${activeConfig.explorerUrl || 'Not configured'}`);
    if (activeConfig.gasPrice) {
      console.log(`  Gas Price: ${activeConfig.gasPrice} wei`);
    }
    if (activeConfig.baseFee) {
      console.log(`  Base Fee: ${activeConfig.baseFee} wei`);
    }
  } catch (error) {
    console.error(`${colors.RED}Error: Could not retrieve chain information${colors.NC}`);
    console.error(error.message);
    process.exit(1);
  }
}

function listChains() {
  try {
    console.log(`${colors.BLUE}Available Chain Configurations:${colors.NC}`);
    const allChains = getAllChainConfigs();
    Object.keys(allChains).forEach(chainId => {
      const chain = allChains[chainId];
      console.log(`  ${colors.GREEN}${chainId}${colors.NC}: ${chain.name}`);
    });
    
    console.log('');
    console.log(`${colors.BLUE}Available Aliases:${colors.NC}`);
    const aliases = getAliases();
    Object.entries(aliases).forEach(([alias, chainId]) => {
      console.log(`  ${alias} -> ${chainId}`);
    });
  } catch (error) {
    console.error(`${colors.RED}Error: Could not list chains${colors.NC}`);
    console.error(error.message);
    process.exit(1);
  }
}

function switchChain(target) {
  try {
    // Verify chain is configured
    if (!isChainConfigured(target)) {
      console.error(`${colors.RED}Error: Chain '${target}' is not configured${colors.NC}`);
      console.error(`${colors.YELLOW}Use 'node backend/scripts/chain.js list' to see available chains and aliases${colors.NC}`);
      process.exit(1);
    }
    
    const name = getChainName(target);
    console.log(`${colors.BLUE}Switching to chain: ${name}${colors.NC}`);
    
    setActiveChain(target);
    console.log(`${colors.GREEN}Successfully switched to ${name}${colors.NC}`);
    console.log(`${colors.YELLOW}Note: Restart the frontend development server if needed${colors.NC}`);
  } catch (error) {
    console.error(`${colors.RED}Error: ${error.message}${colors.NC}`);
    process.exit(1);
  }
}

function deployContracts(target = 'active') {
  try {
    let chainConfig;
    if (target === 'active') {
      console.log(`${colors.BLUE}Deploying to active chain...${colors.NC}`);
      chainConfig = getActiveChainConfig();
    } else {
      // Verify chain is configured
      if (!isChainConfigured(target)) {
        console.error(`${colors.RED}Error: Chain '${target}' is not configured${colors.NC}`);
        console.error(`${colors.YELLOW}Use 'node backend/scripts/chain.js list' to see available chains and aliases${colors.NC}`);
        process.exit(1);
      }
      
      chainConfig = getChainConfig(target);
      console.log(`${colors.BLUE}Deploying to ${chainConfig.name}...${colors.NC}`);
    }
    
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
      console.error(`${colors.RED}Error executing forge: ${error.message}${colors.NC}`);
      process.exit(1);
    });
    
  } catch (error) {
    console.error(`${colors.RED}Error: ${error.message}${colors.NC}`);
    process.exit(1);
  }
}

function showChainConfig(target) {
  try {
    const config = getChainConfig(target);
    // Remove private key for security when displaying
    const { privateKey, ...safeConfig } = config;
    console.log(JSON.stringify(safeConfig, null, 2));
  } catch (error) {
    console.error(`${colors.RED}Error: ${error.message}${colors.NC}`);
    process.exit(1);
  }
}

// Main script logic
function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const target = args[1];
  
  if (!command || command === '-h' || command === '--help' || command === 'help') {
    showUsage();
    return;
  }
  
  try {
    switch (command) {
      case 'info':
      case 'status':
        showChainInfo();
        break;
        
      case 'list':
      case 'ls':
        listChains();
        break;
        
      case 'local':
      case 'sepolia':
      case 'scroll-sepolia':
        switchChain(command);
        break;
        
      case 'switch':
      case 'use':
        if (!target) {
          console.error(`${colors.RED}Error: Chain alias or ID required${colors.NC}`);
          showUsage();
          process.exit(1);
        }
        switchChain(target);
        break;
        
      case 'config':
        if (!target) {
          console.error(`${colors.RED}Error: Chain alias or ID required${colors.NC}`);
          process.exit(1);
        }
        showChainConfig(target);
        break;
        
      case 'deploy':
        deployContracts(target);
        break;
        
      default:
        console.error(`${colors.RED}Error: Unknown command: ${command}${colors.NC}`);
        showUsage();
        process.exit(1);
    }
  } catch (error) {
    console.error(`${colors.RED}Error: ${error.message}${colors.NC}`);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error(`${colors.RED}Uncaught Exception: ${error.message}${colors.NC}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(`${colors.RED}Unhandled Rejection at: ${promise}, reason: ${reason}${colors.NC}`);
  process.exit(1);
});

if (require.main === module) {
  main();
}

module.exports = {
  showUsage,
  showChainInfo,
  listChains,
  switchChain,
  deployContracts,
  showChainConfig
};