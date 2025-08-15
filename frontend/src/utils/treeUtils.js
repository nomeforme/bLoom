export const buildFullPathContext = (targetNodeId, currentTree) => {
  if (!currentTree || !currentTree.nodes) return '';
  
  const nodeMap = new Map();
  currentTree.nodes.forEach(node => {
    nodeMap.set(node.nodeId, node);
  });
  
  const targetNode = nodeMap.get(targetNodeId);
  if (!targetNode) return '';
  
  const path = [];
  let currentNode = targetNode;
  
  while (currentNode) {
    path.unshift(currentNode);
    
    if (currentNode.isRoot || 
        currentNode.parentId === '0x0000000000000000000000000000000000000000000000000000000000000000' ||
        currentNode.parentId === '0x0') {
      break;
    }
    
    currentNode = nodeMap.get(currentNode.parentId);
    
    if (path.length > 50) {
      console.warn('Path too long, breaking to prevent infinite loop');
      break;
    }
  }
  
  const fullContext = path.map(node => node.content.trim()).filter(content => content).join('\n\n');
  return fullContext;
};

export const sortNodesByDependency = (nodes) => {
  const sorted = [];
  const processed = new Set();
  const rootParentId = '0x0000000000000000000000000000000000000000000000000000000000000000';
  
  let remainingNodes = [...nodes];
  let maxIterations = nodes.length * 2;
  let iteration = 0;
  
  while (remainingNodes.length > 0 && iteration < maxIterations) {
    const initialLength = remainingNodes.length;
    
    remainingNodes = remainingNodes.filter(node => {
      if (node.parentId === rootParentId || node.parentId === '0x0' || processed.has(node.parentId)) {
        sorted.push(node);
        processed.add(node.nodeId);
        return false;
      }
      return true;
    });
    
    if (remainingNodes.length === initialLength) {
      console.warn('Could not resolve all node dependencies, adding remaining nodes anyway');
      sorted.push(...remainingNodes);
      break;
    }
    
    iteration++;
  }
  
  return sorted;
};

export const refreshTrees = async (getAllTrees, setTrees, setCurrentTree, setIsLoadingTrees, currentTree) => {
  if (getAllTrees) {
    try {
      console.log('Refreshing all trees');
      setIsLoadingTrees(true);
      const allTrees = await getAllTrees();
      console.log('Refreshed trees:', allTrees);
      setTrees(allTrees);
      
      // Update current tree if it's in the refreshed list
      if (currentTree) {
        const updatedCurrentTree = allTrees.find(tree => tree.address === currentTree.address);
        if (updatedCurrentTree) {
          setCurrentTree(updatedCurrentTree);
        }
      }
    } catch (error) {
      console.error('Error refreshing trees:', error);
    } finally {
      setIsLoadingTrees(false);
    }
  }
};