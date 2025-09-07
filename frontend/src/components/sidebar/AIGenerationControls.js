import React from 'react';

const AIGenerationControls = ({
  selectedNode,
  connected,
  childrenCount,
  setChildrenCount,
  siblingCount,
  setSiblingCount,
  isGeneratingChildren,
  isGeneratingSiblings,
  handleGenerateChildren,
  handleGenerateSiblings
}) => {
  if (!selectedNode) {
    return null;
  }

  return (
    <div className="section">
      <h3>AI Generation</h3>
      
      {/* Generate Children */}
      <div style={{ marginBottom: '15px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            className="btn"
            onClick={handleGenerateChildren}
            disabled={!connected || !selectedNode || isGeneratingChildren || isGeneratingSiblings}
            style={{ flex: '1', fontSize: '12px', height: '36px', boxSizing: 'border-box', padding: '0 12px', border: 'none' }}
          >
            {isGeneratingChildren ? 'Generating...' : 'Generate Children'}
          </button>
          <select
            value={childrenCount}
            onChange={(e) => setChildrenCount(parseInt(e.target.value))}
            style={{
              width: '60px',
              padding: '8px',
              borderRadius: '4px',
              border: '1px solid #555',
              backgroundColor: '#3d3d3d',
              color: '#fff',
              fontSize: '12px',
              height: '36px',
              boxSizing: 'border-box'
            }}
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={5}>5</option>
          </select>
        </div>
      </div>
      
      {/* Generate Siblings */}
      {selectedNode.parentId && selectedNode.parentId !== '0x0000000000000000000000000000000000000000000000000000000000000000' && (
        <div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              className="btn"
              onClick={handleGenerateSiblings}
              disabled={!connected || !selectedNode || isGeneratingChildren || isGeneratingSiblings}
              style={{ flex: '1', fontSize: '12px', height: '36px', boxSizing: 'border-box', padding: '0 12px', border: 'none' }}
            >
              {isGeneratingSiblings ? 'Generating...' : 'Generate Siblings'}
            </button>
            <select
              value={siblingCount}
              onChange={(e) => setSiblingCount(parseInt(e.target.value))}
              style={{
                width: '60px',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #555',
                backgroundColor: '#3d3d3d',
                color: '#fff',
                fontSize: '12px'
              }}
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={5}>5</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIGenerationControls;