// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IEntryPoint} from "account-abstraction/interfaces/IEntryPoint.sol";
import {BasePaymaster} from "account-abstraction/core/BasePaymaster.sol";
import {PackedUserOperation} from "account-abstraction/interfaces/PackedUserOperation.sol";

/**
 * @title VerifyingPaymaster
 * @notice シンプルな Paymaster - 全ての UserOperation を承認してガス代を支払う (テスト用)
 */
contract VerifyingPaymaster is BasePaymaster {
    constructor(IEntryPoint _entryPoint, address owner) BasePaymaster(_entryPoint, owner) {}

    /**
     * @notice UserOperation の検証 - 常に承認を返す
     */
    function _validatePaymasterUserOp(
        PackedUserOperation calldata /* userOp */,
        bytes32 /* userOpHash */,
        uint256 /* maxCost */
    ) internal pure override returns (bytes memory context, uint256 validationData) {
        // 常に承認 (validationData = 0 は成功を意味する)
        return ("", 0);
    }
}
