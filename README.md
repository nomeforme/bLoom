# Blockchain Loom: Text Generation Tree on Ethereum

A decentralized tree-based text generation interface that stores narrative branches as smart contracts on Ethereum.

## Architecture

- **Frontend**: LiteGraph.js for visual tree navigation
- **Blockchain**: Anvil (Foundry's local Ethereum node)  
- **Storage**: Factory pattern smart contracts
- **AI**: LLM API integration for text generation

## Features

- Reactive UI that updates as blockchain transactions complete
- Persistent narrative trees stored on-chain
- Visual graph-based navigation
- Event-driven architecture
- Multi-branch text generation with AI

## Project Structure

```
contracts/          # Solidity smart contracts
frontend/           # Web interface with LiteGraph.js
backend/            # Node.js API server
scripts/            # Deployment and utility scripts
config/             # Configuration files
```

## Quick Start

1. Install dependencies: `npm install`
2. Start local blockchain: `anvil`
3. Deploy contracts: `npm run deploy`
4. Start backend: `npm run backend`
5. Start frontend: `npm run frontend`

## Smart Contracts

- `LoomFactory.sol`: Creates and manages tree contracts
- `LoomTree.sol`: Individual narrative tree storage
- `LoomNode.sol`: Node data structure and operations

## Development

Built on the conceptual foundation of the original Loom text generation interface, adapted for blockchain persistence and decentralized storage.