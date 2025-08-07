// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract NodeToken is ERC20 {
    uint256 public constant TOTAL_SUPPLY = 1000 * 10**18; // 1000 tokens with 18 decimals
    
    constructor() ERC20("NODE", "NODE") {
        _mint(msg.sender, TOTAL_SUPPLY);
    }
}