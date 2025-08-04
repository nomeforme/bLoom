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
  "function getNode(bytes32 nodeId) external view returns (bytes32 id, bytes32 parentId, string memory content, bytes32[] memory children, address author, uint256 timestamp, bool isRoot)",
  "function getAllNodes() external view returns (bytes32[] memory)",
  "function getRootId() external view returns (bytes32)",
  "event NodeCreated(bytes32 indexed nodeId, bytes32 indexed parentId, string content, address indexed author, uint256 timestamp)"
];

const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, wallet);

// LLM Configuration
const LLM_CONFIG = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-3.5-turbo'
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
    const { treeAddress, parentId, count = 3 } = data;
    
    try {
      console.log('Generating siblings for parent:', parentId, 'count:', count);
      
      // Get the tree contract
      const treeContract = new ethers.Contract(treeAddress, TREE_ABI, wallet);
      
      // Get parent node content for context
      let parentContent = '';
      if (parentId !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
        const parentNode = await treeContract.getNode(parentId);
        parentContent = parentNode[2]; // content is at index 2
      }
      
      // Generate text continuations
      const generations = [];
      for (let i = 0; i < count; i++) {
        try {
          const prompt = parentContent ? 
            `Continue this story with a new branch:\n\n${parentContent}\n\nWrite a short continuation (1-2 sentences):` :
            'Write the beginning of an interesting story (1-2 sentences):';
          
          const generatedText = await generateText(prompt, 'openai');
          generations.push(generatedText);
        } catch (error) {
          console.error(`Error generating text ${i + 1}:`, error);
          generations.push(`Generated branch ${i + 1}: [AI generation failed, using placeholder]`);
        }
      }
      
      // Add generated nodes to blockchain
      const nodePromises = generations.map(async (content, index) => {
        try {
          console.log(`Adding generated node ${index + 1}:`, content.substring(0, 50) + '...');
          const tx = await treeContract.addNode(parentId, content);
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
            console.log('Node created and broadcasted:', nodeData.nodeId);
          }
          
          return receipt;
        } catch (error) {
          console.error(`Error adding node ${index + 1} to blockchain:`, error);
          throw error;
        }
      });
      
      // Wait for all nodes to be added
      await Promise.allSettled(nodePromises);
      
      socket.emit('generationComplete', {
        success: true,
        message: `Generated ${count} sibling nodes`
      });
      
    } catch (error) {
      console.error('Error in generateSiblings:', error);
      socket.emit('generationComplete', {
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