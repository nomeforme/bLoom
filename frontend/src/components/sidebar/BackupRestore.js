import React from 'react';

const BackupRestore = ({
  connected,
  trees,
  account,
  isExporting,
  isImporting,
  handleExportTrees,
  handleImportTrees
}) => {
  if (!connected) {
    return null;
  }

  return (
    <div className="section">
      <h3>Backup & Restore</h3>
      <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
        <button 
          className={`btn ${trees.length > 0 ? '' : 'btn-secondary'}`}
          onClick={handleExportTrees}
          disabled={!connected || trees.length === 0 || isExporting}
          style={{ fontSize: '12px', padding: '8px 12px' }}
        >
          {isExporting ? 'Exporting...' : `Save All Trees (${trees.length})`}
        </button>
        <button 
          className={`btn ${trees.length === 0 ? '' : 'btn-secondary'}`}
          onClick={handleImportTrees}
          disabled={!connected || isImporting}
          style={{ fontSize: '12px', padding: '8px 12px' }}
        >
          {isImporting ? 'Importing...' : 'Load Trees from JSON'}
        </button>
      </div>
      <div style={{ fontSize: '11px', color: '#888', marginTop: '8px', lineHeight: '1.3' }}>
        Save exports all trees to JSON. Load recreates trees on blockchain (costs gas).
      </div>
    </div>
  );
};

export default BackupRestore;