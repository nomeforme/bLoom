require('dotenv').config();

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

  'h-405': {
    name: 'H-405',
    id: 'nousresearch/hermes-3-llama-3.1-405b',
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

module.exports = {
  LLM_CONFIG
};