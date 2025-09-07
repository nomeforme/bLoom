import React from 'react';

const Instructions = ({ shortcutsManager, ipfsAvailable }) => {
  return (
    <div className="section">
      <h3>Instructions</h3>
      {(() => {
        // Define shortcut variables to avoid clutter in JSX
        const createTreeKey = shortcutsManager.getShortcut('createTreeModal')?.symbol || 'T';
        const editNodeKey = shortcutsManager.getShortcut('editNode')?.symbol || 'G';
        const generateChildrenKey = shortcutsManager.getShortcut('generateChildren')?.symbol || '⏎';
        const generateSiblingsKey = shortcutsManager.getShortcut('generateSiblings')?.symbol || '⇧⏎';
        const pathViewKey = shortcutsManager.getShortcut('storyView')?.symbol || 'Q';
        const treeViewKey = shortcutsManager.getShortcut('hierarchyView')?.symbol || 'E';
        const previousTreeKey = shortcutsManager.getShortcut('previousTree')?.symbol || '↑';
        const nextTreeKey = shortcutsManager.getShortcut('nextTree')?.symbol || '↓';
        const previousModelKey = shortcutsManager.getShortcut('previousModel')?.symbol || 'Z';
        const nextModelKey = shortcutsManager.getShortcut('nextModel')?.symbol || 'C';
        const gasTrackerKey = shortcutsManager.getShortcut('gasTracker')?.symbol || 'R';
        const storageModeKey = shortcutsManager.getShortcut('lightweightMode')?.symbol || 'L';
        
        // Navigation shortcuts (WASD)
        const navUpKey = shortcutsManager.getShortcut('up')?.symbol || 'W';
        const navDownKey = shortcutsManager.getShortcut('down')?.symbol || 'S';
        const navLeftKey = shortcutsManager.getShortcut('left')?.symbol || 'A';
        const navRightKey = shortcutsManager.getShortcut('right')?.symbol || 'D';
        const deselectKey = shortcutsManager.getShortcut('deselect')?.symbol || 'Esc';
        
        return (
          <div style={{ fontSize: '12px', color: '#ccc', lineHeight: '1.4' }}>
            <p><strong style={{ color: '#4CAF50' }}>Interface:</strong></p>
            <p>1. Connect your wallet to interact with the blockchain</p>
            <p>2. Create trees using the "Create New Tree" section or press <strong>{createTreeKey}</strong></p>
            <p>3. Navigate nodes: <strong>{navUpKey}/{navDownKey}</strong> siblings, <strong>{navLeftKey}</strong> parent, <strong>{navRightKey}</strong> first child, <strong>{deselectKey}</strong> deselect</p>
            <p>4. Press <strong>{editNodeKey}</strong> to edit content</p>
            <p>5. Use "Generate Children" or press <strong>{generateChildrenKey}</strong> for sub-branches</p>
            <p>6. Use "Generate Siblings" or press <strong>{generateSiblingsKey}</strong> for alternatives</p>
            <p>7. Switch views: <strong>{pathViewKey}</strong> for Path View, <strong>{treeViewKey}</strong> for Tree View</p>
            <p>8. Navigate trees with <strong>{previousTreeKey}/{nextTreeKey}</strong> arrows, models with <strong>{previousModelKey}/{nextModelKey}</strong></p>
            <p>9. Press <strong>{gasTrackerKey}</strong> to view gas tracker details</p>
            <p>10. Press <strong>{storageModeKey}</strong> to cycle storage modes (Full → Lightweight → IPFS)</p>
            <p><strong style={{ color: '#4CAF50' }}>Blockchain Architecture:</strong></p>
            <p>1. <strong>LoomFactory:</strong> Deploys new tree contracts + individual NFT contracts per tree</p>
            <p>2. <strong>LoomTree:</strong> Each tree is a separate contract storing nodes + metadata</p>
            <p>3. <strong>LoomNodeNFT:</strong> Per-tree ERC721 contract mints NFTs for nodes within that tree</p>
            <p>4. <strong>NodeToken:</strong> Each node gets its own ERC20 contract</p>
            <p>5. <strong>ERC6551 TBA:</strong> Each NFT gets a Token Bound Account holding its tokens</p>
            <p>6. <strong>Token Economics:</strong> Tokens mint/burn based on content length (4 chars = 1 token)</p>
            <p>7. <strong>AI Generation:</strong> Uses completion token count as new node's token supply</p>
            <p><strong style={{ color: '#4CAF50' }}>Storage Modes:</strong></p>
            <p>1. <strong style={{ color: '#ccc' }}>Full:</strong> NFT + ERC20 tokens + TBA</p>
            <p>2. <strong style={{ color: '#ccc' }}>Lightweight:</strong> Direct contract storage</p>
            {ipfsAvailable && <p>3. <strong style={{ color: '#ccc' }}>IPFS:</strong> Pin to IPFS, store hash only</p>}
          </div>
        );
      })()}
    </div>
  );
};

export default Instructions;