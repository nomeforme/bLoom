import { useState, useEffect } from 'react';
import { createNFTObject, shouldFetchNFTData } from '../utils/nftUtils';
import { withGraphQLErrorHandling } from '../utils/graphqlUtils';

/**
 * Custom hook for managing NFT data for selected nodes
 * Handles fetching, caching, and state management of NFT information
 */
export const useNodeNFT = (selectedNode, currentTree, getNodeNFTInfo) => {
  const [selectedNodeNFT, setSelectedNodeNFT] = useState(null);
  const [isLoadingNFT, setIsLoadingNFT] = useState(false);

  useEffect(() => {
    const fetchNFTData = async () => {
      // Reset NFT data when no node is selected or node doesn't have NFT
      if (!shouldFetchNFTData(selectedNode)) {
        setSelectedNodeNFT(null);
        return;
      }

      setIsLoadingNFT(true);
      
      try {
        // Fetch complete NFT data including tokenSupply
        const nftData = await withGraphQLErrorHandling(
          () => getNodeNFTInfo(currentTree, selectedNode.nodeId),
          'NFT data fetch'
        );
        
        // Create NFT object with or without fetched data
        const nftObject = createNFTObject(selectedNode, nftData);
        setSelectedNodeNFT(nftObject);
        
      } catch (error) {
        // On error, create basic NFT object without extended data
        const basicNFTObject = createNFTObject(selectedNode);
        setSelectedNodeNFT(basicNFTObject);
      } finally {
        setIsLoadingNFT(false);
      }
    };

    fetchNFTData();
  }, [selectedNode, currentTree, getNodeNFTInfo]);

  return {
    selectedNodeNFT,
    isLoadingNFT
  };
};