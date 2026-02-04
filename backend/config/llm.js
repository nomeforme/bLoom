require('dotenv').config();

// Enhanced LLM Configuration with multiple providers
const LLM_CONFIG = {
  // OpenAI Models
  'gpt-4o': {
    name: 'GPT-4o (OpenAI)',
    id: 'gpt-4o',
    provider: 'openai',
    baseURL: 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY,
    maxTokens: 4000,
    defaultTemp: 0.8
  },
  'gpt-5': {
    name: 'GPT-5 (OpenAI)',
    id: 'gpt-5',
    provider: 'openai',
    baseURL: 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY,
    maxTokens: 4000,
    defaultTemp: 0.8
  },
  'davinci-002': {
    name: 'Davinci 002 (OpenAI)',
    id: 'davinci-002',
    provider: 'openai',
    baseURL: 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY,
    maxTokens: 4096,
    defaultTemp: 1
  },

  // Anthropic Models
  'claude-3-7-sonnet': {
    name: 'Claude 3.7 Sonnet (Anthropic)',
    id: 'claude-3-7-sonnet-20250219',
    provider: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY,
    maxTokens: 4000,
    defaultTemp: 0.8
  },

  'claude-3-5-sonnet': {
    name: 'Claude 3.5 Sonnet (Anthropic)',
    id: 'claude-3-5-sonnet-20240620',
    provider: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY,
    maxTokens: 4000,
    defaultTemp: 0.8
  },

  'claude-sonnet-4': {
    name: 'Claude Sonnet 4 (Anthropic)',
    id: 'claude-sonnet-4-20250514',
    provider: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY,
    maxTokens: 4000,
    defaultTemp: 0.8
  },

  'claude-opus-4': {
    name: 'Claude Opus 4 (Anthropic)',
    id: 'claude-opus-4-20250514',
    provider: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY,
    maxTokens: 4000,
    defaultTemp: 0.8
  },

  'claude-opus-4-1': {
    name: 'Claude Opus 4.1 (Anthropic)',
    id: 'claude-opus-4-1-20250805',
    provider: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY,
    maxTokens: 4000,
    defaultTemp: 0.8
  },

  'claude-haiku-4-5': {
    name: 'Claude Haiku 4.5 (Anthropic)',
    id: 'claude-haiku-4-5-20251101',
    provider: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY,
    maxTokens: 4000,
    defaultTemp: 0.8
  },

  'claude-sonnet-4-5': {
    name: 'Claude Sonnet 4.5 (Anthropic)',
    id: 'claude-sonnet-4-5-20251101',
    provider: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY,
    maxTokens: 4000,
    defaultTemp: 0.8
  },

  'claude-opus-4-5': {
    name: 'Claude Opus 4.5 (Anthropic)',
    id: 'claude-opus-4-5-20251101',
    provider: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY,
    maxTokens: 4000,
    defaultTemp: 0.8
  },

  'claude-3-opus': {
    name: 'Claude 3 Opus (Anthropic)',
    id: 'claude-3-opus-20240229',
    provider: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY,
    maxTokens: 4000,
    defaultTemp: 0.7
  },

  'claude-3-sonnet': {
    name: 'Claude 3 Sonnet (Anthropic)',
    id: 'claude-3-sonnet-20240229',
    provider: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY,
    maxTokens: 4000,
    defaultTemp: 0.7
  },

  'claude-3-haiku': {
    name: 'Claude 3 Haiku (Anthropic)',
    id: 'claude-3-haiku-20240307',
    provider: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY,
    maxTokens: 4000,
    defaultTemp: 0.7
  },
  
  // DeepSeek via OpenRouter
  'deepseek-v3': {
    name: 'DeepSeek V3 (OpenRouter)',
    id: 'deepseek/deepseek-v3-base',
    provider: 'openai', // Uses OpenAI-compatible API
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    maxTokens: 4000,
    defaultTemp: 0.7
  },
  
  // Meta Llama via OpenRouter
  'llama-3.1-405b': {
    name: 'Llama 3.1 405B (OpenRouter)',
    id: 'meta-llama/llama-3.1-405b',
    provider: 'openai', // Uses OpenAI-compatible API
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    maxTokens: 4000,
    defaultTemp: 0.7
  },

  'z-ai/glm-4.5': {
    name: 'GLM 4.5 (OpenRouter)',
    id: 'z-ai/glm-4.5',
    provider: 'openai',
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    maxTokens: 4000,
    defaultTemp: 0.7
  },

  'kimi-k2': {
    name: 'Kimi K2 (OpenRouter)',
    id: 'moonshotai/kimi-k2',
    provider: 'openai',
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
  },

  'h-405': {
    name: 'H-405 (OpenRouter)',
    id: 'nousresearch/hermes-3-llama-3.1-405b',
    provider: 'openai',
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
  },
  
  // Amazon Bedrock Claude Models
  'claude-opus-4-1-bedrock': {
    name: 'Claude Opus 4.1 (Bedrock)',
    id: 'anthropic.claude-opus-4-1-20250805-v1:0',
    provider: 'bedrock',
    awsAccessKey: process.env.AWS_ACCESS_KEY_ID,
    awsSecretKey: process.env.AWS_SECRET_ACCESS_KEY,
    awsRegion: process.env.AWS_REGION || 'us-east-1',
    maxTokens: 4000,
    defaultTemp: 0.7
  },

  'claude-sonnet-4-bedrock': {
    name: 'Claude Sonnet 4 (Bedrock)',
    id: 'anthropic.claude-sonnet-4-20250514-v1:0',
    provider: 'bedrock',
    awsAccessKey: process.env.AWS_ACCESS_KEY_ID,
    awsSecretKey: process.env.AWS_SECRET_ACCESS_KEY,
    awsRegion: process.env.AWS_REGION || 'us-east-1',
    maxTokens: 4000,
    defaultTemp: 0.7
  },

  'claude-3-7-sonnet-bedrock': {
    name: 'Claude 3.7 Sonnet (Bedrock)',
    id: 'anthropic.claude-3-7-sonnet-20250219-v1:0',
    provider: 'bedrock',
    awsAccessKey: process.env.AWS_ACCESS_KEY_ID,
    awsSecretKey: process.env.AWS_SECRET_ACCESS_KEY,
    awsRegion: process.env.AWS_REGION || 'us-east-1',
    maxTokens: 4000,
    defaultTemp: 0.7
  },

  'claude-3-5-sonnet-bedrock': {
    name: 'Claude 3.5 Sonnet (Bedrock)',
    id: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
    provider: 'bedrock',
    awsAccessKey: process.env.AWS_ACCESS_KEY_ID,
    awsSecretKey: process.env.AWS_SECRET_ACCESS_KEY,
    awsRegion: process.env.AWS_REGION || 'us-east-1',
    maxTokens: 4000,
    defaultTemp: 0.7
  },

  'claude-3-5-haiku-bedrock': {
    name: 'Claude 3.5 Haiku (Bedrock)',
    id: 'anthropic.claude-3-5-haiku-20241022-v1:0',
    provider: 'bedrock',
    awsAccessKey: process.env.AWS_ACCESS_KEY_ID,
    awsSecretKey: process.env.AWS_SECRET_ACCESS_KEY,
    awsRegion: process.env.AWS_REGION || 'us-east-1',
    maxTokens: 4000,
    defaultTemp: 0.7
  },

  'claude-3-opus-bedrock': {
    name: 'Claude 3 Opus (Bedrock)',
    id: 'anthropic.claude-3-opus-20240229-v1:0',
    provider: 'bedrock',
    awsAccessKey: process.env.AWS_ACCESS_KEY_ID,
    awsSecretKey: process.env.AWS_SECRET_ACCESS_KEY,
    awsRegion: process.env.AWS_REGION || 'us-east-1',
    maxTokens: 4000,
    defaultTemp: 0.7
  },

  'claude-3-sonnet-bedrock': {
    name: 'Claude 3 Sonnet (Bedrock)',
    id: 'anthropic.claude-3-sonnet-20240229-v1:0',
    provider: 'bedrock',
    awsAccessKey: process.env.AWS_ACCESS_KEY_ID,
    awsSecretKey: process.env.AWS_SECRET_ACCESS_KEY,
    awsRegion: process.env.AWS_REGION || 'us-east-1',
    maxTokens: 4000,
    defaultTemp: 0.7
  },

  'claude-3-haiku-bedrock': {
    name: 'Claude 3 Haiku (Bedrock)',
    id: 'anthropic.claude-3-haiku-20240307-v1:0',
    provider: 'bedrock',
    awsAccessKey: process.env.AWS_ACCESS_KEY_ID,
    awsSecretKey: process.env.AWS_SECRET_ACCESS_KEY,
    awsRegion: process.env.AWS_REGION || 'us-east-1',
    maxTokens: 4000,
    defaultTemp: 0.7
  },
  
  // Local models
  'local': {
    name: 'Local Model (Local)',
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