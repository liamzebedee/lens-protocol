import { task } from 'hardhat/config';
import { Feed__factory, LensHub__factory } from '../typechain-types';
import { CreateFeedDataStruct } from '../typechain-types/Feed';
import { CreateProfileDataStruct } from '../typechain-types/LensHub';
import { ProtocolState, waitForTx, initEnv, getAddrs, ZERO_ADDRESS } from './helpers/utils';

task('setup-mock-env', 'setup a mock environment with data').setAction(async ({ }, hre) => {
    const [governance, , user] = await initEnv(hre);
    const addrs = getAddrs();
    const lensHub = LensHub__factory.connect(addrs['lensHub proxy'], governance);
    const feed = Feed__factory.connect(addrs['feed'], user);

    
    
    console.log('Unpausing protocol')
    await waitForTx(lensHub.setState(ProtocolState.Unpaused));

    // Whitelisting.
    console.log('Whitelisting')
    await waitForTx(
        lensHub.whitelistProfileCreator(user.address, true)
    );
    await waitForTx(
        lensHub.whitelistProfileCreator(feed.address, true)
    );

    // Setup profiles.
    console.log('Setting up profiles')
    const profilePublisher: CreateProfileDataStruct = {
        to: user.address,
        handle: 'publisher',
        imageURI:
            'https://ipfs.fleek.co/ipfs/ghostplantghostplantghostplantghostplantghostplantghostplan',
        followModule: ZERO_ADDRESS,
        followModuleData: [],
        followNFTURI:
            'https://ipfs.fleek.co/ipfs/ghostplantghostplantghostplantghostplantghostplantghostplan',
    };

    const profileFollower: CreateProfileDataStruct = {
        to: user.address,
        handle: 'follower',
        imageURI:
            'https://ipfs.fleek.co/ipfs/ghostplantghostplantghostplantghostplantghostplantghostplan',
        followModule: ZERO_ADDRESS,
        followModuleData: [],
        followNFTURI:
            'https://ipfs.fleek.co/ipfs/ghostplantghostplantghostplantghostplantghostplantghostplan',
    };

    try {
        await waitForTx(
            lensHub.connect(user).createProfile(profilePublisher)
        );
        await waitForTx(
            lensHub.connect(user).createProfile(profileFollower)
        );
    } catch(ex) {
        console.error(ex)
    }

    console.log(
        `@publisher profileId ${await lensHub.getProfileIdByHandle('publisher')}`
    )
    console.log(
        `@follower profileId ${await lensHub.getProfileIdByHandle('follower')}`
    )


    // Create the "#announcements" feed.
    // 
    console.log('Creating feeds')
    const createFeedVars: CreateFeedDataStruct = {
        name: "announcements",
        owner: user.address,
        imageURI: "",
        followModule: ZERO_ADDRESS,
        followModuleData: [],
        followNFTURI: ""
    }
    const FEED_ID = await feed.getFeedCount()
    await waitForTx(
        feed.createFeed(createFeedVars)
    )

    console.log(`Feed id: ${await feed.getFeedCount()}`)
    console.log(`Feed profileId: ${await feed.getFeedProfile(FEED_ID)}`)


    // Add authors to the feed.
    console.log('Adding authors to feeds')
    await waitForTx(
        feed.setProfilePermissions(
            FEED_ID, 
            '1',  // user 1 id
            true
        )
    )
        
    // Create a post within #announcements.
    // 
    
    console.log('Adding posts to feeds')
    const post1 = {
        feedId: FEED_ID,
        authorProfileId: '1',
        contentURI: "",

        // TODO: Future design decisions about these variables.
        collectModule: addrs['empty collect module'],
        collectModuleData: [],
        referenceModule: addrs['follower only reference module'],
        referenceModuleData: [],
    }

    await feed.postToFeed(post1)
    await feed.postToFeed(post1)
    await feed.postToFeed(post1)


});
