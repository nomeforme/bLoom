// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../contracts/LoomFactory.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);
        
        LoomFactory factory = new LoomFactory();
        
        console.log("LoomFactory deployed to:", address(factory));
        
        vm.stopBroadcast();
    }
}