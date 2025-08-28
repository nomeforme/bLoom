const express = require('express');
const { LLM_CONFIG } = require('../config/llm');
const router = express.Router();

// Get available models
router.get('/', (req, res) => {
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

module.exports = router;