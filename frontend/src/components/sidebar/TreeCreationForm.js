import React from 'react';

const TreeCreationForm = ({
  connected,
  newTreeContent,
  setNewTreeContent,
  isCreatingTree,
  handleCreateTree
}) => {
  if (!connected) {
    return null;
  }

  return (
    <div className="section">
      <h3>Create New Tree</h3>
      <div className="input-group">
        <label>Root Content:</label>
        <textarea
          value={newTreeContent}
          onChange={(e) => setNewTreeContent(e.target.value)}
          placeholder="Enter root text for new tree..."
        />
      </div>
      <button 
        className="btn" 
        onClick={handleCreateTree}
        disabled={!connected || !newTreeContent.trim() || isCreatingTree}
        style={{ width: '100%' }}
      >
        {isCreatingTree ? 'Creating Tree...' : 'Create Tree'}
      </button>
    </div>
  );
};

export default TreeCreationForm;