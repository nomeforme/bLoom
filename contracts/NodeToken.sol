// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract NodeToken is ERC20 {
    uint256 public immutable TOTAL_SUPPLY;
    
    constructor(
        string memory name,
        string memory symbol,
        uint256 totalSupply
    ) ERC20(name, symbol) {
        TOTAL_SUPPLY = totalSupply * 10**18; // Convert to wei (18 decimals)
        _mint(msg.sender, TOTAL_SUPPLY);
    }
}