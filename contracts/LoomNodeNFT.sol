// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract LoomNodeNFT is ERC721, Ownable {
    uint256 private _nextTokenId = 1;
    
    mapping(bytes32 => uint256) public nodeIdToTokenId;
    mapping(uint256 => bytes32) public tokenIdToNodeId;
    mapping(uint256 => string) public tokenURIs;
    mapping(address => bool) public authorizedMinters;
    
    event NodeNFTMinted(
        uint256 indexed tokenId,
        bytes32 indexed nodeId,
        address indexed owner,
        string content
    );
    
    constructor() ERC721("LoomNode", "LNODE") Ownable(msg.sender) {}
    
    modifier onlyAuthorizedMinter() {
        require(authorizedMinters[msg.sender] || msg.sender == owner(), "Not authorized to mint");
        _;
    }
    
    function addAuthorizedMinter(address minter) external onlyOwner {
        authorizedMinters[minter] = true;
    }
    
    function removeAuthorizedMinter(address minter) external onlyOwner {
        authorizedMinters[minter] = false;
    }
    
    function updateTokenContent(bytes32 nodeId, string memory newContent) external onlyAuthorizedMinter {
        uint256 tokenId = nodeIdToTokenId[nodeId];
        require(tokenId != 0, "No token exists for this node");
        
        // Create updated metadata JSON
        string memory metadata = string(abi.encodePacked(
            '{"name": "LoomNode #',
            toString(tokenId),
            '", "description": "',
            newContent,
            '", "nodeId": "',
            toHexString(uint256(nodeId)),
            '"}'
        ));
        
        tokenURIs[tokenId] = metadata;
    }
    
    function mintNodeNFT(
        address to,
        bytes32 nodeId,
        string memory content
    ) external onlyAuthorizedMinter returns (uint256) {
        require(nodeIdToTokenId[nodeId] == 0, "NFT already exists for this node");
        
        uint256 newTokenId = _nextTokenId;
        _nextTokenId++;
        
        _mint(to, newTokenId);
        
        nodeIdToTokenId[nodeId] = newTokenId;
        tokenIdToNodeId[newTokenId] = nodeId;
        
        // Create a simple metadata JSON
        string memory metadata = string(abi.encodePacked(
            '{"name": "LoomNode #',
            toString(newTokenId),
            '", "description": "',
            content,
            '", "nodeId": "',
            toHexString(uint256(nodeId)),
            '"}'
        ));
        
        tokenURIs[newTokenId] = metadata;
        
        emit NodeNFTMinted(newTokenId, nodeId, to, content);
        
        return newTokenId;
    }
    
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        require(ownerOf(tokenId) != address(0), "URI query for nonexistent token");
        return tokenURIs[tokenId];
    }
    
    function getTokenIdFromNodeId(bytes32 nodeId) external view returns (uint256) {
        return nodeIdToTokenId[nodeId];
    }
    
    function getNodeIdFromTokenId(uint256 tokenId) external view returns (bytes32) {
        return tokenIdToNodeId[tokenId];
    }
    
    function totalSupply() external view returns (uint256) {
        return _nextTokenId - 1;
    }
    
    function getNodeContent(bytes32 nodeId) external view returns (string memory) {
        uint256 tokenId = nodeIdToTokenId[nodeId];
        require(tokenId != 0, "No token exists for this node");
        return tokenURIs[tokenId];
    }
    
    // Helper function to convert uint to string
    function toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
    
    // Helper function to convert bytes32 to hex string
    function toHexString(uint256 value) internal pure returns (string memory) {
        bytes memory buffer = new bytes(64);
        for (uint256 i = 0; i < 32; i++) {
            buffer[i * 2] = _HEX_SYMBOLS[uint8(value >> (8 * (31 - i) + 4)) & 0xf];
            buffer[i * 2 + 1] = _HEX_SYMBOLS[uint8(value >> (8 * (31 - i))) & 0xf];
        }
        return string(abi.encodePacked("0x", string(buffer)));
    }
    
    bytes16 private constant _HEX_SYMBOLS = "0123456789abcdef";
}