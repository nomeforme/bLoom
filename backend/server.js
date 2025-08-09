const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const { ethers } = require('ethers');
const axios = require('axios');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Blockchain setup
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'http://localhost:8545');
const privateKey = process.env.PRIVATE_KEY || 'REDACTED_PRIVATE_KEY';
const wallet = new ethers.Wallet(privateKey, provider);

// Contract addresses and ABIs
const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3";

const FACTORY_ABI = [
  "function createTree(string memory rootContent) external returns (address)",
  "function getTree(bytes32 treeId) external view returns (address)",
  "event TreeCreated(bytes32 indexed treeId, address indexed treeAddress, address indexed creator, string rootContent)"
];

const TREE_ABI = [
  "function addNode(bytes32 parentId, string memory content) external returns (bytes32)",
  "function addNodeForUser(bytes32 parentId, string memory content, address author) external returns (bytes32)",
  "function updateNodeContent(bytes32 nodeId, string memory newContent) external",
  "function getNode(bytes32 nodeId) external view returns (bytes32 id, bytes32 parentId, string memory content, bytes32[] memory children, address author, uint256 timestamp, bool isRoot)",
  "function getAllNodes() external view returns (bytes32[] memory)",
  "function getRootId() external view returns (bytes32)",
  "function getNodeCount() external view returns (uint256)",
  "event NodeCreated(bytes32 indexed nodeId, bytes32 indexed parentId, string content, address indexed author, uint256 timestamp)",
  "event NodeUpdated(bytes32 indexed nodeId, string newContent, address indexed author)"
];

const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, wallet);

// LLM Configuration
const LLM_CONFIG = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-4o'
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: 'https://api.anthropic.com/v1',
    model: 'claude-3-haiku-20240307'
  },
  local: {
    baseURL: process.env.LOCAL_LLM_URL || 'http://localhost:1234/v1',
    model: 'local-model'
  }
};

// Helper function to sort nodes by dependency order
function sortNodesByDependency(nodes, rootParentId) {
  const sorted = [];
  const processed = new Set();
  const rootId = rootParentId || '0x0000000000000000000000000000000000000000000000000000000000000000';
  
  // Keep trying to add nodes until all are processed
  let remainingNodes = [...nodes];
  let maxIterations = nodes.length * 2; // Prevent infinite loops
  let iteration = 0;
  
  while (remainingNodes.length > 0 && iteration < maxIterations) {
    const initialLength = remainingNodes.length;
    
    remainingNodes = remainingNodes.filter(node => {
      // Can add if parent is root or already processed
      if (node.parentId === rootId || node.parentId === '0x0' || processed.has(node.parentId)) {
        sorted.push(node);
        processed.add(node.nodeId);
        return false; // Remove from remaining
      }
      return true; // Keep in remaining
    });
    
    // If no progress was made, break to avoid infinite loop
    if (remainingNodes.length === initialLength) {
      console.warn('Could not resolve all node dependencies, adding remaining nodes anyway');
      sorted.push(...remainingNodes);
      break;
    }
    
    iteration++;
  }
  
  return sorted;
}

// Text generation function
async function generateText(prompt, provider = 'openai') {
  try {
    let response;
    
    switch (provider) {
      case 'openai':
        if (!LLM_CONFIG.openai.apiKey) {
          throw new Error('OpenAI API key not configured');
        }
        response = await axios.post(
          `${LLM_CONFIG.openai.baseURL}/chat/completions`,
          {
            model: LLM_CONFIG.openai.model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 150,
            temperature: 0.8
          },
          {
            headers: {
              'Authorization': `Bearer ${LLM_CONFIG.openai.apiKey}`,
              'Content-Type': 'application/json'
            }
          }
        );
        return response.data.choices[0].message.content.trim();
        
      case 'anthropic':
        if (!LLM_CONFIG.anthropic.apiKey) {
          throw new Error('Anthropic API key not configured');
        }
        response = await axios.post(
          `${LLM_CONFIG.anthropic.baseURL}/messages`,
          {
            model: LLM_CONFIG.anthropic.model,
            max_tokens: 150,
            messages: [{ role: 'user', content: prompt }]
          },
          {
            headers: {
              'x-api-key': LLM_CONFIG.anthropic.apiKey,
              'Content-Type': 'application/json',
              'anthropic-version': '2023-06-01'
            }
          }
        );
        return response.data.content[0].text.trim();
        
      case 'local':
        response = await axios.post(
          `${LLM_CONFIG.local.baseURL}/chat/completions`,
          {
            model: LLM_CONFIG.local.model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 150,
            temperature: 0.8
          },
          {
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
        return response.data.choices[0].message.content.trim();
        
      default:
        throw new Error(`Unknown LLM provider: ${provider}`);
    }
  } catch (error) {
    console.error('Error generating text:', error.message);
    // Fallback to a simple continuation
    return `[Generated continuation from "${prompt.substring(0, 50)}..."]`;
  }
}

// Socket.IO event handlers
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('generateSiblings', async (data) => {
    const { treeAddress, parentId, parentContent, count = 3, userAccount } = data;
    
    try {
      // Get the tree contract
      const treeContract = new ethers.Contract(treeAddress, TREE_ABI, wallet);
      
      // Use provided content if available, otherwise fetch from blockchain
      let contextContent = parentContent || '';
      if (!contextContent && parentId !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
        try {
          const parentNode = await treeContract.getNode(parentId);
          contextContent = parentNode[2]; // content is at index 2
        } catch (error) {
          console.warn('Could not fetch parent content from blockchain:', error.message);
        }
      }
      
      // Generate text continuations
      const generations = [];
      for (let i = 0; i < count; i++) {
        try {
          const prompt = contextContent ? 
            `Here is a narrative story that has developed sequentially. Please continue this story with a new branch that follows naturally from the established narrative:\n\n${contextContent}\n\nWrite a short, engaging continuation (1-2 sentences) that builds upon this story:` :
            'Write the beginning of an interesting story (1-2 sentences):';
          
          const generatedText = await generateText(prompt, 'openai');
          if (generatedText && generatedText.trim()) {
            generations.push(generatedText.trim());
          } else {
            throw new Error('Empty response from AI');
          }
        } catch (error) {
          console.error(`Error generating text ${i + 1}:`, error.message);
          
          // Create meaningful placeholder based on parent content
          const placeholder = contextContent ? 
            `[Branch ${i + 1}] The story continues in an unexpected direction...` :
            `[Story ${i + 1}] Once upon a time, in a place far from here...`;
          
          generations.push(placeholder);
        }
      }
      
      // Add generated nodes to blockchain sequentially to avoid nonce conflicts
      let successCount = 0;
      for (let i = 0; i < generations.length; i++) {
        const content = generations[i];
        try {
          // Add small delay between transactions to avoid nonce conflicts
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          // Use addNodeForUser if userAccount is provided, otherwise use addNode
          const tx = userAccount && userAccount !== "0x0000000000000000000000000000000000000000" 
            ? await treeContract.addNodeForUser(parentId, content, userAccount)
            : await treeContract.addNode(parentId, content);
          const receipt = await tx.wait();
          
          // Find the NodeCreated event
          const nodeCreatedEvent = receipt.logs.find(log => {
            try {
              const parsed = treeContract.interface.parseLog(log);
              return parsed.name === 'NodeCreated';
            } catch {
              return false;
            }
          });
          
          if (nodeCreatedEvent) {
            const parsedEvent = treeContract.interface.parseLog(nodeCreatedEvent);
            const nodeData = {
              nodeId: parsedEvent.args.nodeId,
              parentId: parsedEvent.args.parentId,
              content: parsedEvent.args.content,
              author: parsedEvent.args.author,
              timestamp: Number(parsedEvent.args.timestamp),
              treeAddress: treeAddress
            };
            
            // Emit to all connected clients
            io.emit('nodeCreated', nodeData);
            successCount++;
          }
        } catch (error) {
          console.error(`Error adding node ${i + 1} to blockchain:`, error);
        }
      }
      
      socket.emit('generationComplete', {
        success: true,
        message: `Generated ${successCount}/${count} sibling nodes successfully`
      });
      
    } catch (error) {
      console.error('Error in generateSiblings:', error);
      socket.emit('generationComplete', {
        success: false,
        error: error.message
      });
    }
  });

  socket.on('updateNode', async (data) => {
    const { treeAddress, nodeId, newContent } = data;
    
    try {
      // Get the tree contract
      const treeContract = new ethers.Contract(treeAddress, TREE_ABI, wallet);
      
      // Update the node content
      const tx = await treeContract.updateNodeContent(nodeId, newContent);
      const receipt = await tx.wait();
      
      // Emit success response
      socket.emit('updateComplete', {
        success: true,
        nodeId,
        newContent,
        txHash: receipt.hash
      });
      
    } catch (error) {
      console.error('Error updating node via backend:', error);
      socket.emit('updateComplete', {
        success: false,
        error: error.message
      });
    }
  });

  socket.on('importNodes', async (data) => {
    const { treeAddress, rootId, oldRootId, nodes, userAccount } = data;
    
    try {
      // Verify the tree contract exists and is accessible
      try {
        const code = await provider.getCode(treeAddress);
        if (code === '0x') {
          throw new Error(`No contract found at address ${treeAddress}`);
        }
      } catch (error) {
        console.error('Contract verification failed:', error);
        throw new Error(`Failed to verify tree contract: ${error.message}`);
      }
      
      // Get the tree contract
      const treeContract = new ethers.Contract(treeAddress, TREE_ABI, wallet);
      
      // Test the contract by calling a simple read function
      try {
        const nodeCount = await treeContract.getNodeCount();
      } catch (error) {
        console.error('Tree contract test call failed:', error);
        throw new Error(`Tree contract not responsive: ${error.message}`);
      }
      
      // Create mapping from old node IDs to new node IDs
      const nodeIdMapping = new Map();
      
      // Map old root to new root
      if (oldRootId && rootId) {
        nodeIdMapping.set(oldRootId, rootId);
      }
      
      // Sort nodes by dependency order (parents before children)
      const sortedNodes = sortNodesByDependency(nodes, oldRootId);
      
      let successCount = 0;
      let failureCount = 0;
      
      // Add nodes to blockchain sequentially
      for (let i = 0; i < sortedNodes.length; i++) {
        const nodeData = sortedNodes[i];
        try {
          // Map the parent ID to the new blockchain ID
          let parentIdToUse = nodeData.parentId;
          
          if (nodeData.parentId === oldRootId) {
            // Parent is the old root, use new root ID
            parentIdToUse = rootId;
          } else if (nodeIdMapping.has(nodeData.parentId)) {
            // Use mapped parent ID
            parentIdToUse = nodeIdMapping.get(nodeData.parentId);
          } else {
            console.warn(`Parent node ${nodeData.parentId.substring(0, 8)} not found in mapping for node ${i + 1}`);
            failureCount++;
            continue; // Skip this node
          }
          
          // Add small delay between transactions to avoid nonce conflicts
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          // Use addNodeForUser if userAccount is provided, otherwise use addNode  
          const tx = userAccount && userAccount !== "0x0000000000000000000000000000000000000000"
            ? await treeContract.addNodeForUser(parentIdToUse, nodeData.content, userAccount)
            : await treeContract.addNode(parentIdToUse, nodeData.content);
          const receipt = await tx.wait();
          
          // Find the NodeCreated event to get the new node ID
          const nodeCreatedEvent = receipt.logs.find(log => {
            try {
              const parsed = treeContract.interface.parseLog(log);
              return parsed.name === 'NodeCreated';
            } catch {
              return false;
            }
          });
          
          if (nodeCreatedEvent) {
            const parsedEvent = treeContract.interface.parseLog(nodeCreatedEvent);
            const newNodeId = parsedEvent.args.nodeId;
            
            // Store mapping for future children
            nodeIdMapping.set(nodeData.nodeId, newNodeId);
            
            const broadcastData = {
              nodeId: newNodeId,
              parentId: parsedEvent.args.parentId,
              content: parsedEvent.args.content,
              author: parsedEvent.args.author,
              timestamp: Number(parsedEvent.args.timestamp),
              treeAddress: treeAddress
            };
            
            // Emit to all connected clients
            io.emit('nodeCreated', broadcastData);
            successCount++;
          } else {
            console.error('NodeCreated event not found in receipt');
            failureCount++;
          }
        } catch (error) {
          console.error(`Error importing node ${i + 1}:`, error.message);
          failureCount++;
        }
      }
      
      socket.emit('importComplete', {
        success: true,
        message: `Import completed: ${successCount} successful, ${failureCount} failed`,
        successCount,
        failureCount,
        totalNodes: sortedNodes.length
      });
      
    } catch (error) {
      console.error('Error in importNodes:', error);
      socket.emit('importComplete', {
        success: false,
        error: error.message
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// REST API endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/generate', async (req, res) => {
  try {
    const { prompt, provider = 'openai', maxTokens = 150 } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    
    const generatedText = await generateText(prompt, provider);
    
    res.json({
      success: true,
      generatedText,
      provider,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in /api/generate:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Listen for blockchain events
async function setupBlockchainListeners() {
  try {
    // Listen for TreeCreated events
    factory.on('TreeCreated', (treeId, treeAddress, creator, rootContent) => {
      console.log('TreeCreated event:', { treeId, treeAddress, creator, rootContent });
      io.emit('treeCreated', {
        treeId,
        treeAddress,
        creator,
        rootContent,
        timestamp: Date.now()
      });
    });
    
    console.log('Blockchain event listeners set up successfully');
  } catch (error) {
    console.error('Error setting up blockchain listeners:', error);
  }
}

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 Blockchain Loom Backend running on port ${PORT}`);
  console.log(`📡 Socket.IO server ready for connections`);
  console.log(`🔗 Connected to blockchain at ${process.env.RPC_URL || 'http://localhost:8545'}`);
  
  setupBlockchainListeners();
});