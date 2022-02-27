// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity 0.8.10;

import {Errors} from '../libraries/Errors.sol';
import {LensHub} from "./LensHub.sol";

/**
 * @title FollowGraph
 * @author Anno Protocol
 *
 * @notice This contract implements an efficient follow graph for Lens profiles.
 * The graph is composed of nodes (profiles) and edges between nodes.
 */
contract FollowGraph {
    LensHub public lensHub;

    constructor(address _lensHub) public payable {
        lensHub = LensHub(_lensHub);
    }

    function follow(
        uint256[] calldata profileIds,
        uint256 fromProfileId,
        bytes[] calldata datas
    ) public {
        // We can save on verifying caller is fromProfileId, since it is
        // checked inside LensHub.
        // _validateCallerIsProfileOwnerOrDispatcher(fromProfileId);

        for(uint256 i = 0; i < profileIds.length; i++) {
            emit FollowEdgeChanged(fromProfileId, profileIds[i], true);
        }

        lensHub.follow(profileIds, datas);
    }

    function unfollow(
        uint256[] calldata profileIds,
        uint256 fromProfileId
    ) public {
        _validateCallerIsProfileOwnerOrDispatcher(fromProfileId);
        // We don't burn the follow NFT on purpose.
        for(uint256 i = 0; i < profileIds.length; i++) {
            emit FollowEdgeChanged(fromProfileId, profileIds[i], false);
        }
    }

    function _validateCallerIsProfileOwnerOrDispatcher(uint256 profileId) internal view {
        address dispatcher = lensHub.getDispatcher(profileId);
        if (msg.sender != lensHub.ownerOf(profileId) && msg.sender != dispatcher)
            revert Errors.NotProfileOwnerOrDispatcher();
    }

    /**
     * @dev Emitted when a follow edge is added (follow) or deleted (unfollow).
     *
     * @param fromProfileId The profile initiating the action (follow/unfollow).
     * @param toProfileId The profile being followed or unfollowed.
     * @param deleteOrCreate `false` to delete edge, `true` to create.
     */
    event FollowEdgeChanged(
        uint256 indexed fromProfileId, 
        uint256 indexed toProfileId, 
        bool deleteOrCreate
    );
}