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
import { deployContract, waitForTx } from './helpers/utils';

task('sync-deployments', 'syncs vendored deployments with our custom format').setAction(async ({ }, hre) => {
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

    const vendoredContracts = {
        'LensHub': {
            address: lensAddresses['lensHub impl'].address,
            txHash: lensAddresses['lensHub impl'].txHash,
            abi: LensHub__factory.abi
                .concat(PublishingLogic__factory.abi)
                .concat(InteractionLogic__factory.abi)
                .concat(Events__factory.abi)
        },
        'LensHubProxy': {
            address: lensAddresses['lensHub proxy'].address,
            txHash: lensAddresses['lensHub proxy'].txHash,
            abi: LensHub__factory.abi
                .concat(PublishingLogic__factory.abi)
                .concat(InteractionLogic__factory.abi)
                .concat(Events__factory.abi)
        },
        // TODO: re-enable later.
        // 'FollowNFT': {
        //     address: lensAddresses['follow NFT impl'].address,
        //     txHash: lensAddresses['follow NFT impl'].txHash,
        //     abi: FollowNFT__factory.abi,
        // },
    }

    // Update deployments.
    await Promise.all(
        Object.entries(vendoredContracts).map(async ([name, contract]) => {
            ctx.deployments["contracts"][name] = await transformVendoredInstance(ctx, { name, ...contract, force: true })
        })
    )

    // Save contract addresses.
    console.debug(`Saving deployment info to ${ctx.deploymentsDir}`)
    fs.writeFileSync(ctx.deploymentFilePath, JSON.stringify(ctx.deployments, null, 4));
});

