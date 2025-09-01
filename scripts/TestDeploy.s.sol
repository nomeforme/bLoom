// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../contracts/ERC6551Registry.sol";
import "../contracts/examples/simple/ERC6551Account.sol";
import "../contracts/LoomNodeNFT.sol";
import "../contracts/NodeToken.sol";

contract TestDeploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("Deploying ERC6551Registry...");
        ERC6551Registry registry = new ERC6551Registry();
        console.log("Registry deployed to:", address(registry));
        
        console.log("Deploying ERC6551Account implementation...");
        ERC6551Account implementation = new ERC6551Account();
        console.log("Implementation deployed to:", address(implementation));
        
        console.log("Deploying LoomNodeNFT...");
        LoomNodeNFT nftContract = new LoomNodeNFT(
            address(registry),
            address(implementation),
            keccak256("LoomNode")
        );
        console.log("NFT Contract deployed to:", address(nftContract));
        
        console.log("Testing NodeToken deployment...");
        NodeToken testToken = new NodeToken("TEST", "TST", 100);
        console.log("Test token deployed to:", address(testToken));
        
        vm.stopBroadcast();
    }
}