// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./LoomNodeNFT.sol";
import "./ERC6551Registry.sol";

contract LoomNFTFactory {
    ERC6551Registry public immutable registry;
    address public immutable accountImplementation;
    bytes32 public immutable salt;
    
    event NFTContractCreated(
        address indexed nftContract,
        address indexed creator,
        bytes32 indexed treeId
    );
    
    constructor(
        address _registry,
        address _accountImplementation,
        bytes32 _salt
    ) {
        registry = ERC6551Registry(_registry);
        accountImplementation = _accountImplementation;
        salt = _salt;
    }
    
    function createNFTContract(bytes32 treeId) external returns (address) {
        LoomNodeNFT nftContract = new LoomNodeNFT(
            address(registry),
            accountImplementation,
            salt
        );
        
        address nftAddress = address(nftContract);
        
        // Transfer ownership to the caller (LoomFactory)
        nftContract.transferOwnership(msg.sender);
        
        emit NFTContractCreated(nftAddress, msg.sender, treeId);
        
        return nftAddress;
    }
}