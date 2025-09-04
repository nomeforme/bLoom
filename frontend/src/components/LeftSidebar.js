import React, { useMemo, useEffect, useRef, useState } from 'react';
import KeyboardShortcutsManager from '../utils/keyboardShortcuts';
import { useIPFSContent } from '../hooks/useIPFSContent';

const LeftSidebar = ({ className, currentTree, selectedNode, isGeneratingChildren, isGeneratingSiblings, selectedModel }) => {
  const scrollRef = useRef(null);
  const selectedNodeRef = useRef(null);
  const [viewMode, setViewMode] = useState('story'); // 'story' or 'hierarchy'
  const shortcutsManager = new KeyboardShortcutsManager();

  // Keyboard event handler for view switching
  useEffect(() => {
    const handleKeyPress = (event) => {
      // Skip if user is typing in an input field
      if (shortcutsManager.isTypingInInput()) return;

      if (shortcutsManager.matchShortcut(event, 'storyView')) {
        event.preventDefault();
        setViewMode('story');
      } else if (shortcutsManager.matchShortcut(event, 'hierarchyView')) {
        event.preventDefault();
        setViewMode('hierarchy');
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [shortcutsManager]);

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

  // Build tree hierarchy data
  const hierarchyData = useMemo(() => {
    if (!currentTree || !currentTree.nodes) {
      return { rootNode: null, nodeMap: new Map() };
    }

    // Build a map of nodes for quick lookup
    const nodeMap = new Map();
    currentTree.nodes.forEach(node => {
      nodeMap.set(node.nodeId, {
        ...node,
        children: []
      });
    });

    // Build parent-child relationships
    let rootNode = null;
    currentTree.nodes.forEach(node => {
      if (node.parentId === '0x0000000000000000000000000000000000000000000000000000000000000000' || 
          node.parentId === '0x0' || 
          node.parentId === null ||
          node.isRoot) {
        rootNode = nodeMap.get(node.nodeId);
      } else {
        const parent = nodeMap.get(node.parentId);
        if (parent) {
          parent.children.push(nodeMap.get(node.nodeId));
        }
      }
    });

    return { rootNode, nodeMap };
  }, [currentTree]);

  // Helper function to truncate text for hierarchy view
  const truncateText = (text, maxLength = 25) => {
    const cleanText = parseNFTMetadata(text).trim();
    if (cleanText.length <= maxLength) return cleanText;
    return cleanText.substring(0, maxLength) + '...';
  };

  // Render tree hierarchy recursively
  const renderHierarchyNode = (node, depth = 0, isLast = false, prefix = '') => {
    if (!node) return null;

    const isSelected = selectedNode && node.nodeId === selectedNode.id;
    const hasChildren = node.children && node.children.length > 0;
    
    // Create tree-like prefix
    const currentPrefix = depth === 0 ? '' : prefix + (isLast ? '└── ' : '├── ');
    const childPrefix = depth === 0 ? '' : prefix + (isLast ? '    ' : '│   ');

    return (
      <div key={node.nodeId}>
        <div
          ref={isSelected ? selectedNodeRef : null}
          style={{
            fontFamily: "'Inconsolata', monospace",
            fontSize: '12px',
            lineHeight: '1.4',
            color: isSelected ? '#4CAF50' : '#ffffff',
            fontWeight: isSelected ? 'bold' : 'normal',
            whiteSpace: 'pre',
            cursor: 'default'
          }}
        >
          {currentPrefix}{truncateText(node.content)}
        </div>
        {hasChildren && node.children.map((child, index) => 
          renderHierarchyNode(
            child, 
            depth + 1, 
            index === node.children.length - 1,
            childPrefix
          )
        )}
      </div>
    );
  };

  // Auto-scroll behavior - different for each view mode
  useEffect(() => {
    if (!scrollRef.current || !selectedNode) return;

    if (viewMode === 'story') {
      // Story view: scroll to bottom
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    } else if (viewMode === 'hierarchy' && selectedNodeRef.current) {
      // Hierarchy view: scroll to center on selected node and left-align tree characters
      const container = scrollRef.current;
      const selectedElement = selectedNodeRef.current;
      
      const containerHeight = container.clientHeight;
      const elementTop = selectedElement.offsetTop;
      const elementHeight = selectedElement.clientHeight;
      
      // Calculate vertical scroll position to center the selected element
      const centerPosition = elementTop - (containerHeight / 2) + (elementHeight / 2);
      
      // For horizontal scroll, we want to bring the tree characters (├── └──) as far left as possible
      // We need to find where the tree characters start in the text content
      const textContent = selectedElement.textContent || '';
      const treeCharMatch = textContent.match(/[├└]/); // Find first tree character
      
      if (treeCharMatch) {
        // Calculate the character position where tree characters start
        const treeCharIndex = treeCharMatch.index;
        
        // Get the computed style to calculate character width
        const computedStyle = window.getComputedStyle(selectedElement);
        const fontSize = parseFloat(computedStyle.fontSize);
        
        // For monospace fonts, character width is roughly 0.6 * fontSize
        const charWidth = fontSize * 0.6;
        
        // Calculate pixel position of the tree character
        const treeCharPixelPosition = treeCharIndex * charWidth;
        
        // Scroll to position the tree character near the left edge (with small padding)
        const leftPosition = Math.max(0, treeCharPixelPosition - 10);
        
        container.scrollTo({
          top: Math.max(0, centerPosition),
          left: leftPosition,
          behavior: 'smooth'
        });
      } else {
        // Fallback: just center vertically if no tree characters found
        container.scrollTo({
          top: Math.max(0, centerPosition),
          behavior: 'smooth'
        });
      }
    }
  }, [selectedNode, viewMode]);

  if (!selectedNode && !currentTree) {
    return (
      <div className={className || "left-sidebar"}>
        <div className="section">
          <h3>{viewMode === 'story' ? 'Path View' : 'Tree View'}</h3>
          <div style={{ 
            fontSize: '12px', 
            color: '#888', 
            textAlign: 'center',
            marginTop: '50px',
            fontStyle: 'italic'
          }}>
            {viewMode === 'story' ? 'Select a node to view its text completion path' : 'Select a tree to view its hierarchy'}
          </div>
        </div>
      </div>
    );
  }

  const isGenerating = !!(isGeneratingChildren || isGeneratingSiblings);

  return (
    <div className={className || `left-sidebar${isGenerating ? ' generating' : ''}`}>
      <div className="section">
        <h3>
          <div>{viewMode === 'story' ? 'Path View' : 'Tree View'}</div>
          
          {/* Tree and Node IDs - Horizontal */}
          <div style={{ 
            fontSize: '10px', 
            color: '#666', 
            marginTop: '4px',
            lineHeight: '1.4',
            display: 'flex',
            gap: '16px',
            fontWeight: 'normal'
          }}>
            {currentTree && (
              <div>Tree: <span style={{ color: '#4CAF50' }}>{currentTree.address ? `${currentTree.address.slice(0, 6)}...${currentTree.address.slice(-4)}` : 'N/A'}</span></div>
            )}
            {selectedNode && selectedNode.id && (
              <div>Node: <span style={{ color: '#4CAF50' }}>{`${selectedNode.id.slice(0, 6)}...${selectedNode.id.slice(-4)}`}</span></div>
            )}
          </div>
        </h3>
        
        <div className="path-content" ref={scrollRef}>
          {viewMode === 'story' ? (
            // Story view
            <div
              style={{
                fontSize: '14px',
                lineHeight: '1.6',
                fontFamily: "'Inconsolata', monospace",
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}
            >
              {selectedNode ? (
                pathData.segments.map((segment, index) => {
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
                })
              ) : (
                <div style={{ fontSize: '12px', color: '#888', textAlign: 'center', fontStyle: 'italic' }}>
                  Select a node to view its text path
                </div>
              )}
            </div>
          ) : (
            // Hierarchy view
            <div style={{ fontSize: '12px', lineHeight: '1.2' }}>
              {hierarchyData.rootNode ? (
                renderHierarchyNode(hierarchyData.rootNode)
              ) : (
                <div style={{ fontSize: '12px', color: '#888', textAlign: 'center', fontStyle: 'italic' }}>
                  No tree structure available
                </div>
              )}
            </div>
          )}
        </div>

        {(isGeneratingChildren || isGeneratingSiblings) && (
          <div className="generating-section">
            <div style={{ fontSize: '16px' }}>
              <span className="gen-fade">
                {isGeneratingChildren ? 'Generating children…' : 'Generating siblings…'}
              </span>
            </div>
            {selectedModel && (
              <div style={{
                fontSize: '12px',
                color: '#888',
                marginTop: '4px'
              }}>
                {selectedModel}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LeftSidebar;