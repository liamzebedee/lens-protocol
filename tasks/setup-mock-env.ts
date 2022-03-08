import { task } from 'hardhat/config';
import { Events__factory, Feed__factory, FollowGraph__factory, FollowNFT__factory, LensHub__factory, MockProfileCreationProxy__factory } from '../typechain-types';
import { CreateFeedDataStruct } from '../typechain-types/Feed';
import { CreateProfileDataStruct } from '../typechain-types/LensHub';
import { ProtocolState, waitForTx, initEnv, getAddrs, ZERO_ADDRESS } from './helpers/utils';
import { uploadToIpfs } from '../helpers/ipfs'
import { loadDeploymentCtx, loadLensDeployment } from './helpers/deployments'  
import { join } from 'path';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
const fs = require('fs')



task('setup-mock-env', 'setup a mock environment with data').setAction(async ({ }, hre) => {
    console.log(hre.network.name)
    if(hre.network.name == "hardhat") {
        console.error("Error: the in-built Hardhat environment contains no Lens deployment. You probably want '--network localhost' instead.")
        return
    }

    if(hre.network.name == 'mumbai') return mockEnvMainnet(hre)

    const [governance, , user] = await initEnv(hre);
    
    const addrs = loadLensDeployment(hre.network.name);
    const ctx = loadDeploymentCtx({
        network: hre.network.name,
        project: 'anno',
        provider: hre.ethers.provider
    })

    let lensHub = LensHub__factory.connect(ctx.getAddress('LensHubProxy'), governance);
    const feed = Feed__factory.connect(ctx.getAddress('FeedProxy'), user);
    const followGraph = FollowGraph__factory.connect(ctx.getAddress('FollowGraph'), user)
    
    console.log('Unpausing protocol')
    await waitForTx(lensHub.setState(ProtocolState.Unpaused));

    // Events are emitted from the proxy contract.
    const Events = Events__factory.connect(ctx.getAddress('LensHubProxy'), user)
    Events.on(Events.filters.PostCreated(), function() {
        console.log(`PostCreated`, arguments)
    })
    // Events.on(Events.filters.ProfileCreated(), (ev) => {
    //     console.log(`ProfileCreated`, ev)
    // })
    
    // Whitelisting.
    console.log('Whitelisting')
    await waitForTx(
        lensHub.whitelistProfileCreator(user.address, true)
    );
    await waitForTx(
        lensHub.whitelistProfileCreator(feed.address, true)
    );
    await waitForTx(
        lensHub.whitelistProfileCreator(ctx.getAddress('Feed'), true)
    );
    // Metamask
    await waitForTx(
        lensHub.whitelistProfileCreator('0xc783df8a850f42e7F7e57013759C285caa701eB6', true)
    )

    lensHub = lensHub.connect(user)

    // Setup profiles.
    console.log('Setting up profiles')
    const profilePublisher: CreateProfileDataStruct = {
        to: user.address,
        handle: "publisher."+(Date.now().toString().slice(-8)),
        imageURI:
            'https://ipfs.fleek.co/ipfs/ghostplantghostplantghostplantghostplantghostplantghostplan',
        followModule: ZERO_ADDRESS,
        followModuleData: [],
        followNFTURI:
            'https://ipfs.fleek.co/ipfs/ghostplantghostplantghostplantghostplantghostplantghostplan',
    };

    const profileFollower: CreateProfileDataStruct = {
        to: user.address,
        handle: "follower." + (Date.now().toString().slice(-8)),
        imageURI:
            'https://ipfs.fleek.co/ipfs/ghostplantghostplantghostplantghostplantghostplantghostplan',
        followModule: ZERO_ADDRESS,
        followModuleData: [],
        followNFTURI:
            'https://ipfs.fleek.co/ipfs/ghostplantghostplantghostplantghostplantghostplantghostplan',
    };

    try {
        await waitForTx(
            lensHub.createProfile(profilePublisher)
        );
        await waitForTx(
            lensHub.createProfile(profileFollower)
        );
    } catch(ex) {
        console.error(ex)
    }

    const PUBLISHER_PROFILE_ID = await lensHub.getProfileIdByHandle(profilePublisher.handle)
    const FOLLOWER_PROFILE_ID = await lensHub.getProfileIdByHandle(profileFollower.handle)
    console.log(
        `@publisher profileId ${PUBLISHER_PROFILE_ID}`
    )
    console.log(
        `@follower profileId ${FOLLOWER_PROFILE_ID}`
    )



    // Create the "#announcements" feed.
    // 
    console.log('Creating feeds')
    const createFeedVars: CreateFeedDataStruct = {
        name: "announcements",
        profileHandle: "announcements."+(Date.now().toString().slice(-8)),
        owner: user.address,
        imageURI: "",
        followModule: ZERO_ADDRESS,
        followModuleData: [],
        followNFTURI: ""
    }
    await waitForTx(
        feed.createFeed(createFeedVars)
    )
    const FEED_ID = (await feed.getFeedCount()).sub(1)
    const FEED_PROFILE_ID = await feed.getFeedProfile(FEED_ID)

    console.log(`Feed id: ${FEED_ID}`)
    console.log(`Feed profileId: ${FEED_PROFILE_ID}`)




    // Add authors to the feed.
    console.log('Adding authors to feeds')
    await waitForTx(
        feed.setProfilePermissions(
            FEED_ID,
            PUBLISHER_PROFILE_ID,
            true
        )
    )



    // Create follows.
    console.log('Creating follows')
    await waitForTx(
        followGraph.follow(
            [PUBLISHER_PROFILE_ID],
            FOLLOWER_PROFILE_ID,
            [[]]
        )
    )
    await waitForTx(
        followGraph.follow(
            [FEED_PROFILE_ID],
            FOLLOWER_PROFILE_ID,
            [[]]
        )
    )


    // Create a post within #announcements.
    // 
    
    console.log('Adding posts to feeds')
    
    console.log('Uploading post to IPFS')
    const upload = await uploadToIpfs("Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.")
    console.log(`Uploaded: ${upload.cid}`)

    const post1 = {
        feedId: FEED_ID,
        authorProfileId: PUBLISHER_PROFILE_ID,
        contentURI: `ipfs:${upload.cid}`,

        // TODO: Future design decisions about these variables.
        collectModule: addrs.getAddress('empty collect module'),
        collectModuleData: [],
        referenceModule: addrs.getAddress('follower only reference module'),
        referenceModuleData: [],
    }

    await waitForTx(
        feed.postToFeed(post1)
    )
    // await feed.postToFeed(post1)
    // await feed.postToFeed(post1)

});


async function mockEnvMainnet(hre: HardhatRuntimeEnvironment) {
    if (hre.network.name == "hardhat") {
        console.error("Error: the in-built Hardhat environment contains no Lens deployment. You probably want '--network localhost' instead.")
        return
    }

    const [governance, , user] = await initEnv(hre);
    const addrs = loadLensDeployment(hre.network.name);
    const ctx = loadDeploymentCtx({
        network: hre.network.name,
        project: 'anno',
        provider: hre.ethers.provider
    })

    let mockProfiles = MockProfileCreationProxy__factory.connect('0x08C4fdC3BfF03ce4E284FBFE61ba820c23722540', governance);
    let lensHub = LensHub__factory.connect(ctx.getAddress('LensHubProxy'), governance);
    const feed = Feed__factory.connect(ctx.getAddress('FeedProxy'), user);
    const followGraph = FollowGraph__factory.connect(ctx.getAddress('FollowGraph'), user)

    lensHub = lensHub.connect(user)

    // Setup profiles.
    console.log('Setting up profiles')
    const profilePublisher: CreateProfileDataStruct = {
        to: user.address,
        handle: "publisher." + (Date.now().toString().slice(-8)),
        imageURI:
            'https://ipfs.fleek.co/ipfs/ghostplantghostplantghostplantghostplantghostplantghostplan',
        followModule: ZERO_ADDRESS,
        followModuleData: [],
        followNFTURI:
            'https://ipfs.fleek.co/ipfs/ghostplantghostplantghostplantghostplantghostplantghostplan',
    };

    const profileFollower: CreateProfileDataStruct = {
        to: user.address,
        handle: "follower." + (Date.now().toString().slice(-8)),
        imageURI:
            'https://ipfs.fleek.co/ipfs/ghostplantghostplantghostplantghostplantghostplantghostplan',
        followModule: ZERO_ADDRESS,
        followModuleData: [],
        followNFTURI:
            'https://ipfs.fleek.co/ipfs/ghostplantghostplantghostplantghostplantghostplantghostplan',
    };

    try {
        await waitForTx(
            mockProfiles.proxyCreateProfile(profilePublisher)
        );
        await waitForTx(
            mockProfiles.proxyCreateProfile(profileFollower)
        );
    } catch (ex) {
        console.error(ex)
    }

    const PUBLISHER_PROFILE_ID = await lensHub.getProfileIdByHandle(profilePublisher.handle)
    const FOLLOWER_PROFILE_ID = await lensHub.getProfileIdByHandle(profileFollower.handle)
    console.log(
        `@publisher profileId ${PUBLISHER_PROFILE_ID}`
    )
    console.log(
        `@follower profileId ${FOLLOWER_PROFILE_ID}`
    )



    // Create the "#announcements" feed.
    // 
    console.log('Creating feeds')
    const createFeedVars: CreateFeedDataStruct = {
        name: "announcements",
        profileHandle: "announcements." + (Date.now().toString().slice(-8)),
        owner: user.address,
        imageURI: "",
        followModule: ZERO_ADDRESS,
        followModuleData: [],
        followNFTURI: ""
    }
    await waitForTx(
        feed.createFeed(createFeedVars)
    )
    const FEED_ID = (await feed.getFeedCount()).sub(1)
    const FEED_PROFILE_ID = await feed.getFeedProfile(FEED_ID)

    console.log(`Feed id: ${FEED_ID}`)
    console.log(`Feed profileId: ${FEED_PROFILE_ID}`)




    // Add authors to the feed.
    console.log('Adding authors to feeds')
    await waitForTx(
        feed.setProfilePermissions(
            FEED_ID,
            PUBLISHER_PROFILE_ID,
            true
        )
    )



    // Create follows.
    console.log('Creating follows')
    await waitForTx(
        followGraph.follow(
            [PUBLISHER_PROFILE_ID],
            FOLLOWER_PROFILE_ID,
            [[]]
        )
    )
    await waitForTx(
        followGraph.follow(
            [FEED_PROFILE_ID],
            FOLLOWER_PROFILE_ID,
            [[]]
        )
    )


    // Create a post within #announcements.
    // 

    console.log('Adding posts to feeds')

    console.log('Uploading post to IPFS')
    const upload = await uploadToIpfs("Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.")
    console.log(`Uploaded: ${upload.cid}`)

    const post1 = {
        feedId: FEED_ID,
        authorProfileId: PUBLISHER_PROFILE_ID,
        contentURI: `ipfs:${upload.cid}`,

        // TODO: Future design decisions about these variables.
        collectModule: addrs.getAddress('empty collect module'),
        collectModuleData: [],
        referenceModule: addrs.getAddress('follower only reference module'),
        referenceModuleData: [],
    }

    await waitForTx(
        feed.postToFeed(post1)
    )
    // await feed.postToFeed(post1)
    // await feed.postToFeed(post1)
}