// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract NodeToken is ERC20, Ownable {
    uint256 public initialSupply;
    
    event TokensMinted(address indexed to, uint256 amount, string reason);
    event TokensBurned(address indexed from, uint256 amount, string reason);
    
    constructor(
        string memory name,
        string memory symbol,
        uint256 totalSupply
    ) ERC20(name, symbol) Ownable(msg.sender) {
        initialSupply = totalSupply * 10**18; // Convert to wei (18 decimals)
        _mint(msg.sender, initialSupply);
    }
    
    /**
     * @dev Mint new tokens to a specific address
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint (in wei)
     * @param reason Reason for minting (for logging)
     */
    function mint(address to, uint256 amount, string memory reason) external onlyOwner {
        require(to != address(0), "Cannot mint to zero address");
        require(amount > 0, "Amount must be greater than 0");
        
        _mint(to, amount);
        emit TokensMinted(to, amount, reason);
    }
    
    /**
     * @dev Burn tokens from a specific address
     * @param from Address to burn tokens from
     * @param amount Amount of tokens to burn (in wei)
     * @param reason Reason for burning (for logging)
     */
    function burn(address from, uint256 amount, string memory reason) external onlyOwner {
        require(from != address(0), "Cannot burn from zero address");
        require(amount > 0, "Amount must be greater than 0");
        require(balanceOf(from) >= amount, "Insufficient balance to burn");
        
        _burn(from, amount);
        emit TokensBurned(from, amount, reason);
    }
    
    /**
     * @dev Convert units to wei (add decimals)
     */
    function toWei(uint256 units) external view returns (uint256) {
        return units * 10**decimals();
    }
    
    /**
     * @dev Convert wei to units (remove decimals)
     */
    function fromWei(uint256 weiAmount) external view returns (uint256) {
        return weiAmount / 10**decimals();
    }
}