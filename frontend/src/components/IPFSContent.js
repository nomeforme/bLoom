import React from 'react';
import { useIPFSContent } from '../hooks/useIPFSContent';

const IPFSContent = ({ content, maxLength = null, ...props }) => {
  const { content: resolvedContent, isLoading, isIPFS } = useIPFSContent(content);

  if (isLoading) {
    return <span style={{ color: '#888', fontStyle: 'italic' }} {...props}>Loading IPFS...</span>;
  }

  let displayContent = resolvedContent;
  
  // Apply maxLength if specified
  if (maxLength && displayContent && displayContent.length > maxLength) {
    displayContent = displayContent.substring(0, maxLength) + '...';
  }

  return (
    <span {...props} title={isIPFS ? `IPFS: ${content}` : undefined}>
      {displayContent}
    </span>
  );
};

export default IPFSContent;