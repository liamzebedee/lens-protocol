import '@nomiclabs/hardhat-ethers';
import { hexlify, keccak256, RLP } from 'ethers/lib/utils';
import fs from 'fs';
import { task } from 'hardhat/config';
import { join } from 'path';
import {
    LensHub__factory,
    ApprovalFollowModule__factory,
    CollectNFT__factory,
    Currency__factory,
    EmptyCollectModule__factory,
    FeeCollectModule__factory,
    FeeFollowModule__factory,
    FollowerOnlyReferenceModule__factory,
    FollowNFT__factory,
    InteractionLogic__factory,
    LimitedFeeCollectModule__factory,
    LimitedTimedFeeCollectModule__factory,
    ModuleGlobals__factory,
    PublishingLogic__factory,
    RevertCollectModule__factory,
    TimedFeeCollectModule__factory,
    TransparentUpgradeableProxy__factory,
    Feed__factory,
    Events__factory,
    FollowGraph__factory,
} from '../typechain-types';
import { Events } from '../typechain-types';
import { deployContract, waitForTx, ZERO_ADDRESS } from './helpers/utils';

const TREASURY_FEE_BPS = 50;
const LENS_HUB_NFT_NAME = 'Various Vegetables';
const LENS_HUB_NFT_SYMBOL = 'VVGT';

task('upgrade-feed', 'upgrades the Feed contract').setAction(async ({ }, hre) => {
    // Note that the use of these signers is a placeholder and is not meant to be used in
    // production.
    const ethers = hre.ethers;
    const accounts = await ethers.getSigners();
    const deployer = accounts[0];
    const governance = accounts[1];
    const treasuryAddress = accounts[2].address;

    const existingAddrs = require('../addresses.json');

    // Nonce management in case of deployment issues
    let deployerNonce = await ethers.provider.getTransactionCount(deployer.address);

    console.log('\n\t -- Deploying Module Globals --');
    
    // Feed
    console.log('\n\t-- Deploying Feed --');
    const MockProfileCreationProxy_address = '0x08C4fdC3BfF03ce4E284FBFE61ba820c23722540'
    const feedImpl = await deployContract(
        new Feed__factory(deployer).deploy({ nonce: deployerNonce++ })
    );
    const feedProxy = TransparentUpgradeableProxy__factory.connect(existingAddrs['feed proxy'], accounts[3])

    // Upgrade feed.
    await waitForTx(
        feedProxy.upgradeTo(feedImpl.address)
    )
    console.log(await feedProxy.callStatic.implementation())
    console.log(`Upgraded Feed proxy to implementation at ${feedImpl.address}`)
    const feed = Feed__factory.connect(feedProxy.address, governance);
    await waitForTx(
        feed.initialize(existingAddrs['lensHub proxy'], ZERO_ADDRESS)
    )

    // Follow Graph.
    console.log('\n\t-- Deploying FollowGraph --');
    const followGraph = await deployContract(
        new FollowGraph__factory(deployer).deploy(existingAddrs['lensHub proxy'], { nonce: deployerNonce++ })
    );

    // Save and log the addresses
    const addrs = Object.assign(existingAddrs, {
        'feed': feed.address,
        'feed impl': feedImpl.address,
        'follow graph': followGraph.address,
    });
    const json = JSON.stringify(addrs, null, 2);
    console.log(json);

    fs.writeFileSync('addresses.json', json, 'utf-8');




    // Now save to deployments.json.

    type ABIItem = any
    type DeploymentItem = {
        address: string,
        deployTransaction: {
            blockNumber: number
        },
        abi: ABIItem[]
    }


    const deploymentFolderPath = join(__dirname, `../../deployments/${hre.network.name}/`)
    if (!fs.existsSync(deploymentFolderPath)) fs.mkdirSync(deploymentFolderPath)

    const deploymentFilePath = join(deploymentFolderPath, '/anno.json')
    let deployments = {
        contracts: {}
    }
    if (fs.existsSync(deploymentFilePath)) {
        deployments = require(deploymentFilePath)
    } else {
        throw new Error("Expecting existing deployments. This is an upgrade, full-deploy should be run first.")
    }
    console.debug(`Saving deployment info to ${deploymentFolderPath}`)

    const deployedContracts = {
        'Feed': {
            instance: feed,
            address: feedImpl.address,
            abi: Feed__factory.abi
            ,
            bytecode: Feed__factory.bytecode
        },
        'FeedProxy': {
            instance: feedProxy,
            address: feedProxy.address,
            abi: Feed__factory.abi
            ,
            bytecode: Feed__factory.bytecode
        }
    }

    // Update deployments.
    Object.entries(deployedContracts).forEach(([name, contract]) => {
        const { instance, address, abi, bytecode } = contract
        deployments["contracts"][name] = {
            address: address,
            deployTransaction: instance?.deployTransaction,
            abi,
            bytecode
        };
    });

    // Now add contracts with only addresses.
    fs.writeFileSync(join(deploymentFolderPath, '/lens-addresses.json'), json, 'utf-8');

    // Save contract addresses.
    fs.writeFileSync(deploymentFilePath, JSON.stringify(deployments, null, 4));
});
