const ethers = require('ethers')

const HD_PATH_BASE = "m/44'/60'/0'/0"

let mnemonic = process.env.MNEMONIC
if (!mnemonic) {
    const wallet = ethers.Wallet.createRandom()
    mnemonic = wallet.mnemonic.phrase
}


console.log(`path: ${HD_PATH_BASE}`)
console.log(`mnemonic: ${mnemonic} ${process.env.MNEMONIC || '(generated from new wallet)'}`)
console.log()

const hdNode = ethers.utils.HDNode.fromMnemonic(mnemonic)
for(let i = 0; i < 10; i++) {
    const path = `${HD_PATH_BASE}/${i}`
    const node = hdNode.derivePath(path)
    console.log(`Account #${i}`)
    console.log(`  Address ${node.address}`)
    console.log(`  Key     ${node.privateKey}`)
}

console.log()
