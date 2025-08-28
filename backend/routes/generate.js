const express = require('express');
const { generateText } = require('../services/textGeneration');
const { LLM_CONFIG } = require('../config/llm');
const router = express.Router();

// Enhanced generate endpoint with model selection
router.post('/', async (req, res) => {
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
    const result = await generateText(prompt, model, temperature, maxTokens);
    const generationTime = Date.now() - startTime;
    
    // Handle both old string format and new object format for backward compatibility
    const generatedText = typeof result === 'string' ? result : result?.text;
    const completionTokens = typeof result === 'object' ? (result?.completionTokens || 0) : 0;
    
    if (generatedText) {
      console.log(`✅ /api/generate successful:`, {
        model,
        generationTimeMs: generationTime,
        responseLength: generatedText.length,
        responseWords: generatedText.split(/\s+/).length,
        completionTokens: completionTokens,
        responsePreview: generatedText.substring(0, 100) + (generatedText.length > 100 ? '...' : '')
      });
      
      res.json({
        success: true,
        generatedText,
        completionTokens,
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

module.exports = router;