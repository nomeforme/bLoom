import React from 'react';
import { refreshTrees } from '../../utils/treeUtils';

const TreeList = ({
  connected,
  trees,
  currentTree,
  account,
  showOnlyMyTrees,
  setShowOnlyMyTrees,
  onSelectTree,
  getAllTrees,
  setTrees,
  setCurrentTree,
  setIsLoadingTrees
}) => {
  if (!connected) {
    return null;
  }

  const getFilteredTrees = () => {
    return showOnlyMyTrees 
      ? trees.filter(tree => tree.nodes && tree.nodes.some(node => node.author && node.author.toLowerCase() === account?.toLowerCase()))
      : trees;
  };

  const filteredTrees = getFilteredTrees();

  return (
    <div className="section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h3>Trees ({filteredTrees.length})</h3>
        <div style={{ display: 'flex', gap: '2px' }}>
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
            {showOnlyMyTrees ? 'Show All' : 'My Trees'}
          </button>
          <button 
            className="btn btn-secondary"
            onClick={() => refreshTrees(getAllTrees, setTrees, setCurrentTree, setIsLoadingTrees, currentTree)}
            disabled={!connected}
            style={{ 
              fontSize: '11px', 
              padding: '4px 8px',
              minWidth: 'auto'
            }}
            title="Refresh trees from server"
          >
            ↻
          </button>
        </div>
      </div>

      {filteredTrees.length === 0 ? (
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
                <span>Tree #{trees.findIndex(t => t.address === tree.address) + 1} {isMyTree ? '*' : ''}</span>
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
                <span>Total: {tree.nodeCount || 0} nodes</span>
                <span style={{ color: '#888' }}>
                  {tree.nodes ? `(${tree.nodes.filter(n => !n.isRoot).length} children)` : ''}
                </span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default TreeList;