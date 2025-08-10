import React, { useState, useEffect } from 'react';
import KeyboardShortcutsManager from '../utils/keyboardShortcuts';
import modelsConfig from '../config/models.json';

const Sidebar = ({
  connected,
  account,
  onConnect,
  onDisconnect,
  onCreateTree,
  trees,
  currentTree,
  onSelectTree,
  selectedNode,
  selectedNodeNFT,
  onGenerateSiblings,
  onImportTrees,
  isGeneratingChildren,
  setIsGeneratingChildren,
  isGeneratingSiblings,
  setIsGeneratingSiblings,
  onModelChange
}) => {
  const [newTreeContent, setNewTreeContent] = useState('');
  const [childrenCount, setChildrenCount] = useState(3);
  const [siblingCount, setSiblingCount] = useState(3);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isCreatingTree, setIsCreatingTree] = useState(false);
  const [showOnlyMyTrees, setShowOnlyMyTrees] = useState(false);
  const [selectedModel, setSelectedModel] = useState(modelsConfig.defaultModel);
  const [availableModels, setAvailableModels] = useState([]);
  
  // Initialize keyboard shortcuts manager
  const shortcutsManager = new KeyboardShortcutsManager();

  // Fetch available models from backend
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/models');
        if (response.ok) {
          const data = await response.json();
          setAvailableModels(data.models || []);
        } else {
          // Fallback to config models if backend unavailable
          const configModels = Object.keys(modelsConfig.models).map(id => ({
            id,
            name: modelsConfig.models[id].name,
            provider: modelsConfig.models[id].provider,
            modelId: modelsConfig.models[id].modelId,
            available: false // Unknown availability
          }));
          setAvailableModels(configModels);
        }
      } catch (error) {
        console.error('Error fetching models:', error);
        // Fallback to config models
        const configModels = Object.keys(modelsConfig.models).map(id => ({
          id,
          name: modelsConfig.models[id].name,
          provider: modelsConfig.models[id].provider,
          modelId: modelsConfig.models[id].modelId,
          available: false
        }));
        setAvailableModels(configModels);
      }
    };

    fetchModels();
  }, []);

  // Notify parent component when model changes
  useEffect(() => {
    if (onModelChange) {
      onModelChange(selectedModel);
    }
  }, [selectedModel, onModelChange]);

  const ellipseAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Helper function to safely parse NFT metadata with control character fixes
  const parseNFTMetadata = (content) => {
    try {
      // First attempt: Fix malformed JSON by escaping control characters and LaTeX syntax
      let fixedContent = content
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t')
        .replace(/\f/g, '\\f')
        .replace(/\b/g, '') // Remove backspace characters
        // Escape LaTeX/TeX brackets and dollar signs within JSON string values
        .replace(/(\[tex\])/g, '\\[tex\\]')
        .replace(/(\[\/tex\])/g, '\\[\\/tex\\]')
        .replace(/(\$)/g, '\\$');
      
      try {
        const parsed = JSON.parse(fixedContent);
        
        // Clean up any backspace characters and unescape LaTeX syntax
        const cleanMetadata = {};
        for (const [key, value] of Object.entries(parsed)) {
          if (typeof value === 'string') {
            cleanMetadata[key] = value
              .replace(/\b/g, '')
              .replace(/\\?\[tex\\?\]/g, '[tex]')
              .replace(/\\?\[\\?\/?tex\\?\]/g, '[/tex]')
              .replace(/\\?\$/g, '$');
          } else {
            cleanMetadata[key] = value;
          }
        }
        
        return cleanMetadata;
      } catch (firstError) {
        
        // Second attempt: More aggressive fixing for nested quotes and LaTeX
        fixedContent = content
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t')
          .replace(/\f/g, '\\f')
          .replace(/\b/g, '')
          // Handle LaTeX expressions more carefully
          .replace(/\[tex\]/g, '\\u005Btex\\u005D')
          .replace(/\[\/tex\]/g, '\\u005B/tex\\u005D')
          .replace(/\$\$/g, '\\u0024\\u0024')
          .replace(/\$/g, '\\u0024')
          // Fix unescaped quotes within JSON string values
          .replace(/"([^"]*)"([^"]*)"([^"]*)":/g, '"$1\\"$2\\"$3":')
          .replace(/:"([^"]*)"([^"]*)"([^"]*)"([,}])/g, ':"$1\\"$2\\"$3"$4');
        
        try {
          const parsed = JSON.parse(fixedContent);
          
          const cleanMetadata = {};
          for (const [key, value] of Object.entries(parsed)) {
            if (typeof value === 'string') {
              cleanMetadata[key] = value
                .replace(/\b/g, '')
                .replace(/\\"/g, '"')
                .replace(/\\u005Btex\\u005D/g, '[tex]')
                .replace(/\\u005B\/tex\\u005D/g, '[/tex]')
                .replace(/\\u0024/g, '$');
            } else {
              cleanMetadata[key] = value;
            }
          }
          
          return cleanMetadata;
        } catch (secondError) {
          
          // Third attempt: Smart regex parsing that handles nested content
          try {
            // More sophisticated regex that can handle complex content including LaTeX
            const extractField = (fieldName, defaultValue = '') => {
              const regex = new RegExp(`"${fieldName}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, 'g');
              const match = regex.exec(content);
              if (match) {
                // Unescape the matched content
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
            
            const description = extractField('description');
            const nodeId = extractField('nodeId');
            const tokenBoundAccount = extractField('tokenBoundAccount');
            const nodeTokenContract = extractField('nodeTokenContract');
            const tokenName = extractField('tokenName', 'NODE');
            const tokenSymbol = extractField('tokenSymbol', 'NODE');
            const tokenSupply = extractField('tokenSupply', '1000');
            
            if (description || nodeId) {
              return {
                description,
                nodeId,
                tokenBoundAccount,
                nodeTokenContract,
                tokenName,
                tokenSymbol,
                tokenSupply
              };
            }
          } catch (regexError) {
          }
          
          return null;
        }
      }
    } catch (e) {
      return null;
    }
  };

  const handleCreateTree = async () => {
    if (newTreeContent.trim()) {
      setIsCreatingTree(true);
      try {
        await onCreateTree(newTreeContent.trim());
        setNewTreeContent('');
      } catch (error) {
        console.error('Failed to create tree:', error);
        alert('Failed to create tree: ' + error.message);
      } finally {
        setIsCreatingTree(false);
      }
    }
  };

  const handleGenerateChildren = async () => {
    if (selectedNode && selectedNode.id && !isGeneratingChildren && !isGeneratingSiblings) {
      setIsGeneratingChildren(true);
      try {
        await onGenerateSiblings(selectedNode.id, childrenCount);
      } finally {
        setIsGeneratingChildren(false);
      }
    }
  };

  const handleGenerateSiblings = async () => {
    if (selectedNode && selectedNode.id && selectedNode.parentId && !isGeneratingChildren && !isGeneratingSiblings) {
      console.log('🎯 Starting sibling generation...');
      setIsGeneratingSiblings(true);
      
      // Add a safety timeout to reset state if promise doesn't resolve
      const timeoutId = setTimeout(() => {
        console.log('🎯 Generation timeout - forcing state reset');
        setIsGeneratingSiblings(false);
      }, 30000); // 30 second timeout
      
      try {
        // Generate siblings by using the parent ID
        const result = await onGenerateSiblings(selectedNode.parentId, siblingCount);
        console.log('🎯 Generation completed:', result);
      } catch (error) {
        console.error('🎯 Generation failed:', error);
      } finally {
        console.log('🎯 Resetting generation state...');
        clearTimeout(timeoutId);
        setIsGeneratingSiblings(false);
      }
    }
  };

  const handleExportTrees = async () => {
    if (!trees || trees.length === 0) {
      alert('No trees to export');
      return;
    }

    setIsExporting(true);
    try {
      // Create export data with tree structure and metadata
      const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        account: account,
        trees: trees.map(tree => ({
          address: tree.address,
          rootContent: tree.rootContent,
          nodeCount: tree.nodeCount,
          nodes: tree.nodes.map(node => ({
            nodeId: node.nodeId,
            parentId: node.parentId,
            content: node.content,
            author: node.author,
            timestamp: node.timestamp,
            isRoot: node.isRoot
          }))
        }))
      };

      // Create downloadable JSON file
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `loom-trees-${account?.slice(0, 8)}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      alert(`Successfully exported ${trees.length} trees to JSON file`);
    } catch (error) {
      console.error('Error exporting trees:', error);
      alert('Failed to export trees: ' + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportTrees = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      setIsImporting(true);
      try {
        const text = await file.text();
        const importData = JSON.parse(text);

        // Validate import data structure
        if (!importData.version || !importData.trees || !Array.isArray(importData.trees)) {
          throw new Error('Invalid import file format');
        }

        // Ask user for confirmation
        const confirmMessage = `This will recreate ${importData.trees.length} trees with all their nodes on the blockchain. This action cannot be undone and will cost gas. Continue?`;
        if (!window.confirm(confirmMessage)) {
          return;
        }

        // Use the parent component's import function
        if (onImportTrees) {
          await onImportTrees(importData);
          alert(`Successfully imported ${importData.trees.length} trees to the blockchain!`);
        } else {
          throw new Error('Import function not available');
        }
      } catch (error) {
        console.error('Error importing trees:', error);
        alert('Failed to import trees: ' + error.message);
      } finally {
        setIsImporting(false);
      }
    };
    input.click();
  };


  return (
    <div className="sidebar">
      {/* Connection Status */}
      <div className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
        {connected ? `Connected: ${ellipseAddress(account)}` : 'Disconnected'}
      </div>

      {!connected ? (
        <button className="btn" onClick={onConnect}>
          Connect Wallet
        </button>
      ) : (
        <button className="btn btn-secondary" onClick={onDisconnect}>
          Disconnect
        </button>
      )}

      {/* AI Model Selector */}
      <div className="section">
        <h3>🤖 AI Model</h3>
        <select 
          value={selectedModel} 
          onChange={(e) => setSelectedModel(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid #555',
            backgroundColor: '#3d3d3d',
            color: '#fff',
            fontSize: '12px',
            fontFamily: "'Inconsolata', monospace",
            marginBottom: '8px'
          }}
        >
          {availableModels.map(model => {
            // Use config provider name instead of backend provider (which is API compatibility)
            const configProvider = modelsConfig.models[model.id]?.provider || model.provider;
            return (
              <option 
                key={model.id} 
                value={model.id}
                disabled={model.available === false}
              >
                {model.name} ({configProvider}) {model.available === false ? ' - Unavailable' : ''}
              </option>
            );
          })}
        </select>
        {selectedModel && modelsConfig.models[selectedModel] && (
          <div style={{ fontSize: '10px', color: '#888', lineHeight: '1.3' }}>
            Model ID: {modelsConfig.models[selectedModel].modelId}
          </div>
        )}
      </div>

      {/* Create New Tree */}
      <div className="section">
        <h3>Create New Tree</h3>
        <div className="input-group">
          <label>Root Content:</label>
          <textarea
            value={newTreeContent}
            onChange={(e) => setNewTreeContent(e.target.value)}
            placeholder="Enter the root content for your new narrative tree..."
          />
        </div>
        <button 
          className="btn" 
          onClick={handleCreateTree}
          disabled={!connected || !newTreeContent.trim() || isCreatingTree}
        >
          {isCreatingTree ? 'Creating Tree...' : 'Create Tree'}
        </button>
      </div>

      {/* Save/Load Trees */}
      <div className="section">
        <h3>Backup & Restore</h3>
        <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
          <button 
            className="btn btn-secondary" 
            onClick={handleExportTrees}
            disabled={!connected || trees.length === 0 || isExporting}
            style={{ fontSize: '12px', padding: '8px 12px' }}
          >
            {isExporting ? 'Exporting...' : `💾 Save All Trees (${trees.length})`}
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={handleImportTrees}
            disabled={!connected || isImporting}
            style={{ fontSize: '12px', padding: '8px 12px' }}
          >
            {isImporting ? 'Importing...' : '📂 Load Trees from JSON'}
          </button>
        </div>
        <div style={{ fontSize: '11px', color: '#888', marginTop: '8px', lineHeight: '1.3' }}>
          Save exports all trees to JSON. Load recreates trees on blockchain (costs gas).
        </div>
      </div>

      {/* Tree List */}
      <div className="section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h3>Trees ({(() => {
            const filteredTrees = showOnlyMyTrees 
              ? trees.filter(tree => tree.nodes && tree.nodes.some(node => node.author && node.author.toLowerCase() === account?.toLowerCase()))
              : trees;
            return filteredTrees.length;
          })()})</h3>
          <button 
            className={`btn ${showOnlyMyTrees ? '' : 'btn-secondary'}`}
            onClick={() => setShowOnlyMyTrees(!showOnlyMyTrees)}
            disabled={!connected}
            style={{ 
              fontSize: '11px', 
              padding: '4px 8px',
              minWidth: 'auto'
            }}
          >
            {showOnlyMyTrees ? '🌍 Show All' : '🌱 My Trees'}
          </button>
        </div>
        {(() => {
          const filteredTrees = showOnlyMyTrees 
            ? trees.filter(tree => tree.nodes && tree.nodes.some(node => node.author && node.author.toLowerCase() === account?.toLowerCase()))
            : trees;
          
          return filteredTrees.length === 0 ? (
            <p style={{ color: '#888' }}>
              {showOnlyMyTrees ? 'No trees created by you' : 'No trees available'}
            </p>
          ) : (
            filteredTrees.map((tree, index) => {
              const isMyTree = tree.nodes && tree.nodes.some(node => node.author && node.author.toLowerCase() === account?.toLowerCase());
              return (
                <div
                  key={tree.address || tree.id || index}
                  className={`tree-item ${currentTree?.address === tree.address ? 'selected' : ''}`}
                  onClick={() => onSelectTree(tree)}
                >
                  <div style={{ 
                    fontWeight: 'bold', 
                    marginBottom: '5px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span>🌳 Tree #{trees.findIndex(t => t.address === tree.address) + 1} {isMyTree ? '🌱' : ''}</span>
                    <span style={{ fontSize: '9px', color: '#666', fontWeight: 'normal' }}>
                      {tree.address ? tree.address.substring(0, 6) + '...' : ''}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#ccc', marginBottom: '8px' }}>
                    {tree.rootContent ? tree.rootContent.substring(0, 45) + '...' : 'Loading...'}
                  </div>
                  <div className="node-stats" style={{ 
                    fontSize: '11px', 
                    color: '#4CAF50', 
                    fontWeight: 'bold',
                    display: 'flex', 
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span>📊 Total: {tree.nodeCount || 0} nodes</span>
                    <span style={{ color: '#888' }}>
                      {tree.nodes ? `(${tree.nodes.filter(n => !n.isRoot).length} children)` : ''}
                    </span>
                  </div>
                </div>
              );
            })
          );
        })()}
      </div>

      {/* Selected Node Info */}
      {selectedNode && (
        <div className="section">
          <h3>Selected Node</h3>
          <div className="node-info">
            <h4>Node Relationship Data</h4>
            <div style={{ fontSize: '12px', color: '#ccc', marginBottom: '15px' }}>
              <div>Author: {ellipseAddress(selectedNode.author)}</div>
              <div>Created: {new Date(selectedNode.timestamp * 1000).toLocaleString()}</div>
              <div>ID: {selectedNode.id.substring(0, 8)}...</div>
              <div>Parent: {selectedNode.parentId && selectedNode.parentId !== '0x0000000000000000000000000000000000000000000000000000000000000000' ? selectedNode.parentId.substring(0, 8) + '...' : 'Root Node'}</div>
              <div>Children: {selectedNode.children ? selectedNode.children.length : 0}</div>
            </div>

            {/* NFT Information - Now displays content and metadata */}
            <h4 style={{ color: '#FF6B35', marginBottom: '8px' }}>🎨 Content (stored as NFT)</h4>
            {selectedNodeNFT ? (
              <div style={{ 
                backgroundColor: '#1a1a1a', 
                border: '1px solid #FF6B35',
                borderRadius: '6px',
                padding: '10px',
                marginBottom: '8px'
              }}>
                <div style={{ fontSize: '12px', color: '#FF6B35', marginBottom: '8px' }}>
                  <div style={{ fontWeight: 'bold' }}>NFT Token ID: #{selectedNodeNFT.tokenId}</div>
                </div>
                
                {/* Display the actual content from NFT */}
                <div style={{ 
                  backgroundColor: '#0a0a0a',
                  border: '1px solid #333',
                  borderRadius: '4px',
                  padding: '8px',
                  marginBottom: '8px'
                }}>
                  {(() => {
                    const metadata = parseNFTMetadata(selectedNodeNFT.content);
                    let content;
                    if (metadata) {
                      content = metadata.description || selectedNodeNFT.content;
                    } else {
                      content = selectedNodeNFT.content;
                    }
                    
                    // Clip content to maximum 300 characters for left sidebar
                    const maxLength = 300;
                    if (content.length > maxLength) {
                      return content.substring(0, maxLength) + '...';
                    }
                    return content;
                  })()}
                </div>
                
                <div style={{ fontSize: '11px', color: '#ccc', lineHeight: '1.4' }}>
                  <div>NFT Owner: {ellipseAddress(selectedNodeNFT.owner)}</div>
                  <div style={{ 
                    marginTop: '8px',
                    fontSize: '10px',
                    color: '#888',
                    fontStyle: 'italic',
                    textAlign: 'center'
                  }}>
                    💎 Content is permanently stored on-chain as NFT metadata
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ 
                backgroundColor: '#1a1a1a', 
                border: '1px solid #555',
                borderRadius: '6px',
                padding: '10px',
                marginBottom: '8px'
              }}>
                <div style={{ fontSize: '11px', color: '#888', textAlign: 'center', fontStyle: 'italic' }}>
                  {selectedNode ? 'Loading content from NFT...' : 'No content available'}
                </div>
              </div>
            )}

            {/* Node Token Information */}
            <h4 style={{ color: '#FFC107', marginBottom: '8px', marginTop: '15px' }}>🪙 Node Token (ERC20)</h4>
            {selectedNodeNFT ? (
              <div style={{ 
                backgroundColor: '#1a1a1a', 
                border: '1px solid #FFC107',
                borderRadius: '6px',
                padding: '10px',
                marginBottom: '8px'
              }}>
                <div style={{ fontSize: '12px', color: '#FFC107', marginBottom: '8px' }}>
                  {(() => {
                    const metadata = parseNFTMetadata(selectedNodeNFT.content);
                    
                    if (metadata && metadata.nodeTokenContract) {
                      return (
                        <div>
                          <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>
                            🪙 Token Contract:
                          </div>
                          <div style={{ 
                            backgroundColor: '#0a0a0a',
                            border: '1px solid #333',
                            borderRadius: '4px',
                            padding: '6px',
                            fontFamily: 'monospace',
                            fontSize: '10px',
                            wordBreak: 'break-all',
                            marginBottom: '8px'
                          }}>
                            {metadata.nodeTokenContract}
                          </div>
                          <div style={{ fontSize: '10px', color: '#ccc', lineHeight: '1.3' }}>
                            <div>🏷️ Token Name: {metadata.tokenName || 'NODE'}</div>
                            <div>🔤 Token Symbol: {metadata.tokenSymbol || 'NODE'}</div>
                            <div>💰 Total Supply: {metadata.tokenSupply || '1000'} {metadata.tokenSymbol || 'NODE'}</div>
                            <div>🏦 Held by Token Bound Account</div>
                            <div>💎 ERC20 standard token for this node</div>
                          </div>
                        </div>
                      );
                    } else if (metadata) {
                      return (
                        <div style={{ fontSize: '11px', color: '#888', textAlign: 'center', fontStyle: 'italic' }}>
                          ⚠️ No Node Token found in NFT metadata
                        </div>
                      );
                    } else {
                      return (
                        <div style={{ fontSize: '11px', color: '#888', textAlign: 'center', fontStyle: 'italic' }}>
                          ⚠️ Could not parse NFT metadata for token info
                        </div>
                      );
                    }
                  })()}
                </div>
              </div>
            ) : (
              <div style={{ 
                backgroundColor: '#1a1a1a', 
                border: '1px solid #555',
                borderRadius: '6px',
                padding: '10px',
                marginBottom: '8px'
              }}>
                <div style={{ fontSize: '11px', color: '#888', textAlign: 'center', fontStyle: 'italic' }}>
                  Loading Node Token info...
                </div>
              </div>
            )}

            {/* Token Bound Account (TBA) Information */}
            <h4 style={{ color: '#9C27B0', marginBottom: '8px', marginTop: '15px' }}>🏦 Token Bound Account</h4>
            {selectedNodeNFT ? (
              <div style={{ 
                backgroundColor: '#1a1a1a', 
                border: '1px solid #9C27B0',
                borderRadius: '6px',
                padding: '10px',
                marginBottom: '8px'
              }}>
                <div style={{ fontSize: '12px', color: '#9C27B0', marginBottom: '8px' }}>
                  {(() => {
                    const metadata = parseNFTMetadata(selectedNodeNFT.content);
                    
                    if (metadata && metadata.tokenBoundAccount) {
                      return (
                        <div>
                          <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>
                            🏦 Account Address:
                          </div>
                          <div style={{ 
                            backgroundColor: '#0a0a0a',
                            border: '1px solid #333',
                            borderRadius: '4px',
                            padding: '6px',
                            fontFamily: 'monospace',
                            fontSize: '10px',
                            wordBreak: 'break-all',
                            marginBottom: '8px'
                          }}>
                            {metadata.tokenBoundAccount}
                          </div>
                          <div style={{ fontSize: '10px', color: '#ccc', lineHeight: '1.3' }}>
                            <div>✅ This NFT has its own Ethereum account</div>
                            <div>💰 Can hold assets and execute transactions</div>
                            <div>🔐 Controlled by NFT owner: {ellipseAddress(selectedNodeNFT.owner)}</div>
                            <div>🔄 Account transfers with NFT ownership</div>
                          </div>
                        </div>
                      );
                    } else if (metadata) {
                      return (
                        <div style={{ fontSize: '11px', color: '#888', textAlign: 'center', fontStyle: 'italic' }}>
                          ⚠️ No Token Bound Account found in NFT metadata
                        </div>
                      );
                    } else {
                      return (
                        <div style={{ fontSize: '11px', color: '#888', textAlign: 'center', fontStyle: 'italic' }}>
                          ⚠️ Could not parse NFT metadata for TBA info
                        </div>
                      );
                    }
                  })()}
                </div>
              </div>
            ) : (
              <div style={{ 
                backgroundColor: '#1a1a1a', 
                border: '1px solid #555',
                borderRadius: '6px',
                padding: '10px',
                marginBottom: '8px'
              }}>
                <div style={{ fontSize: '11px', color: '#888', textAlign: 'center', fontStyle: 'italic' }}>
                  Loading Token Bound Account info...
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Generation Controls */}
      {selectedNode && (
        <div className="section">
          <h3>AI Generation</h3>
          
          {/* Generate Children */}
          <div style={{ marginBottom: '15px' }}>
            <h4 style={{ fontSize: '14px', color: '#4CAF50', marginBottom: '8px' }}>Generate Children</h4>
            <div className="input-group">
              <label>Number of children to generate:</label>
              <select
                value={childrenCount}
                onChange={(e) => setChildrenCount(parseInt(e.target.value))}
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={5}>5</option>
              </select>
            </div>
            <button
              className="btn"
              onClick={handleGenerateChildren}
              disabled={!connected || !selectedNode || isGeneratingChildren || isGeneratingSiblings}
              style={{ marginBottom: '10px' }}
            >
              {isGeneratingChildren ? 'Generating...' : 'Generate Children'}
            </button>
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '15px' }}>
              Creates new nodes as children of the selected node
            </div>
          </div>
          
          {/* Generate Siblings */}
          {selectedNode.parentId && selectedNode.parentId !== '0x0000000000000000000000000000000000000000000000000000000000000000' && (
            <div>
              <h4 style={{ fontSize: '14px', color: '#4CAF50', marginBottom: '8px' }}>Generate Siblings</h4>
              <div className="input-group">
                <label>Number of siblings to generate:</label>
                <select
                  value={siblingCount}
                  onChange={(e) => setSiblingCount(parseInt(e.target.value))}
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={5}>5</option>
                </select>
              </div>
              <button
                className="btn"
                onClick={handleGenerateSiblings}
                disabled={!connected || !selectedNode || isGeneratingChildren || isGeneratingSiblings}
              >
                {isGeneratingSiblings ? 'Generating...' : 'Generate Siblings'}
              </button>
              <div style={{ fontSize: '11px', color: '#888' }}>
                Creates new nodes at the same level as the selected node
              </div>
            </div>
          )}
        </div>
      )}

      {/* Keyboard Shortcuts */}
      <div className="section">
        <h3>⌨️ Keyboard Shortcuts</h3>
        <div style={{ fontSize: '11px', color: '#ccc', lineHeight: '1.3' }}>
          {Object.entries(shortcutsManager.getShortcutsByCategory()).map(([category, shortcuts]) => (
            <div key={category} style={{ marginBottom: '12px' }}>
              <div style={{ 
                color: '#4CAF50', 
                fontSize: '12px', 
                fontWeight: 'bold', 
                marginBottom: '6px' 
              }}>
                {category}
              </div>
              {shortcuts.map((shortcut, index) => (
                <div key={`${category}-${shortcut.key}-${index}`} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '3px',
                  padding: '2px 0'
                }}>
                  <span>{shortcut.description}</span>
                  <span style={{ 
                    backgroundColor: '#333', 
                    color: '#4CAF50',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    fontSize: '10px',
                    fontFamily: 'monospace',
                    fontWeight: 'bold'
                  }}>
                    {(() => {
                      let displayText = shortcut.symbol || shortcut.key;
                      if (shortcut.modifiers && shortcut.modifiers.length > 0) {
                        const modifierSymbols = {
                          shift: '⇧',
                          ctrl: '⌃',
                          control: '⌃', 
                          alt: '⌥',
                          meta: '⌘',
                          cmd: '⌘'
                        };
                        const modifiers = shortcut.modifiers.map(mod => modifierSymbols[mod] || mod).join('');
                        displayText = modifiers + displayText;
                      }
                      return displayText;
                    })()}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="section">
        <h3>Instructions</h3>
        <div style={{ fontSize: '12px', color: '#ccc', lineHeight: '1.4' }}>
          <p>1. Connect your wallet to interact with the blockchain</p>
          <p>2. Create a new tree by entering root content</p>
          <p>3. Click on nodes in the graph to select them</p>
          <p>4. Right-click nodes to add children manually</p>
          <p>5. Use "Generate Children" to create AI-generated sub-branches</p>
          <p>6. Use "Generate Siblings" to create alternatives at the same level</p>
          <p>7. Each node gets its own ERC20 token (1000 NODE tokens)</p>
          <p>8. Each node's NFT has its own Token Bound Account (TBA) that holds the tokens</p>
          <p>9. All changes are automatically saved to the blockchain</p>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;