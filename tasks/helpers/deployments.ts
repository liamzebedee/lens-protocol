import '@nomiclabs/hardhat-ethers';
import { ethers } from 'ethers';
import fs from 'fs';
import { join } from 'path';

export interface Deployments {
    contracts: {
        [k: string]: ContractDeployment | undefined
    }
}

export interface ContractDeployment {
    address: string
    txHash?: string
    abi: any[]
    deployTransaction: ContractDeployTransaction
}

export interface ContractDeployTransaction {
    blockHash: string
    blockNumber: number
    transactionHash: string
}

export interface DeploymentContext {
    deploymentsDir: string
    deploymentFilePath: string
    deployments: Deployments
    provider: ethers.providers.Provider
}

export function loadDeploymentCtx({ network, project, provider }: { network: string, project: string, provider: ethers.providers.Provider }): DeploymentContext {
    const deploymentFolderPath = join(__dirname, `../../../deployments/${network}/`)
    if (!fs.existsSync(deploymentFolderPath)) fs.mkdirSync(deploymentFolderPath)

    const deploymentFilePath = join(deploymentFolderPath, `/${project}.json`)
    let deployments = {
        contracts: {}
    }
    if (fs.existsSync(deploymentFilePath)) {
        deployments = require(deploymentFilePath)
    }

    return {
        deploymentsDir: deploymentFolderPath,
        deploymentFilePath: deploymentFilePath,
        deployments,
        provider
    }
}

export async function transformEthersInstance(ctx: DeploymentContext, args: { name: string, instance: ethers.Contract, address: string, abi: object[] }): Promise<ContractDeployment> {
    const { instance, address, abi, name } = args

    if (!instance.deployTransaction) {
        console.error(`No instance.deployTransaction for `, name)
    }

    let deployTransaction = {
        blockHash: instance.deployTransaction.blockHash,
        blockNumber: instance.deployTransaction.blockNumber,
        transactionHash: instance.deployTransaction.hash
    }

    // FIX: The deployTransaction field had a null blockNumber when I deployed to Polygon.
    // Usually it is filled in Harhdat. Cause unknown.
    if (!deployTransaction.blockNumber || !deployTransaction.blockHash) {
        const txHash = instance.deployTransaction.hash

        console.log(`Missing deployment info for contract ${name}. Fetching from tx ${txHash}...`)
        const receipt = await ctx.provider.getTransactionReceipt(txHash)
        deployTransaction = {
            blockHash: receipt.blockHash,
            blockNumber: receipt.blockNumber,
            transactionHash: receipt.transactionHash
        }
    }

    return {
        address,
        deployTransaction: <ContractDeployTransaction> deployTransaction,
        abi,
    };
}


export async function transformVendoredInstance(ctx: DeploymentContext, args: { name: string, address: string, txHash: string, abi: object[] }): Promise<ContractDeployment> {
    const { address, abi, txHash, name } = args

    const deployment = ctx.deployments.contracts[name]
    let deployTransaction = deployment?.deployTransaction

    if (!(deployment || deployTransaction) && txHash) {
        console.log(`Missing deployment info for contract ${name}. Fetching from tx ${txHash}...`)
        const receipt = await ctx.provider.getTransactionReceipt(txHash)
        deployTransaction = {
            blockHash: receipt.blockHash,
            blockNumber: receipt.blockNumber,
            transactionHash: receipt.transactionHash
        }
    }

    return {
        address,
        deployTransaction: <ContractDeployTransaction>deployTransaction,
        abi,
    };
}