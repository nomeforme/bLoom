import React, { useState } from 'react';

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
  onGenerateSiblings,
  onImportTrees
}) => {
  const [newTreeContent, setNewTreeContent] = useState('');
  const [childrenCount, setChildrenCount] = useState(3);
  const [siblingCount, setSiblingCount] = useState(3);
  const [isGeneratingChildren, setIsGeneratingChildren] = useState(false);
  const [isGeneratingSiblings, setIsGeneratingSiblings] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const ellipseAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleCreateTree = () => {
    if (newTreeContent.trim()) {
      onCreateTree(newTreeContent.trim());
      setNewTreeContent('');
    }
  };

  const handleGenerateChildren = async () => {
    if (selectedNode && selectedNode.id) {
      setIsGeneratingChildren(true);
      try {
        await onGenerateSiblings(selectedNode.id, childrenCount);
      } finally {
        setIsGeneratingChildren(false);
      }
    }
  };

  const handleGenerateSiblings = async () => {
    if (selectedNode && selectedNode.id && selectedNode.parentId) {
      setIsGeneratingSiblings(true);
      try {
        // Generate siblings by using the parent ID
        await onGenerateSiblings(selectedNode.parentId, siblingCount);
      } finally {
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
          disabled={!connected || !newTreeContent.trim()}
        >
          Create Tree
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
        <h3>Your Trees ({trees.length})</h3>
        {trees.length === 0 ? (
          <p style={{ color: '#888' }}>No trees created yet</p>
        ) : (
          trees.map((tree, index) => (
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
                <span>🌳 Tree #{index + 1}</span>
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
          ))
        )}
      </div>

      {/* Selected Node Info */}
      {selectedNode && (
        <div className="section">
          <h3>Selected Node</h3>
          <div className="node-info">
            <h4>Node Details</h4>
            <div className="node-content" style={{ 
              border: '1px solid #555',
              borderRadius: '4px',
              padding: '8px'
            }}>
              {selectedNode.content}
            </div>
            <div style={{ fontSize: '12px', color: '#ccc' }}>
              <div>Author: {ellipseAddress(selectedNode.author)}</div>
              <div>Created: {new Date(selectedNode.timestamp * 1000).toLocaleString()}</div>
              <div>ID: {selectedNode.id.substring(0, 8)}...</div>
            </div>
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
          <p>7. All changes are automatically saved to the blockchain</p>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;