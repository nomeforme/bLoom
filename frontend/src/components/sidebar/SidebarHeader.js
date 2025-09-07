import React from 'react';

const SidebarHeader = ({
  connected,
  account,
  onConnect,
  onDisconnect,
  totalGasCost,
  nativeCurrencySymbol,
  storageMode,
  setShowGasModal
}) => {
  const ellipseAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div style={{ marginBottom: '15px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
        <h2 style={{ 
          color: '#4CAF50', 
          fontSize: '24px', 
          fontWeight: 'bold',
          margin: '0'
        }}>bLoom</h2>
        
        {connected ? (
          <button 
            onClick={onDisconnect}
            style={{ 
              padding: '6px 12px', 
              fontSize: '12px',
              minWidth: 'auto',
              backgroundColor: '#1a1a1a',
              border: '1px solid #4CAF50',
              borderRadius: '4px',
              color: '#4CAF50',
              cursor: 'pointer',
              fontFamily: "'Inconsolata', monospace",
              transition: 'all 0.3s ease',
              outline: 'none'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#2a2a2a';
              e.target.style.borderColor = '#45a049';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = '#1a1a1a';
              e.target.style.borderColor = '#4CAF50';
            }}
          >
            Disconnect
          </button>
        ) : (
          <button className="btn" onClick={onConnect} style={{ fontSize: '12px', padding: '6px 12px' }}>
            Connect Wallet
          </button>
        )}
      </div>
      
      {connected && (
        <div>
          <div style={{ 
            fontSize: '14px', 
            color: '#4CAF50', 
            marginBottom: '2px',
            fontWeight: 'bold'
          }}>
            {ellipseAddress(account)}
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div 
              style={{ 
                fontSize: '12px', 
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
              onClick={() => setShowGasModal(true)}
              title="Press R to toggle gas tracker modal"
            >
              <span style={{ color: '#999' }}>Gas Used: </span>
              <span style={{ color: '#4CAF50' }}>{totalGasCost.toFixed(4)} {nativeCurrencySymbol}</span>
            </div>
            <div style={{
              fontSize: '12px',
              fontFamily: "'Inconsolata', monospace",
              fontWeight: 'bold'
            }}>
              <span style={{ color: '#999' }}>Mode: </span>
              <span style={{ color: '#4CAF50' }}>{storageMode.toUpperCase()}</span>
            </div>
          </div>
        </div>
      )}
      
      <div style={{ borderBottom: '1px solid #444', paddingBottom: '5px' }}></div>
    </div>
  );
};

export default SidebarHeader;