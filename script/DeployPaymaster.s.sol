// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script, console} from "forge-std/Script.sol";
import {VerifyingPaymaster} from "../src/VerifyingPaymaster.sol";
import {IEntryPoint} from "account-abstraction/interfaces/IEntryPoint.sol";

contract DeployPaymaster is Script {
    address constant ENTRYPOINT = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;
    uint256 constant DEPOSIT_AMOUNT = 10 ether;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy Paymaster (deployer becomes owner)
        address deployer = vm.addr(deployerPrivateKey);
        VerifyingPaymaster paymaster = new VerifyingPaymaster(IEntryPoint(ENTRYPOINT), deployer);
        console.log("Paymaster deployed at:", address(paymaster));
        
        // Deposit to EntryPoint
        IEntryPoint(ENTRYPOINT).depositTo{value: DEPOSIT_AMOUNT}(address(paymaster));
        console.log("Deposited", DEPOSIT_AMOUNT, "wei to paymaster");
        
        // Verify deposit
        uint256 balance = IEntryPoint(ENTRYPOINT).balanceOf(address(paymaster));
        console.log("Paymaster balance:", balance);
        
        vm.stopBroadcast();
        
        console.log("");
        console.log("Add this to your .env:");
        console.log("VITE_PAYMASTER_ADDRESS=", address(paymaster));
    }
}
