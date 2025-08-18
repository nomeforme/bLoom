// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./LoomNodeNFT.sol";

contract LoomTree {
    struct Node {
        bytes32 id;
        bytes32 parentId;
        bytes32[] children;
        address author;
        uint256 timestamp;
        bool isRoot;
        mapping(string => string) metadata;
        string[] metadataKeys;
    }
    
    mapping(bytes32 => Node) public nodes;
    bytes32[] public allNodes;
    bytes32 public rootId;
    address public treeOwner;
    address public factory;
    LoomNodeNFT public nftContract;
    
    event NodeCreated(
        bytes32 indexed nodeId,
        bytes32 indexed parentId,
        address indexed author,
        uint256 timestamp
    );
    
    event NodeUpdated(
        bytes32 indexed nodeId,
        address indexed author
    );
    
    event MetadataSet(
        bytes32 indexed nodeId,
        string key,
        string value
    );
    
    modifier onlyOwner() {
        require(msg.sender == treeOwner, "Only tree owner can perform this action");
        _;
    }
    
    constructor(string memory /* rootContent */, address owner, address nftContractAddress) {
        treeOwner = owner;
        factory = msg.sender;
        nftContract = LoomNodeNFT(nftContractAddress);
        // Root node will be created after authorization is set up
    }
    
    function initializeRootNodeWithToken(string memory rootContent, uint256 tokenSupply) external {
        require(rootId == bytes32(0), "Root node already initialized");
        require(msg.sender == factory, "Only factory can initialize");
        rootId = _createNodeWithToken(bytes32(0), rootContent, true, treeOwner, "NODE", "NODE", tokenSupply);
    }
    
    function addNode(bytes32 parentId, string memory content) external returns (bytes32) {
        require(nodes[parentId].id != bytes32(0) || parentId == bytes32(0), "Parent node does not exist");
        
        // Calculate token supply based on content length (characters / 4, minimum 1)
        uint256 tokenSupply = _calculateTokenSupply(content);
        return _createNodeWithToken(parentId, content, false, msg.sender, "NODE", "NODE", tokenSupply);
    }
    
    function addNodeWithToken(
        bytes32 parentId, 
        string memory content,
        string memory tokenName,
        string memory tokenSymbol
    ) external returns (bytes32) {
        require(nodes[parentId].id != bytes32(0) || parentId == bytes32(0), "Parent node does not exist");
        
        // Calculate token supply based on content length (characters / 4, minimum 1)
        uint256 tokenSupply = _calculateTokenSupply(content);
        return _createNodeWithToken(parentId, content, false, msg.sender, tokenName, tokenSymbol, tokenSupply);
    }
    
    /**
     * @dev Calculate token supply approximation based on content length
     * Formula: Math.max(1, Math.floor(content.length / 4))
     * Examples:
     * - 4 characters = 1 token (minimum)
     * - 20 characters = 5 tokens  
     * - 100 characters = 25 tokens
     * - 1000 characters = 250 tokens
     */
    function _calculateTokenSupply(string memory content) internal pure returns (uint256) {
        uint256 contentLength = bytes(content).length;
        if (contentLength == 0) return 1;
        uint256 calculated = contentLength / 4;
        return calculated > 0 ? calculated : 1; // Minimum 1 token
    }
    
    function _createNodeWithToken(
        bytes32 parentId, 
        string memory content, 
        bool isRoot, 
        address author,
        string memory tokenName,
        string memory tokenSymbol,
        uint256 tokenSupply
    ) internal returns (bytes32) {
        bytes32 nodeId = keccak256(abi.encodePacked(author, block.timestamp, content, parentId));
        
        Node storage newNode = nodes[nodeId];
        newNode.id = nodeId;
        newNode.parentId = parentId;
        newNode.author = author;
        newNode.timestamp = block.timestamp;
        newNode.isRoot = isRoot;
        
        allNodes.push(nodeId);
        
        if (!isRoot && parentId != bytes32(0)) {
            nodes[parentId].children.push(nodeId);
        }
        
        emit NodeCreated(nodeId, parentId, author, block.timestamp);
        
        // Mint NFT for the node with content and token parameters
        nftContract.mintNodeNFT(author, nodeId, content, tokenName, tokenSymbol, tokenSupply);
        
        return nodeId;
    }
    
    function updateNodeContent(bytes32 nodeId, string memory newContent) external {
        require(nodes[nodeId].id != bytes32(0), "Node does not exist");
        require(nodes[nodeId].author == msg.sender || msg.sender == treeOwner, "Not authorized to update this node");
        
        // Update the NFT metadata instead of node content
        nftContract.updateTokenContent(nodeId, newContent);
        emit NodeUpdated(nodeId, msg.sender);
    }
    
    function setNodeMetadata(bytes32 nodeId, string memory key, string memory value) external {
        require(nodes[nodeId].id != bytes32(0), "Node does not exist");
        require(nodes[nodeId].author == msg.sender || msg.sender == treeOwner, "Not authorized to update this node");
        
        // Check if key already exists
        bool keyExists = false;
        for (uint i = 0; i < nodes[nodeId].metadataKeys.length; i++) {
            if (keccak256(bytes(nodes[nodeId].metadataKeys[i])) == keccak256(bytes(key))) {
                keyExists = true;
                break;
            }
        }
        
        if (!keyExists) {
            nodes[nodeId].metadataKeys.push(key);
        }
        
        nodes[nodeId].metadata[key] = value;
        emit MetadataSet(nodeId, key, value);
    }
    
    function getNode(bytes32 nodeId) external view returns (
        bytes32 id,
        bytes32 parentId,
        bytes32[] memory children,
        address author,
        uint256 timestamp,
        bool isRoot
    ) {
        Node storage node = nodes[nodeId];
        return (
            node.id,
            node.parentId,
            node.children,
            node.author,
            node.timestamp,
            node.isRoot
        );
    }
    
    function getNodeMetadata(bytes32 nodeId, string memory key) external view returns (string memory) {
        return nodes[nodeId].metadata[key];
    }
    
    function getNodeMetadataKeys(bytes32 nodeId) external view returns (string[] memory) {
        return nodes[nodeId].metadataKeys;
    }
    
    function getChildren(bytes32 nodeId) external view returns (bytes32[] memory) {
        return nodes[nodeId].children;
    }
    
    function getAllNodes() external view returns (bytes32[] memory) {
        return allNodes;
    }
    
    function getNodeCount() external view returns (uint256) {
        return allNodes.length;
    }
    
    function getRootId() external view returns (bytes32) {
        return rootId;
    }
    
    function getNFTContract() external view returns (address) {
        return address(nftContract);
    }
}