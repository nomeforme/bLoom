// Simple IPFS utilities for backend communication
import { getEnvironmentConfig } from './envConfig';

const { backendUrl: API_BASE } = getEnvironmentConfig();

// Check if content is an IPFS hash reference
export const isIPFSReference = (content) => {
  return typeof content === 'string' && content.startsWith('ipfs:');
};

// Extract IPFS hash from content reference
export const extractIPFSHash = (content) => {
  if (isIPFSReference(content)) {
    return content.substring(5); // Remove 'ipfs:' prefix
  }
  return null;
};

// Pin text to IPFS via backend
export const pinTextToIPFS = async (text, options = {}) => {
  try {
    const response = await fetch(`${API_BASE}/api/ipfs/pin/text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        metadata: {
          name: options.name || `loom-node-${Date.now()}`,
          treeAddress: options.treeAddress,
          parentId: options.parentId,
          custom: options.metadata || {}
        }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to pin text to IPFS');
    }

    const result = await response.json();
    return result.hash;
  } catch (error) {
    console.error('Failed to pin text to IPFS:', error);
    throw error;
  }
};

// Get text from IPFS via backend
export const getTextFromIPFS = async (hash) => {
  try {
    const response = await fetch(`${API_BASE}/api/ipfs/get/${hash}/text`);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to retrieve text from IPFS');
    }

    const result = await response.json();
    return result.text;
  } catch (error) {
    console.error('Failed to retrieve text from IPFS:', error);
    throw error;
  }
};

// Resolve content that might be an IPFS reference
export const resolveNodeContent = async (content) => {
  if (!content) return content;
  
  if (isIPFSReference(content)) {
    const hash = extractIPFSHash(content);
    try {
      return await getTextFromIPFS(hash);
    } catch (error) {
      console.error('Failed to resolve IPFS content:', error);
      return `[IPFS Error: ${error.message}]`;
    }
  }
  
  return content;
};

// Check if IPFS service is available on backend
export const checkIPFSAvailability = async () => {
  try {
    const response = await fetch(`${API_BASE}/api/ipfs/health`);
    const health = await response.json();
    return health.status === 'healthy';
  } catch (error) {
    console.warn('IPFS service unavailable:', error.message);
    return false;
  }
};