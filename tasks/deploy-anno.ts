import '@nomiclabs/hardhat-ethers';
import { ethers } from 'ethers';
import fs from 'fs';
import { task } from 'hardhat/config';
import { join } from 'path';
import {
    Events__factory, Feed__factory, FollowGraph__factory, FollowNFT__factory,
    InteractionLogic__factory, LensHub__factory, PublishingLogic__factory,
    TransparentUpgradeableProxy__factory
} from '../typechain-types';
import { loadDeploymentCtx, transformEthersInstance, transformVendoredInstance } from './helpers/deployments';
import { deployContract, waitForTx, ZERO_ADDRESS } from './helpers/utils';

task('deploy-anno', 'deploys the Anno Protocol contracts').setAction(async ({ }, hre) => {
    // Note that the use of these signers is a placeholder and is not meant to be used in
    // production.
    const ethers = hre.ethers;
    const accounts = await ethers.getSigners();
    const deployer = accounts[0];
    const governance = accounts[1];
    const treasuryAddress = accounts[2].address;

    // Deployments info.
    const ctx = loadDeploymentCtx({
        network: hre.network.name,
        project: 'anno',
        provider: hre.ethers.provider
    })
    const lensAddresses = require(join(ctx.deploymentsDir, '/lens-addresses.json'));


    // Nonce management in case of deployment issues
    let deployerNonce = await ethers.provider.getTransactionCount(deployer.address);

    // Feed.
    console.log('\n\t-- Deploying Feed --');
    const feedImpl = await deployContract(
        new Feed__factory(deployer).deploy({ nonce: deployerNonce++ })
    );

    // Feed proxy.
    const feedProxy = await deployContract(
        new TransparentUpgradeableProxy__factory(deployer).deploy(
            feedImpl.address,
            accounts[3].address,
            [],
            { nonce: deployerNonce++ }
        )
    );

    // Initialize Feed.
    const feed = Feed__factory.connect(feedProxy.address, governance);
    
    let MockProfileCreationProxy_address = ZERO_ADDRESS
    if (hre.network.name == 'mumbai') {
        MockProfileCreationProxy_address = '0x08C4fdC3BfF03ce4E284FBFE61ba820c23722540'
    }
    
    await waitForTx(
        feed.initialize(lensAddresses['lensHub proxy'].address, MockProfileCreationProxy_address)
    )

    // Follow Graph.
    console.log('\n\t-- Deploying FollowGraph --');
    const followGraph = await deployContract(
        new FollowGraph__factory(deployer).deploy(lensAddresses['lensHub proxy'].address, { nonce: deployerNonce++ })
    );


    const deployedContracts = {
        'FollowGraph': {
            instance: followGraph,
            address: followGraph.address,
            abi: FollowGraph__factory.abi
        },
        'Feed': {
            instance: feedImpl,
            address: feedImpl.address,
            abi: Feed__factory.abi
        },
        'FeedProxy': {
            instance: feedProxy,
            address: feedProxy.address,
            abi: Feed__factory.abi
        }
    }

    // Update deployments.
    await Promise.all(
        Object.entries(deployedContracts).map(async ([name, contract]) => {
            ctx.deployments["contracts"][name] = await transformEthersInstance(ctx, { name, ...contract })
        })
    )

    // Save contract addresses.
    console.debug(`Saving deployment info to ${ctx.deploymentsDir}`)
    fs.writeFileSync(ctx.deploymentFilePath, JSON.stringify(ctx.deployments, null, 4));
});

