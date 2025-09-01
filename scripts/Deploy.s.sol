// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../contracts/LoomFactory.sol";

contract Deploy is Script {
    function run() external {
        vm.startBroadcast();
        
        LoomFactory factory = new LoomFactory();
        
        console.log("LoomFactory deployed to:", address(factory));
        
        vm.stopBroadcast();
    }
}