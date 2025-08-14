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
  "function getNode(bytes32 nodeId) external view returns (bytes32 id, bytes32 parentId, bytes32[] memory children, address author, uint256 timestamp, bool isRoot)",
  "function getAllNodes() external view returns (bytes32[] memory)",
  "function getRootId() external view returns (bytes32)",
  "function getNodeCount() external view returns (uint256)",
  "event NodeCreated(bytes32 indexed nodeId, bytes32 indexed parentId, address indexed author, uint256 timestamp)",
  "event NodeUpdated(bytes32 indexed nodeId, address indexed author)"
];

const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, wallet);

// Enhanced LLM Configuration with multiple providers
const LLM_CONFIG = {
  // OpenAI Models
  'gpt-4o': {
    name: 'GPT-4o',
    id: 'gpt-4o',
    provider: 'openai',
    baseURL: 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY,
    maxTokens: 4000,
    defaultTemp: 0.8
  },
  'gpt-5': {
    name: 'GPT-5',
    id: 'gpt-5',
    provider: 'openai',
    baseURL: 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY,
    maxTokens: 4000,
    defaultTemp: 0.8
  },
  
  // Anthropic Models
  'claude-3-7-sonnet': {
    name: 'Claude 3.7 Sonnet',
    id: 'claude-3-7-sonnet-20250219',
    provider: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY,
    maxTokens: 4000,
    defaultTemp: 0.8
  },

  'claude-3-5-sonnet': {
    name: 'Claude 3.5 Sonnet',
    id: 'claude-3-5-sonnet-20240620',
    provider: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY,
    maxTokens: 4000,
    defaultTemp: 0.8
  },

  'claude-sonnet-4': {
    name: 'Claude Sonnet 4',
    id: 'claude-sonnet-4-20250514',
    provider: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY,
    maxTokens: 4000,
    defaultTemp: 0.8
  },

  'claude-opus-4': {
    name: 'Claude Opus 4',
    id: 'claude-opus-4-20250514',
    provider: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY,
    maxTokens: 4000,
    defaultTemp: 0.8
  },

  'claude-opus-4-1': {
    name: 'Claude Opus 4.1',
    id: 'claude-opus-4-1-20250805',
    provider: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY,
    maxTokens: 4000,
    defaultTemp: 0.8
  },

  'claude-3-opus': {
    name: 'Claude 3 Opus',
    id: 'claude-3-opus-20240229',
    provider: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY,
    maxTokens: 4000,
    defaultTemp: 0.7
  },

  'claude-3-sonnet': {
    name: 'Claude 3 Sonnet',
    id: 'claude-3-sonnet-20240229',
    provider: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY,
    maxTokens: 4000,
    defaultTemp: 0.7
  },

  'claude-3-haiku': {
    name: 'Claude 3 Haiku',
    id: 'claude-3-haiku-20240307',
    provider: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY,
    maxTokens: 4000,
    defaultTemp: 0.7
  },
  
  // DeepSeek via Chutes API
  'deepseek-v3': {
    name: 'DeepSeek V3',
    id: 'deepseek-ai/DeepSeek-V3-Base',
    provider: 'openai', // Uses OpenAI-compatible API
    baseURL: 'https://llm.chutes.ai/v1/',
    apiKey: process.env.CHUTES_API_KEY,
    maxTokens: 4000,
    defaultTemp: 0.7
  },
  
  // Meta Llama via OpenRouter
  'llama-3.1-405b': {
    name: 'Llama 3.1 405B',
    id: 'meta-llama/llama-3.1-405b',
    provider: 'openai', // Uses OpenAI-compatible API
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    maxTokens: 4000,
    defaultTemp: 0.7
  },

  'z-ai/glm-4.5': {
    name: 'GLM 4.5',
    id: 'z-ai/glm-4.5',
    provider: 'openai',
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    maxTokens: 4000,
    defaultTemp: 0.7
  },

  'kimi-k2': {
    name: 'Kimi K2',
    id: 'moonshotai/kimi-k2',
    provider: 'openai',
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
  },
  
  // Local models
  'local': {
    name: 'Local Model',
    id: 'local-model',
    provider: 'openai', // Uses OpenAI-compatible API
    baseURL: process.env.LOCAL_LLM_URL || 'http://localhost:1234/v1',
    apiKey: 'local',
    maxTokens: 2000,
    defaultTemp: 0.8
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

// Enhanced text generation function with multiple providers
async function generateText(prompt, modelKey = 'claude-3-haiku', temperature, maxTokens) {
  try {
    const modelConfig = LLM_CONFIG[modelKey];
    if (!modelConfig) {
      throw new Error(`Unknown model: ${modelKey}`);
    }

    if (!modelConfig.apiKey || modelConfig.apiKey === '' || modelConfig.apiKey === 'your-api-key-here') {
      throw new Error(`API key not configured for model: ${modelKey}`);
    }

    const finalTemp = temperature || modelConfig.defaultTemp;
    const finalMaxTokens = maxTokens || Math.min(modelConfig.maxTokens, 200); // Cap at 200 for story generation

    console.log(`🤖 Generating text with ${modelConfig.name} (${modelConfig.id})`);
    console.log(`📊 Temperature: ${finalTemp}, Max Tokens: ${finalMaxTokens}`);
    console.log(`🔑 API Key configured:`, !!modelConfig.apiKey && modelConfig.apiKey !== 'your-api-key-here');

    let response;
    
    if (modelConfig.provider === 'anthropic') {
      // Anthropic API
      console.log(`📤 Sending request to Anthropic API for model: ${modelConfig.id}`);
      console.log(`📝 Prompt (first 200 chars): "${prompt.substring(0, 200)}${prompt.length > 200 ? '...' : ''}"`);
      
      response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: modelConfig.id,
          max_tokens: finalMaxTokens,
          temperature: finalTemp,
          messages: [{ role: 'user', content: prompt }]
        },
        {
          headers: {
            'x-api-key': modelConfig.apiKey,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01'
          }
        }
      );
      
      console.log(`📥 Anthropic API Response received:`, {
        status: response.status,
        model: response.data.model,
        stopReason: response.data.stop_reason,
        usage: response.data.usage
      });
      
      const generatedText = response.data.content[0].text.trim();
      console.log(`✅ Generated text from Anthropic:`, {
        length: generatedText.length,
        words: generatedText.split(/\s+/).length,
        preview: generatedText.substring(0, 100) + (generatedText.length > 100 ? '...' : ''),
        fullText: generatedText
      });
      return generatedText;
      
    } else if (modelConfig.provider === 'openai') {
      // OpenAI-compatible API (covers OpenAI, DeepSeek via Chutes, Llama via OpenRouter, Local)
      const isCompletionModel = modelConfig.id.includes('gpt-4-base') || modelConfig.id.includes('deepseek') || modelKey === 'local';
      
      if (isCompletionModel) {
        // Use completions endpoint for base models
        console.log(`📤 Sending request to OpenAI-compatible completions API: ${modelConfig.baseURL}`);
        console.log(`📝 Prompt (first 200 chars): "${prompt.substring(0, 200)}${prompt.length > 200 ? '...' : ''}"`);
        
        response = await axios.post(
          `${modelConfig.baseURL}/completions`,
          {
            model: modelConfig.id,
            prompt: prompt,
            max_tokens: finalMaxTokens,
            temperature: finalTemp,
            stop: ['\n\n', '\n###', 'Human:', 'Assistant:']
          },
          {
            headers: {
              'Authorization': `Bearer ${modelConfig.apiKey}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        console.log(`📥 Completions API Response received:`, {
          status: response.status,
          model: response.data.model,
          choices: response.data.choices?.length,
          usage: response.data.usage,
          finishReason: response.data.choices?.[0]?.finish_reason
        });
        
        const generatedText = response.data.choices[0].text.trim();
        console.log(`✅ Generated text from completions API:`, {
          length: generatedText.length,
          words: generatedText.split(/\s+/).length,
          preview: generatedText.substring(0, 100) + (generatedText.length > 100 ? '...' : ''),
          fullText: generatedText
        });
        return generatedText;
      } else {
        // Use chat completions endpoint for chat models
        console.log(`📤 Sending request to OpenAI-compatible chat API: ${modelConfig.baseURL}`);
        console.log(`📝 Prompt (first 200 chars): "${prompt.substring(0, 200)}${prompt.length > 200 ? '...' : ''}"`);
        
        response = await axios.post(
          `${modelConfig.baseURL}/chat/completions`,
          {
            model: modelConfig.id,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: finalMaxTokens,
            temperature: finalTemp
          },
          {
            headers: {
              'Authorization': `Bearer ${modelConfig.apiKey}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        console.log(`📥 Chat API Response received:`, {
          status: response.status,
          model: response.data.model,
          choices: response.data.choices?.length,
          usage: response.data.usage,
          finishReason: response.data.choices?.[0]?.finish_reason
        });
        
        const generatedText = response.data.choices[0].message.content.trim();
        console.log(`✅ Generated text from chat API:`, {
          length: generatedText.length,
          words: generatedText.split(/\s+/).length,
          preview: generatedText.substring(0, 100) + (generatedText.length > 100 ? '...' : ''),
          fullText: generatedText
        });
        return generatedText;
      }
    }
    
    throw new Error(`Unsupported provider: ${modelConfig.provider}`);
    
  } catch (error) {
    console.error(`❌ Error generating text with ${modelKey}:`, error.message);
    return null;
  }
}

// Socket.IO event handlers
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('generateSiblings', async (data) => {
    const { treeAddress, parentId, parentContent, count = 3, userAccount, model = 'claude-3-haiku', temperature, maxTokens } = data;
    
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
          // Use specified model (no more auto mode)
          const selectedModel = model || 'claude-3-haiku';
          const generatedText = await generateText(contextContent, selectedModel, temperature, maxTokens);
          console.log(`🔍 Generation ${i + 1}/${count} result:`, {
            model: selectedModel,
            hasText: !!generatedText,
            length: generatedText?.length || 0,
            words: generatedText ? generatedText.split(/\s+/).length : 0,
            firstChars: generatedText?.substring(0, 50) || 'null/empty'
          });
          
          if (generatedText && generatedText.trim()) {
            generations.push(generatedText.trim());
            console.log(`✅ Added generation ${i + 1} to array:`, {
              totalGenerations: generations.length,
              textLength: generatedText.trim().length,
              promptUsed: contextContent.substring(0, 100) + '...'
            });
          } else {
            console.error(`❌ Empty response generating text ${i + 1} with model ${selectedModel}`);
            // Skip this generation - don't add to generations array
          }
        } catch (error) {
          console.error(`Error generating text ${i + 1}:`, error.message);
          // Skip this generation - don't add placeholder
        }
      }
      
      // Add generated nodes to blockchain sequentially to avoid nonce conflicts
      let successCount = 0;
      console.log(`🔗 Starting blockchain node creation for ${generations.length} generated texts`);
      
      for (let i = 0; i < generations.length; i++) {
        const content = generations[i];
        console.log(`🔗 Creating node ${i + 1}/${generations.length}:`, {
          contentLength: content.length,
          hasUserAccount: !!userAccount,
          userAccount: userAccount
        });
        
        try {
          // Add small delay between transactions to avoid nonce conflicts
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          // Use addNodeForUser if userAccount is provided, otherwise use addNode
          const tx = userAccount && userAccount !== "0x0000000000000000000000000000000000000000" 
            ? await treeContract.addNodeForUser(parentId, content, userAccount)
            : await treeContract.addNode(parentId, content);
          
          console.log(`📝 Transaction sent for node ${i + 1}, waiting for receipt...`);
          const receipt = await tx.wait();
          
          console.log(`📄 Receipt for node ${i + 1}:`, {
            status: receipt.status,
            gasUsed: receipt.gasUsed?.toString(),
            logs: receipt.logs?.length || 0,
            transactionHash: receipt.transactionHash || receipt.hash,
            blockNumber: receipt.blockNumber,
            receiptStructure: Object.keys(receipt)
          });
          
          // Log all events for debugging
          console.log(`🔍 Looking for NodeCreated event signature: ${ethers.id('NodeCreated(bytes32,bytes32,address,uint256)')}`);
          
          receipt.logs.forEach((log, index) => {
            try {
              const parsed = treeContract.interface.parseLog(log);
              console.log(`📝 Event ${index}:`, parsed.name, parsed.args);
            } catch (e) {
              // Only log as unparseable if it's from our tree contract
              if (log.address && log.address.toLowerCase() === treeAddress.toLowerCase()) {
                console.log(`📝 Unparseable log ${index} from tree contract:`, {
                  address: log.address,
                  topic0: log.topics?.[0],
                  allTopics: log.topics,
                  error: e.message
                });
              } else {
                console.log(`📝 Log ${index} from other contract (${log.address}) - skipping`);
              }
            }
          });
          
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
              content: content, // Use the original content, not from event (event doesn't include content)
              author: parsedEvent.args.author,
              timestamp: Number(parsedEvent.args.timestamp),
              treeAddress: treeAddress
            };
            
            console.log(`✅ Node ${i + 1} created successfully:`, {
              nodeId: nodeData.nodeId.substring(0, 10) + '...',
              author: nodeData.author,
              contentLength: nodeData.content.length
            });
            
            // Emit to all connected clients
            console.log(`📡 Emitting nodeCreated event to ${io.engine.clientsCount} clients`);
            io.emit('nodeCreated', nodeData);
            successCount++;
          } else {
            console.error(`❌ No NodeCreated event found for node ${i + 1}`);
          }
        } catch (error) {
          console.error(`❌ Error adding node ${i + 1} to blockchain:`, {
            error: error.message,
            stack: error.stack?.substring(0, 200),
            nodeIndex: i + 1,
            totalNodes: generations.length
          });
        }
      }
      
      console.log(`🔗 Blockchain node creation complete: ${successCount}/${generations.length} successful`);
      
      const failedCount = count - successCount;
      const response = {
        success: successCount > 0,
        successCount,
        failedCount,
        totalRequested: count,
        message: successCount > 0 ? 
          `Generated ${successCount}/${count} sibling nodes successfully` :
          'All generation attempts failed'
      };

      // Only add warnings if SOME (not all) generations failed
      if (failedCount > 0 && successCount > 0) {
        response.warnings = [`${failedCount} generation${failedCount > 1 ? 's' : ''} failed or returned empty responses`];
      }

      console.log(`📡 Sending generationComplete to socket ${socket.id}:`, response);
      
      // Emit to the requesting socket
      socket.emit('generationComplete', response);
      
      // Also emit to all connected clients as backup
      console.log(`📡 Broadcasting generationComplete to all ${io.engine.clientsCount} clients`);
      io.emit('generationComplete', response);
      
    } catch (error) {
      console.error('Error in generateSiblings:', {
        error: error.message,
        stack: error.stack?.substring(0, 300),
        socketId: socket.id
      });
      
      const errorResponse = {
        success: false,
        error: error.message,
        successCount: 0,
        failedCount: count,
        totalRequested: count
      };
      
      // Emit to the requesting socket
      socket.emit('generationComplete', errorResponse);
      
      // Also broadcast to all clients as backup
      console.log(`📡 Broadcasting error response to all ${io.engine.clientsCount} clients`);
      io.emit('generationComplete', errorResponse);
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

// Get available models
app.get('/api/models', (req, res) => {
  const models = Object.keys(LLM_CONFIG).map(key => ({
    id: key,
    name: LLM_CONFIG[key].name,
    provider: LLM_CONFIG[key].provider,
    maxTokens: LLM_CONFIG[key].maxTokens,
    defaultTemp: LLM_CONFIG[key].defaultTemp,
    available: !!(LLM_CONFIG[key].apiKey && LLM_CONFIG[key].apiKey !== '' && LLM_CONFIG[key].apiKey !== 'your-api-key-here')
  }));
  
  res.json({
    success: true,
    models,
    timestamp: new Date().toISOString()
  });
});

// Enhanced generate endpoint with model selection
app.post('/api/generate', async (req, res) => {
  try {
    const { prompt, model = 'claude-3-haiku', temperature, maxTokens } = req.body;
    
    console.log(`📨 /api/generate request received:`, {
      model,
      temperature,
      maxTokens,
      promptLength: prompt?.length || 0,
      promptPreview: prompt ? prompt.substring(0, 100) + (prompt.length > 100 ? '...' : '') : 'no prompt'
    });
    
    if (!prompt) {
      console.error('❌ /api/generate: No prompt provided');
      return res.status(400).json({ error: 'Prompt is required' });
    }
    
    const startTime = Date.now();
    const generatedText = await generateText(prompt, model, temperature, maxTokens);
    const generationTime = Date.now() - startTime;
    
    if (generatedText) {
      console.log(`✅ /api/generate successful:`, {
        model,
        generationTimeMs: generationTime,
        responseLength: generatedText.length,
        responseWords: generatedText.split(/\s+/).length,
        responsePreview: generatedText.substring(0, 100) + (generatedText.length > 100 ? '...' : '')
      });
      
      res.json({
        success: true,
        generatedText,
        model: model,
        modelName: LLM_CONFIG[model]?.name || model,
        timestamp: new Date().toISOString()
      });
    } else {
      console.error(`❌ /api/generate failed: No text generated from model ${model}`);
      res.status(500).json({
        success: false,
        error: 'Failed to generate text from model'
      });
    }
  } catch (error) {
    console.error('❌ Error in /api/generate:', {
      error: error.message,
      stack: error.stack?.substring(0, 500)
    });
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