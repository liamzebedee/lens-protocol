// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity 0.8.10;

import {Errors} from '../libraries/Errors.sol';
import {DataTypes} from '../libraries/DataTypes.sol';
import {Events} from "../libraries/Events.sol";
import {LensHub} from "./LensHub.sol";

contract FollowGraph {
    LensHub public lensHub;

    constructor(address _lensHub) public payable {
        lensHub = LensHub(_lensHub);
    }

    function follow(
        uint256 profileId,
        uint256 fromProfileId
    ) public {
        emit FollowEdgeChanged(fromProfileId, profileId, true);
    }

    function unfollow(
        uint256 profileId,
        uint256 fromProfileId
    ) public {
        emit FollowEdgeChanged(fromProfileId, profileId, false);
    }

    event FollowEdgeChanged(uint256 from, uint256 to, bool deleteOrCreate);
}