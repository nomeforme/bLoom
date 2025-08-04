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
  onGenerateSiblings
}) => {
  const [newTreeContent, setNewTreeContent] = useState('');
  const [siblingCount, setSiblingCount] = useState(3);

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

  const handleGenerateSiblings = () => {
    if (selectedNode && selectedNode.id) {
      onGenerateSiblings(selectedNode.id, siblingCount);
    }
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
            <div className="node-content">
              {selectedNode.content}
            </div>
            <div style={{ fontSize: '12px', color: '#ccc' }}>
              <div>Author: {selectedNode.author}</div>
              <div>Created: {new Date(selectedNode.timestamp * 1000).toLocaleString()}</div>
              <div>ID: {selectedNode.id.substring(0, 8)}...</div>
            </div>
          </div>
        </div>
      )}

      {/* Generation Controls */}
      {selectedNode && (
        <div className="section">
          <h3>Generate Siblings</h3>
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
            disabled={!connected || !selectedNode}
          >
            Generate Siblings
          </button>
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
          <p>5. Use "Generate Siblings" to create AI-generated branches</p>
          <p>6. All changes are automatically saved to the blockchain</p>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;