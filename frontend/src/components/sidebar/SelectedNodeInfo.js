import React from 'react';
import { parseNFTMetadata, formatTokenSupply } from '../../utils/nftUtils';

const SelectedNodeInfo = ({
  selectedNode,
  selectedNodeNFT,
  nodeHasNFT,
  currentTree,
  currentTokenBalance,
  isLoadingBalance
}) => {
  const ellipseAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const copyToClipboard = async (address) => {
    try {
      await navigator.clipboard.writeText(address);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  if (!selectedNode) {
    return null;
  }

  // Debug logging for IPFS hash
  console.log('🔍 SelectedNodeInfo - selectedNode:', {
    selectedNode: selectedNode,
    nodeId: selectedNode.nodeId?.substring(0, 10) + '...',
    hasNFT: selectedNode.hasNFT,
    ipfsHash: selectedNode.ipfsHash,
    ipfsHashType: typeof selectedNode.ipfsHash,
    ipfsHashTruthy: !!selectedNode.ipfsHash
  });

  return (
    <div className="section">
      <h3>Selected Node</h3>
      <div className="node-info">
        {/* Node Info */}
        <h4 style={{ color: '#4CAF50', marginBottom: '8px' }}>LoomTree: Node Info</h4>
        <div style={{ 
          backgroundColor: '#1a1a1a', 
          border: '1px solid #4CAF50',
          borderRadius: '6px',
          padding: '10px',
          marginBottom: '15px'
        }}>
          <div style={{ fontSize: '12px', color: '#4CAF50', marginBottom: '8px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>
              Node ID:
            </div>
            <div style={{ 
              backgroundColor: '#0a0a0a',
              border: '1px solid #333',
              borderRadius: '4px',
              padding: '6px',
              fontFamily: 'monospace',
              fontSize: '10px',
              wordBreak: 'break-all',
              marginBottom: '8px',
              cursor: 'pointer'
            }}
            onClick={() => copyToClipboard(selectedNode.id)}
            title="Click to copy full address"
            >
              {selectedNode.id}
            </div>
            <div style={{ fontSize: '10px', color: '#ccc', lineHeight: '1.3' }}>
              <div>• Created: {new Date(selectedNode.timestamp * 1000).toLocaleString()}</div>
              <div>• Author: {ellipseAddress(selectedNode.author)}</div>
              <div>• Parent: {selectedNode.parentId && selectedNode.parentId !== '0x0000000000000000000000000000000000000000000000000000000000000000' ? ellipseAddress(selectedNode.parentId) : 'Root Node'}</div>
              <div>• Children: <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>{currentTree?.nodes ? currentTree.nodes.filter(node => node.parentId === selectedNode.id).length : 0}</span></div>
              <div>• Model: <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>{selectedNode.modelId || 'manual'}</span></div>
            </div>
            <div style={{ borderTop: '1px solid #333', marginTop: '8px', paddingTop: '6px', fontSize: '11px', color: '#666', textAlign: 'center' }}>
              Node Author: <span style={{ cursor: 'pointer', fontWeight: 'bold' }} onClick={() => copyToClipboard(selectedNode.author)} title="Click to copy full address">{ellipseAddress(selectedNode.author)}</span>
            </div>
          </div>
        </div>

        {/* NFT Information - Only show for nodes with NFT/tokens */}
        {nodeHasNFT && (
          <>
            <h4 style={{ color: '#4CAF50', marginBottom: '8px' }}>ERC721: Node NFT</h4>
        {selectedNodeNFT ? (
          <div style={{ 
            backgroundColor: '#1a1a1a', 
            border: '1px solid #4CAF50',
            borderRadius: '6px',
            padding: '10px',
            marginBottom: '15px'
          }}>
            <div style={{ fontSize: '12px', color: '#4CAF50', marginBottom: '8px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>
                NFT Contract Address:
              </div>
              <div style={{ 
                backgroundColor: '#0a0a0a',
                border: '1px solid #333',
                borderRadius: '4px',
                padding: '6px',
                fontFamily: 'monospace',
                fontSize: '10px',
                wordBreak: 'break-all',
                marginBottom: '8px',
                cursor: 'pointer'
              }}
              onClick={() => currentTree?.nftAddress && copyToClipboard(currentTree.nftAddress)}
              title="Click to copy full address"
              >
                {currentTree?.nftAddress || 'N/A'}
              </div>
              <div style={{ fontWeight: 'bold' }}>NFT Token ID: #{selectedNodeNFT.tokenId}</div>
            </div>
            
            {/* Display the most recent NFT content */}
            <div style={{ 
              backgroundColor: '#0a0a0a',
              border: '1px solid #333',
              borderRadius: '4px',
              padding: '8px',
              marginBottom: '8px',
              fontSize: '11px'
            }}>
              {(() => {
                const content = selectedNodeNFT.latestContent || selectedNode.content || selectedNodeNFT.content || '';
                const maxLength = 300;
                if (content.length > maxLength) {
                  return content.substring(0, maxLength) + '...';
                }
                return content;
              })()}
            </div>
            
            <div style={{ borderTop: '1px solid #333', marginTop: '8px', paddingTop: '6px', paddingBottom: '8px', fontSize: '11px', color: '#666', textAlign: 'center' }}>
              NFT Held By: {selectedNode?.author ? <span style={{ cursor: 'pointer', fontWeight: 'bold' }} onClick={() => copyToClipboard(selectedNode.author)} title="Click to copy full address">{ellipseAddress(selectedNode.author)}</span> : 'N/A'}
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
            <div style={{ fontSize: '12px', color: '#4CAF50', marginBottom: '8px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>
                NFT Contract Address:
              </div>
              <div style={{ 
                backgroundColor: '#0a0a0a',
                border: '1px solid #333',
                borderRadius: '4px',
                padding: '6px',
                fontFamily: 'monospace',
                fontSize: '10px',
                wordBreak: 'break-all',
                marginBottom: '8px',
                cursor: 'pointer'
              }}
              onClick={() => currentTree?.nftAddress && copyToClipboard(currentTree.nftAddress)}
              title="Click to copy full address"
              >
                {currentTree?.nftAddress || 'N/A'}
              </div>
            </div>
            <div style={{ fontSize: '11px', color: '#888', textAlign: 'center', fontStyle: 'italic' }}>
              {selectedNode ? 'Loading content from NFT...' : 'No content available'}
            </div>
            <div style={{ borderTop: '1px solid #333', marginTop: '8px', paddingTop: '6px', paddingBottom: '8px', fontSize: '11px', color: '#666', textAlign: 'center' }}>
              NFT Held By: {selectedNode?.author ? <span style={{ cursor: 'pointer', fontWeight: 'bold' }} onClick={() => copyToClipboard(selectedNode.author)} title="Click to copy full address">{ellipseAddress(selectedNode.author)}</span> : 'N/A'}
            </div>
          </div>
        )}
          </>
        )}

        {/* Node Token Information - Only show for nodes with NFT/tokens */}
        {nodeHasNFT && (
          <>
            <h4 style={{ color: '#4CAF50', marginBottom: '8px', marginTop: '15px' }}>ERC20: Node Token</h4>
        {selectedNodeNFT && (selectedNodeNFT.nodeTokenContract || selectedNode.nodeTokenContract) ? (
          <div style={{ 
            backgroundColor: '#1a1a1a', 
            border: '1px solid #4CAF50',
            borderRadius: '6px',
            padding: '10px',
            marginBottom: '15px'
          }}>
            <div style={{ fontSize: '12px', color: '#4CAF50', marginBottom: '8px' }}>
              {(() => {
                const nodeTokenContract = selectedNodeNFT.nodeTokenContract || selectedNode.nodeTokenContract;
                const tokenBoundAccount = selectedNodeNFT.tokenBoundAccount || selectedNode.tokenBoundAccount;
                const metadata = {
                  ...parseNFTMetadata(selectedNodeNFT.content || ''),
                  tokenSupply: selectedNodeNFT.tokenSupply
                };
                
                if (nodeTokenContract) {
                  return (
                    <div>
                      <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>
                        Token Contract:
                      </div>
                      <div style={{ 
                        backgroundColor: '#0a0a0a',
                        border: '1px solid #333',
                        borderRadius: '4px',
                        padding: '6px',
                        fontFamily: 'monospace',
                        fontSize: '10px',
                        wordBreak: 'break-all',
                        marginBottom: '8px',
                        cursor: 'pointer'
                      }}
                      onClick={() => copyToClipboard(nodeTokenContract)}
                      title="Click to copy full address"
                      >
                        {nodeTokenContract}
                      </div>
                      <div style={{ fontSize: '10px', color: '#ccc', lineHeight: '1.3' }}>
                        <div>• Token Name: {metadata?.tokenName || 'NODE'}</div>
                        <div>• Token Symbol: {metadata?.tokenSymbol || 'NODE'}</div>
                        <div>• Initial Supply: {formatTokenSupply(metadata?.tokenSupply)} {metadata?.tokenSymbol || 'NODE'}</div>
                        <div>
                          • Current Balance: <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>
                            {
                              isLoadingBalance ? 'Loading...' : 
                              currentTokenBalance !== null ? currentTokenBalance : 
                              'N/A'
                            }
                          </span> {currentTokenBalance !== null && !isLoadingBalance ? (metadata?.tokenSymbol || 'NODE') : ''}
                        </div>
                        <div>• Token Type: ERC20</div>
                        <div>• Held by Token Bound Account</div>
                      </div>
                      <div style={{ borderTop: '1px solid #333', marginTop: '8px', paddingTop: '6px', fontSize: '11px', color: '#666', textAlign: 'center' }}>
                        Held by TBA: {tokenBoundAccount ? <span style={{ cursor: 'pointer', fontWeight: 'bold' }} onClick={() => copyToClipboard(tokenBoundAccount)} title="Click to copy full address">{ellipseAddress(tokenBoundAccount)}</span> : 'N/A'}
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div>
                      <div style={{ fontSize: '11px', color: '#888', textAlign: 'center', fontStyle: 'italic' }}>
                        No Node Token contract found
                      </div>
                      <div style={{ borderTop: '1px solid #333', marginTop: '8px', paddingTop: '6px', fontSize: '11px', color: '#666', textAlign: 'center' }}>
                        NFT Address: {currentTree?.nftAddress ? <span style={{ cursor: 'pointer', fontWeight: 'bold' }} onClick={() => copyToClipboard(currentTree.nftAddress)} title="Click to copy full address">{ellipseAddress(currentTree.nftAddress)}</span> : 'N/A'}
                      </div>
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
            <div style={{ borderTop: '1px solid #333', marginTop: '8px', paddingTop: '6px', fontSize: '11px', color: '#666', textAlign: 'center' }}>
              Held by TBA: <span style={{ fontWeight: 'bold' }}>N/A</span>
            </div>
          </div>
        )}
          </>
        )}

        {/* Token Bound Account (TBA) Information - Only show for nodes with NFT/tokens */}
        {nodeHasNFT && (
          <>
            <h4 style={{ color: '#4CAF50', marginBottom: '8px', marginTop: '15px' }}>ERC6551: Node NFT TBA</h4>
        {selectedNodeNFT && (selectedNodeNFT.tokenBoundAccount || selectedNode.tokenBoundAccount) ? (
          <div style={{ 
            backgroundColor: '#1a1a1a', 
            border: '1px solid #4CAF50',
            borderRadius: '6px',
            padding: '10px',
            marginBottom: '15px'
          }}>
            <div style={{ fontSize: '12px', color: '#4CAF50', marginBottom: '8px' }}>
              {(() => {
                const tokenBoundAccount = selectedNodeNFT.tokenBoundAccount || selectedNode.tokenBoundAccount;
                
                if (tokenBoundAccount) {
                  return (
                    <div>
                      <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>
                        Account Address:
                      </div>
                      <div style={{ 
                        backgroundColor: '#0a0a0a',
                        border: '1px solid #333',
                        borderRadius: '4px',
                        padding: '6px',
                        fontFamily: 'monospace',
                        fontSize: '10px',
                        wordBreak: 'break-all',
                        marginBottom: '8px',
                        cursor: 'pointer'
                      }}
                      onClick={() => copyToClipboard(tokenBoundAccount)}
                      title="Click to copy full address"
                      >
                        {tokenBoundAccount}
                      </div>
                      <div style={{ fontSize: '10px', color: '#ccc', lineHeight: '1.3' }}>
                        <div>• This NFT has its own Ethereum account</div>
                        <div>• Can hold assets and execute transactions</div>
                        <div>• Account controlled by NFT owner</div>
                        <div>• Account transfers with NFT ownership</div>
                      </div>
                      <div style={{ borderTop: '1px solid #333', marginTop: '8px', paddingTop: '6px', fontSize: '11px', color: '#666', textAlign: 'center' }}>
                        NFT Address: {currentTree?.nftAddress ? <span style={{ cursor: 'pointer', fontWeight: 'bold' }} onClick={() => copyToClipboard(currentTree.nftAddress)} title="Click to copy full address">{ellipseAddress(currentTree.nftAddress)}</span> : 'N/A'}
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div>
                      <div style={{ fontSize: '11px', color: '#888', textAlign: 'center', fontStyle: 'italic' }}>
                        No Token Bound Account found
                      </div>
                      <div style={{ borderTop: '1px solid #333', marginTop: '8px', paddingTop: '6px', fontSize: '11px', color: '#666', textAlign: 'center' }}>
                        NFT Address: {currentTree?.nftAddress ? <span style={{ cursor: 'pointer', fontWeight: 'bold' }} onClick={() => copyToClipboard(currentTree.nftAddress)} title="Click to copy full address">{ellipseAddress(currentTree.nftAddress)}</span> : 'N/A'}
                      </div>
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
            <div style={{ borderTop: '1px solid #333', marginTop: '8px', paddingTop: '6px', fontSize: '11px', color: '#666', textAlign: 'center' }}>
              NFT Address: {currentTree?.nftAddress ? <span style={{ cursor: 'pointer', fontWeight: 'bold' }} onClick={() => copyToClipboard(currentTree.nftAddress)} title="Click to copy full address">{ellipseAddress(currentTree.nftAddress)}</span> : 'N/A'}
            </div>
          </div>
        )}
          </>
        )}

        {/* Lightweight Mode Info for nodes without NFT/tokens */}
        {!nodeHasNFT && selectedNode && (
          <>
            <h4 style={{ color: '#4CAF50', marginBottom: '8px', marginTop: '15px' }}>LoomNode: Content</h4>
            <div style={{ 
              backgroundColor: '#1a1a1a', 
              border: '1px solid #4CAF50',
              borderRadius: '6px', 
              padding: '10px',
              marginBottom: '15px'
            }}>
              {/* Always show content */}
              <div style={{ 
                backgroundColor: '#0a0a0a',
                border: '1px solid #333',
                borderRadius: '4px',
                padding: '8px',
                marginBottom: '8px',
                fontSize: '11px'
              }}>
                {(() => {
                  const content = selectedNode.content || '';
                  const maxLength = 300;
                  if (content.length > maxLength) {
                    return content.substring(0, maxLength) + '...';
                  }
                  return content;
                })()}
              </div>

              {/* Show IPFS hash below content if available */}
              {selectedNode.ipfsHash && (
                <>
                  <div style={{ fontSize: '12px', color: '#4CAF50', marginBottom: '8px' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>
                      IPFS Hash:
                    </div>
                    <div style={{ 
                      backgroundColor: '#0a0a0a',
                      border: '1px solid #333',
                      borderRadius: '4px',
                      padding: '6px',
                      fontFamily: 'monospace',
                      fontSize: '10px',
                      wordBreak: 'break-all',
                      marginBottom: '8px',
                      cursor: 'pointer'
                    }}
                    onClick={() => copyToClipboard(selectedNode.ipfsHash)}
                    title="Click to copy IPFS hash"
                    >
                      {selectedNode.ipfsHash}
                    </div>
                  </div>
                </>
              )}
              
              <div style={{ fontSize: '10px', color: '#ccc', lineHeight: '1.3', textAlign: 'left' }}>
                <div>• Content stored {selectedNode.ipfsHash ? 'on IPFS' : 'in LoomTree'}</div>
                <div>• No NFT, ERC20, or ERC6551 account</div>
                {selectedNode.ipfsHash && (
                  <div>• Gas optimized storage mode</div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SelectedNodeInfo;