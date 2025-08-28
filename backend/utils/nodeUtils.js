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

module.exports = {
  sortNodesByDependency
};