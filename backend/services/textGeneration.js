const axios = require('axios');
const { LLM_CONFIG } = require('../config/llm');

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
      const completionTokens = response.data.usage?.output_tokens || 0;
      console.log(`✅ Generated text from Anthropic:`, {
        length: generatedText.length,
        words: generatedText.split(/\s+/).length,
        completionTokens: completionTokens,
        preview: generatedText.substring(0, 100) + (generatedText.length > 100 ? '...' : ''),
        fullText: generatedText
      });
      return { text: generatedText, completionTokens };
      
    } else if (modelConfig.provider === 'openai') {
      // OpenAI-compatible API (covers OpenAI, DeepSeek via Chutes, Llama via OpenRouter, Local)
      const isBaseModel = modelConfig.id.includes('gpt-4-base') || modelConfig.id.includes('deepseek') || modelConfig.id.includes('meta-llama') || modelKey === 'local';
      
      if (isBaseModel) {
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
        const completionTokens = response.data.usage?.completion_tokens || 0;
        console.log(`✅ Generated text from completions API:`, {
          length: generatedText.length,
          words: generatedText.split(/\s+/).length,
          completionTokens: completionTokens,
          preview: generatedText.substring(0, 100) + (generatedText.length > 100 ? '...' : ''),
          fullText: generatedText
        });
        return { text: generatedText, completionTokens };
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
        const completionTokens = response.data.usage?.completion_tokens || 0;
        console.log(`✅ Generated text from chat API:`, {
          length: generatedText.length,
          words: generatedText.split(/\s+/).length,
          completionTokens: completionTokens,
          preview: generatedText.substring(0, 100) + (generatedText.length > 100 ? '...' : ''),
          fullText: generatedText
        });
        return { text: generatedText, completionTokens };
      }
    }
    
    throw new Error(`Unsupported provider: ${modelConfig.provider}`);
    
  } catch (error) {
    console.error(`❌ Error generating text with ${modelKey}:`, error.message);
    return null;
  }
}

module.exports = {
  generateText
};