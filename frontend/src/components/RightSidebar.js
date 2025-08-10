import React, { useMemo, useEffect, useRef } from 'react';

const RightSidebar = ({ currentTree, selectedNode }) => {
  const scrollRef = useRef(null);
  // Helper function to safely parse NFT metadata
  const parseNFTMetadata = (content) => {
    try {
      const fixedContent = content
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t')
        .replace(/\f/g, '\\f')
        .replace(/\b/g, '');

      try {
        const metadata = JSON.parse(fixedContent);
        const description = metadata.description || content;
        return typeof description === 'string' ? description.replace(/\b/g, '') : description;
      } catch (firstError) {
        const descriptionMatch = content.match(/"description"\s*:\s*"([^"]+)"/);
        if (descriptionMatch) {
          return descriptionMatch[1].replace(/\\n/g, '\n').replace(/\b/g, '');
        }
        return typeof content === 'string' ? content.replace(/\b/g, '') : content;
      }
    } catch (e) {
      return typeof content === 'string' ? content.replace(/\b/g, '') : content;
    }
  };

  // Build the path data from root to selected node
  const pathData = useMemo(() => {
    if (!currentTree || !currentTree.nodes || !selectedNode) {
      return { segments: [], selectedNodeId: null };
    }

    // Build a map of nodes for quick lookup
    const nodeMap = new Map();
    currentTree.nodes.forEach(node => {
      nodeMap.set(node.nodeId, node);
    });

    // Find the selected node
    const targetNode = nodeMap.get(selectedNode.id);
    if (!targetNode) return { segments: [], selectedNodeId: null };

    // Build path from root to target
    const path = [];
    let currentNode = targetNode;

    // Trace back to root
    while (currentNode) {
      path.unshift(currentNode);
      
      // Check if this is the root node
      if (currentNode.parentId === '0x0000000000000000000000000000000000000000000000000000000000000000' || 
          currentNode.parentId === '0x0' || 
          currentNode.parentId === null ||
          currentNode.isRoot) {
        break;
      }
      
      // Move to parent
      currentNode = nodeMap.get(currentNode.parentId);
      
      // Prevent infinite loops
      if (path.some(p => p.nodeId === currentNode?.nodeId)) {
        console.warn('Circular reference detected in node path');
        break;
      }
    }

    // Create segments with content and node IDs
    const segments = path.map(node => ({
      content: parseNFTMetadata(node.content).trim(),
      nodeId: node.nodeId
    })).filter(segment => segment.content);

    return { segments, selectedNodeId: selectedNode.id };
  }, [currentTree, selectedNode]);

  // Auto-scroll to bottom when node changes
  useEffect(() => {
    if (scrollRef.current && selectedNode) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [selectedNode]);

  if (!selectedNode) {
    return (
      <div className="right-sidebar">
        <div className="section">
          <h3>📖 Story Path</h3>
          <div style={{ 
            fontSize: '12px', 
            color: '#888', 
            textAlign: 'center',
            marginTop: '50px',
            fontStyle: 'italic'
          }}>
            Select a node to view its story path
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="right-sidebar">
      <div className="section">
        <h3>📖 Story Path</h3>
        <div style={{ fontSize: '11px', color: '#888', marginBottom: '15px' }}>
          Complete narrative from root to selected node
        </div>
        
        <div className="path-content" ref={scrollRef}>
          <div
            style={{
              fontSize: '14px',
              lineHeight: '1.6',
              fontFamily: "'Inconsolata', monospace",
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}
          >
            {pathData.segments.map((segment, index) => {
              const isCurrentNode = segment.nodeId === pathData.selectedNodeId;
              return (
                <span 
                  key={segment.nodeId}
                  style={{
                    color: isCurrentNode ? '#4CAF50' : '#ffffff'
                  }}
                >
                  {segment.content}
                  {index < pathData.segments.length - 1 ? ' ' : ''}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RightSidebar;