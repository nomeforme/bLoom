const express = require('express');
const { LLM_CONFIG } = require('../config/llm');
const router = express.Router();

// Get available models
router.get('/', (req, res) => {
  const models = Object.keys(LLM_CONFIG).map(key => {
    const config = LLM_CONFIG[key];
    let available = false;
    
    if (config.provider === 'bedrock') {
      // For Bedrock models, check AWS credentials
      available = !!(config.awsAccessKey && config.awsAccessKey !== '' && 
                    config.awsSecretKey && config.awsSecretKey !== '');
    } else {
      // For other models, check API key
      available = !!(config.apiKey && config.apiKey !== '' && config.apiKey !== 'your-api-key-here');
    }
    
    return {
      id: key,
      name: config.name,
      provider: config.provider,
      maxTokens: config.maxTokens,
      defaultTemp: config.defaultTemp,
      available
    };
  });
  
  res.json({
    success: true,
    models,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;