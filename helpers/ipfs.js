

const IPFSHttp = require('ipfs-http-client')

const IPFS_NODE_URI = 'http://localhost:5001'

function normaliseCID(cid) {
    return cid.asCID.toV1().toString()
}

let _ipfs
async function getIpfs() {
    if (!_ipfs) {
        _ipfs = await IPFSHttp.create(IPFS_NODE_URI)
    }
    return _ipfs
}

async function uploadToIpfs(bufferOrString) {
    const ipfs = await getIpfs()
    const { cid } = await ipfs.add(bufferOrString)
    const ipfsUri = `ipfs:${normaliseCID(cid)}`
    return { ipfsUri, _cid: cid, cid: normaliseCID(cid) }
}

module.exports = {
    normaliseCID,
    uploadToIpfs
}