import React from 'react';

const GasTrackerModal = ({
  showGasModal,
  setShowGasModal,
  totalGasCost,
  nativeCurrencySymbol,
  gasTransactions,
  clearGasTransactions
}) => {
  if (!showGasModal) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'transparent',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: '#2a2a2a',
        border: '1px solid #666',
        borderRadius: '8px',
        padding: '20px',
        maxWidth: '600px',
        maxHeight: '80vh',
        width: '90%',
        overflow: 'auto',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ color: '#4CAF50', margin: 0 }}>Gas Tracker</h3>
          <button
            onClick={() => setShowGasModal(false)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#999',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '0'
            }}
          >
            ×
          </button>
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            padding: '10px',
            backgroundColor: '#1a1a1a',
            border: '1px solid #4CAF50',
            borderRadius: '6px'
          }}>
            <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>
              Total Gas Cost: {totalGasCost.toFixed(6)} {nativeCurrencySymbol}
            </span>
            <button
              onClick={clearGasTransactions}
              style={{
                padding: '4px 8px',
                fontSize: '11px',
                backgroundColor: '#1a1a1a',
                border: '1px solid #666',
                borderRadius: '4px',
                color: '#ccc',
                cursor: 'pointer',
                fontFamily: "'Inconsolata', monospace",
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#2a2a2a';
                e.target.style.borderColor = '#888';
                e.target.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#1a1a1a';
                e.target.style.borderColor = '#666';
                e.target.style.color = '#ccc';
              }}
            >
              Clear All
            </button>
          </div>
        </div>

        <div style={{ marginBottom: '10px' }}>
          <span style={{ color: '#ccc', fontSize: '14px' }}>
            {gasTransactions.length} transaction{gasTransactions.length !== 1 ? 's' : ''}
          </span>
        </div>

        {gasTransactions.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            color: '#999', 
            padding: '20px',
            fontStyle: 'italic'
          }}>
            No gas transactions recorded yet.
            <br />
            Create trees, add nodes, or edit content to start tracking gas costs.
          </div>
        ) : (
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {gasTransactions
              .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
              .map((tx) => (
              <div
                key={tx.id}
                style={{
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #444',
                  borderRadius: '6px',
                  padding: '12px',
                  marginBottom: '8px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <div style={{ color: '#4CAF50', fontWeight: 'bold', marginBottom: '4px' }}>
                      {tx.type}
                    </div>
                    <div style={{ color: '#ccc', fontSize: '12px' }}>
                      {tx.description}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#4CAF50', fontWeight: 'bold' }}>
                      {parseFloat(tx.gasCost).toFixed(6)} {nativeCurrencySymbol}
                    </div>
                    <div style={{ color: '#999', fontSize: '11px' }}>
                      {new Date(tx.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
                
                <div style={{ borderTop: '1px solid #333', paddingTop: '8px', fontSize: '11px', color: '#999' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>Gas Used: {tx.gasUsed?.toLocaleString() || 'N/A'}</div>
                    <div>Gas Price: {tx.gasPrice ? `${(parseFloat(tx.gasPrice) / 1e9).toFixed(2)} Gwei` : 'N/A'}</div>
                  </div>
                  <div style={{ marginTop: '4px', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    Tx: {tx.txHash || 'N/A'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GasTrackerModal;