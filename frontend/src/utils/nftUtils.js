// NFT data processing utilities
export const createNFTObject = (nodeData, nftData = null) => {
  const baseNFT = {
    tokenId: nodeData.tokenId,
    nodeId: nodeData.nodeId,
    owner: nodeData.author,
    tokenBoundAccount: nodeData.tokenBoundAccount,
    nodeTokenContract: nodeData.nodeTokenContract
  };

  if (nftData) {
    return {
      ...baseNFT,
      content: nftData.content || nodeData.originalContent || nodeData.content,
      latestContent: nftData.latestContent,
      tokenSupply: nftData.tokenSupply
    };
  }

  return {
    ...baseNFT,
    content: nodeData.originalContent || nodeData.content
  };
};

export const shouldFetchNFTData = (selectedNode) => {
  return selectedNode && 
         selectedNode.hasNFT && 
         (selectedNode.tokenBoundAccount || selectedNode.nodeTokenContract);
};

export const formatTokenSupply = (tokenSupply, fallback = '1000') => {
  if (tokenSupply === null || tokenSupply === undefined) {
    return fallback;
  }
  
  // Handle BigInt conversion
  if (typeof tokenSupply === 'bigint') {
    return tokenSupply.toString();
  }
  
  return String(tokenSupply);
};

// Parse NFT metadata with improved error handling
export const parseNFTMetadata = (content) => {
  if (!content || typeof content !== 'string') {
    return {};
  }

  try {
    // First attempt: Direct JSON parse
    const parsed = JSON.parse(content);
    return cleanMetadataObject(parsed);
  } catch (firstError) {
    // Second attempt: Fix common JSON issues
    try {
      const fixedContent = fixCommonJSONIssues(content);
      const parsed = JSON.parse(fixedContent);
      return cleanMetadataObject(parsed);
    } catch (secondError) {
      // Third attempt: Regex extraction
      return extractMetadataWithRegex(content);
    }
  }
};

const fixCommonJSONIssues = (content) => {
  return content
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\f/g, '\\f')
    .replace(/\b/g, '')
    .replace(/(\[tex\])/g, '\\[tex\\]')
    .replace(/(\[\/tex\])/g, '\\[\\/tex\\]')
    .replace(/(\$)/g, '\\$');
};

const cleanMetadataObject = (parsed) => {
  const cleaned = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === 'string') {
      cleaned[key] = value
        .replace(/\b/g, '')
        .replace(/\\?\[tex\\?\]/g, '[tex]')
        .replace(/\\?\[\\?\/?tex\\?\]/g, '[/tex]')
        .replace(/\\?\$/g, '$');
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
};

const extractMetadataWithRegex = (content) => {
  const extractField = (fieldName, defaultValue = '') => {
    const regex = new RegExp(`"${fieldName}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, 'g');
    const match = regex.exec(content);
    if (match) {
      return match[1]
        .replace(/\\"/g, '"')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\\\/g, '\\')
        .replace(/\b/g, '');
    }
    return defaultValue;
  };
  
  return {
    description: extractField('description'),
    nodeId: extractField('nodeId'),
    tokenBoundAccount: extractField('tokenBoundAccount'),
    nodeTokenContract: extractField('nodeTokenContract'),
    tokenName: extractField('tokenName', 'NODE'),
    tokenSymbol: extractField('tokenSymbol', 'NODE'),
    tokenSupply: extractField('tokenSupply', '1000')
  };
};