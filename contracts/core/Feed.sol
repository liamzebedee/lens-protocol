// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity 0.8.10;

import {DataTypes} from '../libraries/DataTypes.sol';
import {LensHub} from "./LensHub.sol";

library Errors {
    error ProfilePermissionDenied();
}

/**
 * A Feed object in the Lens open social graph.
 * 
 * A feed is a wrapper around the profile object, which permissions
 * who can and can't post to it. 
 * 
 * The feed owner can enable/disable post permissions.
 * 
 * Future ideas:
 * - convert isAuthor to NFT.
 * - convert owner to NFT (?).
 * - author module.
 */
contract Feed {
    struct ProfilePermissions {
        bool createPost;
    }

    struct FeedStruct {
        address owner;
        string name;
        uint256 profileId;

        /** Mapping of `profileId` to feed profile permissions. */
        mapping(uint256 => ProfilePermissions) permissions;
    }

    struct CreateFeedData {
        address owner;
        string name;
        string profileHandle;
        string imageURI;
        address followModule;
        bytes followModuleData;
        string followNFTURI;
    }

    struct PostToFeedData {
        uint256 feedId;
        uint256 authorProfileId;
        string contentURI;

        // TODO: Future design decisions about these variables.
        address collectModule;
        bytes collectModuleData;
        address referenceModule;
        bytes referenceModuleData;
    }

    LensHub public lensHub;

    mapping(uint256 => FeedStruct) public _feedIdToFeed;
    
    uint256 internal _feedCount;

    constructor(address _lensHub) public payable {
        lensHub = LensHub(_lensHub);
    }

    function createFeed(CreateFeedData calldata vars) external returns (uint256 feedId) {
        uint256 feedId = _feedCount;
        _feedCount++;
        
        // Create a profile.
        DataTypes.CreateProfileData memory createProfileData;
        createProfileData.to = address(this);
        // TODO: Handle is ugly.
        // 1) There's no way we can create a reasonable feedId, since anyone can claim the ID
        //    of whatever scheme we design.
        // 2) `feedId` could be encoded as a string.
        // Sooooo, this is the hack workaround.
        // if(true) {
        //     // Default profile handle.
        //     createProfileData.handle = string(abi.encodePacked(
        //         "anno.feed.",
        //         _toString(feedId)
        //     ));
        // }
        createProfileData.handle = vars.profileHandle;
        createProfileData.imageURI = vars.imageURI;
        createProfileData.followModule = vars.followModule;
        createProfileData.followModuleData = vars.followModuleData;
        createProfileData.followNFTURI = vars.followNFTURI;

        uint256 profileId = lensHub.createProfile(createProfileData);
        // lensHub.createProfile(createProfileData);
        // uint256 profileId = lensHub.getProfileIdByHandle(createProfileData.handle);
        
        // Now store it in the feed.
        _feedIdToFeed[feedId].owner = vars.owner;
        _feedIdToFeed[feedId].name = vars.name;
        _feedIdToFeed[feedId].profileId = profileId;

        emit FeedCreated(feedId, profileId, vars.owner);

        return feedId;
    }

    function getFeedData(uint256 feedId) public view returns (string memory name, address owner) {
        FeedStruct storage feed = _feedIdToFeed[feedId];
        return (feed.name, feed.owner);
    }

    function getFeedProfile(uint256 feedId) public view returns (uint256) {
        return _feedIdToFeed[feedId].profileId;
    }

    function postToFeed(PostToFeedData calldata vars) external {
        FeedStruct storage feed = _feedIdToFeed[vars.feedId];
        
        // Verify caller is in fact the author.
        // Check ownership of profile NFT.
        if(msg.sender != lensHub.ownerOf(vars.authorProfileId))
            revert("msg.sender doesn't own author NFT");

        if(!feed.permissions[vars.authorProfileId].createPost)
            revert Errors.ProfilePermissionDenied();
        
        DataTypes.PostData memory postData;
        postData.profileId = feed.profileId;
        postData.contentURI = vars.contentURI;
        postData.collectModule = vars.collectModule;
        postData.collectModuleData = vars.collectModuleData;
        postData.referenceModule = vars.referenceModule;
        postData.referenceModuleData = vars.referenceModuleData;

        // Compute expected publication id.
        uint pubId = lensHub.getPubCount(feed.profileId) + 1;
        lensHub.post(postData);

        emit PostToFeedCreated(
            vars.feedId,
            vars.authorProfileId,
            feed.profileId,
            pubId,
            block.timestamp
        );
    }

    function _onlyOwner(uint256 feedId) internal view {
        if(msg.sender != _feedIdToFeed[feedId].owner)
            revert("sender not feed owner");
    }

    function setProfilePermissions(
        uint256 feedId,
        uint256 profileId,
        bool createPost
    ) public {
        _onlyOwner(feedId);
        FeedStruct storage feed = _feedIdToFeed[feedId];
        feed.permissions[profileId].createPost = createPost;

        emit FeedProfilePermissionsSet(
            feedId,
            profileId,
            createPost
        );
    }

    function getFeedCount() public view returns (uint) {
        return _feedCount;
    }


    // 
    // 
    // LIBRARIES.
    // 
    // 
    function _toString(uint256 value) internal pure returns (string memory) {
        // Inspired by OraclizeAPI's implementation - MIT license
        // https://github.com/oraclize/ethereum-api/blob/b42146b063c7d6ee1358846c198246239e9360e8/oraclizeAPI_0.4.25.sol

        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    event FeedCreated(
        uint256 indexed feedId,
        uint256 indexed profileId,
        address indexed owner
    );

    // TODO: work on this design.
    event FeedProfilePermissionsSet(
        uint256 indexed feedId,
        uint256 indexed profileId,
        bool createPost
    );
    
    event PostToFeedCreated(
        uint256 indexed feedId,
        uint256 indexed authorProfileId,
        uint256 indexed profileId,
        uint256 pubId,
        uint256 timestamp
    );
}


// Feed
    // function postToFeed() {
        // Check author is allowed to post.
        // IAuthorModule authorModule = IAuthorModule(feed.authorModule);
        // if(!feed.authorModule.canPost(authorProfileId))
        //     revert Errors.PostNotAllowed();


// Mint an author NFT, which permits the user to post to the profile.
// contract AuthorModule {
//     constructor() public {

//     }

//     function canPost(uint256 authorProfileId) public view returns (bool) {
//         // Check for ownership of an "author NFT".
//         return true;
//     }

//     /**
//      * @dev Processes a follow by:
//      *  1. Validating that the follower has been approved for that profile by the profile owner
//      */
//     // function processFollow(
//     //     address follower,
//     //     uint256 profileId,
//     //     bytes calldata data
//     // ) external override onlyHub {
//     //     address owner = IERC721(HUB).ownerOf(profileId);
//     //     if (!_approvedByProfileByOwner[owner][profileId][follower])
//     //         revert Errors.PostNotAllowed();
//     //     _approvedByProfileByOwner[owner][profileId][follower] = false; // prevents repeat follows
//     // }
// }


