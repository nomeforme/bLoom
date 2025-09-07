// GraphQL utility functions and helpers

// Helper function to calculate token balance from transfers
export const calculateTokenBalance = (transfers, mints, burns, userAddress) => {
  let balance = 0;
  
  // Add minted tokens
  mints.forEach(mint => {
    if (mint.to.toLowerCase() === userAddress.toLowerCase()) {
      balance += parseInt(mint.amount);
    }
  });
  
  // Subtract burned tokens
  burns.forEach(burn => {
    if (burn.from.toLowerCase() === userAddress.toLowerCase()) {
      balance -= parseInt(burn.amount);
    }
  });
  
  // Process transfers
  transfers.forEach(transfer => {
    if (transfer.from.toLowerCase() === userAddress.toLowerCase()) {
      balance -= parseInt(transfer.value);
    }
    if (transfer.to.toLowerCase() === userAddress.toLowerCase()) {
      balance += parseInt(transfer.value);
    }
  });
  
  return balance;
};

// Helper to normalize node IDs for consistent querying
export const normalizeNodeId = (nodeId) => {
  if (!nodeId) return null;
  return nodeId.toLowerCase();
};

// Helper to format blockchain timestamps
export const formatBlockchainTimestamp = (timestamp) => {
  return new Date(parseInt(timestamp) * 1000);
};

// Helper to check if a response has the expected data structure
export const validateGraphQLResponse = (data, expectedFields = []) => {
  if (!data) return false;
  
  return expectedFields.every(field => {
    const fieldPath = field.split('.');
    let current = data;
    
    for (const path of fieldPath) {
      if (!current || typeof current !== 'object') return false;
      current = current[path];
    }
    
    return current !== undefined;
  });
};

// Helper to extract error information from GraphQL responses
export const extractGraphQLErrors = (error) => {
  if (error?.graphQLErrors?.length > 0) {
    return error.graphQLErrors.map(err => err.message).join(', ');
  }
  
  if (error?.networkError) {
    return `Network error: ${error.networkError.message}`;
  }
  
  return error?.message || 'Unknown GraphQL error';
};

// Helper to create consistent cache keys
export const createCacheKey = (...parts) => {
  return parts.filter(Boolean).join(':').toLowerCase();
};

// Helper for consistent error handling in async GraphQL operations
export const withGraphQLErrorHandling = async (operation, context = '') => {
  try {
    return await operation();
  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn(`🔄 ${context} query was aborted (likely due to page refresh)`);
      return null;
    }
    
    const errorMessage = extractGraphQLErrors(error);
    console.error(`❌ ${context} error:`, errorMessage);
    throw error;
  }
};

// Helper to batch GraphQL operations with delay
export const executeBatchedOperations = async (operations, delayMs = 100) => {
  const results = [];
  
  for (let i = 0; i < operations.length; i++) {
    const operation = operations[i];
    
    try {
      const result = await withGraphQLErrorHandling(operation.fn, operation.context);
      results.push({ success: true, result, context: operation.context });
    } catch (error) {
      results.push({ success: false, error, context: operation.context });
    }
    
    // Add delay between operations except for the last one
    if (i < operations.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  return results;
};