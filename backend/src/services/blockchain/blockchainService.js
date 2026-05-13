/**
 * src/services/blockchain/blockchainService.js
 * Interact with CredentialSeal smart contract via Ethers.js
 */

const { ethers } = require('ethers');
const logger = require('../../utils/logger');
const { hexToBytes32 } = require('./hashService');
const signatureService = require('./signatureService');
const merkleService = require('./merkleService');

/* ─── ABI (matches CredentialSeal.sol) ───────────────────────────── */
const CONTRACT_ABI = [
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "bytes32", "name": "resultHash", "type": "bytes32" },
      { "indexed": true, "internalType": "string", "name": "resultId", "type": "string" },
      { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" },
      { "indexed": false, "internalType": "address", "name": "sealer", "type": "address" }
    ],
    "name": "ResultSealed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "bytes32", "name": "resultHash", "type": "bytes32" },
      { "indexed": false, "internalType": "bool", "name": "revoked", "type": "bool" }
    ],
    "name": "ResultRevoked",
    "type": "event"
  },
  {
    "inputs": [
      { "internalType": "bytes32", "name": "resultHash", "type": "bytes32" },
      { "internalType": "string", "name": "resultId", "type": "string" }
    ],
    "name": "sealResult",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "bytes32", "name": "resultHash", "type": "bytes32" }],
    "name": "verifyResult",
    "outputs": [
      { "internalType": "bool", "name": "exists", "type": "bool" },
      { "internalType": "string", "name": "resultId", "type": "string" },
      { "internalType": "uint256", "name": "timestamp", "type": "uint256" },
      { "internalType": "address", "name": "sealer", "type": "address" },
      { "internalType": "bool", "name": "revoked", "type": "bool" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "bytes32", "name": "resultHash", "type": "bytes32" }],
    "name": "revokeResult",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getTotalSealed",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
];

/* ─── Provider & Signer ───────────────────────────────────────────── */
let provider;
let signer;
let contract;

const initBlockchain = () => {
  try {
    const networkUrl = process.env.BLOCKCHAIN_NETWORK || 'http://127.0.0.1:8545';
    const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
    const contractAddress = process.env.CONTRACT_ADDRESS;

    if (!privateKey || !contractAddress) {
      logger.warn('Blockchain: DEPLOYER_PRIVATE_KEY or CONTRACT_ADDRESS not set — blockchain disabled');
      return false;
    }

    provider = new ethers.JsonRpcProvider(networkUrl);
    signer = new ethers.Wallet(privateKey, provider);
    contract = new ethers.Contract(contractAddress, CONTRACT_ABI, signer);

    logger.info(`Blockchain initialized: network=${networkUrl} contract=${contractAddress}`);
    return true;
  } catch (err) {
    logger.error(`Blockchain init failed: ${err.message}`);
    return false;
  }
};

const getContract = () => {
  if (!contract) {
    const ok = initBlockchain();
    if (!ok) throw new Error('Blockchain service unavailable. Check config.');
  }
  return contract;
};

/* ─── STORE RESULT HASH ───────────────────────────────────────────── */
/**
 * Store a SHA256 result hash on the blockchain
 * @param {string} resultHash   - Hex SHA256 hash
 * @param {string} resultId     - MongoDB result _id as string
 * @returns {{ txHash, blockNumber, timestamp }}
 */
exports.storeResultHash = async (resultHash, resultId) => {
  try {
    const c = getContract();
    const hash32 = hexToBytes32(resultHash);

    logger.info(`Blockchain: sealing result ${resultId} hash=${resultHash}`);

    const tx = await c.sealResult(hash32, resultId, {
      gasLimit: 200000,
    });
    const receipt = await tx.wait();

    logger.info(`Blockchain: sealed tx=${tx.hash} block=${receipt.blockNumber}`);

    return {
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      timestamp: Math.floor(Date.now() / 1000),
      gasUsed: receipt.gasUsed?.toString(),
    };
  } catch (err) {
    logger.error(`storeResultHash error: ${err.message}`);
    throw err;
  }
};

/* ─── ANCHOR STATE ROOT ───────────────────────────────────────────── */
/**
 * Anchor the global state Merkle Root to the blockchain
 * @param {string} root - The Merkle Root hash
 * @returns {object} tx - Transaction details
 */
exports.anchorStateRoot = async (root) => {
  try {
    const c = getContract();
    const root32 = hexToBytes32(root);

    // We use a specific ID to identify the Global State Anchor
    const anchorId = `STATE_ROOT_PULSE:${Date.now()}`;

    // sign the root first for extra security
    const systemSig = await signatureService.signHash(root);

    logger.info(`Blockchain: anchoring state root pulse [${root}]`);

    const tx = await c.sealResult(root32, anchorId, { gasLimit: 250000 });
    const receipt = await tx.wait();

    return {
      success: true,
      root,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      signature: systemSig
    };
  } catch (err) {
    logger.error(`anchorStateRoot error: ${err.message}`);
    throw err;
  }
};

/* ─── SEAL GENERIC DATA ───────────────────────────────────────────── */
/**
 * Anchor any data type to the blockchain
 * @param {object|string} data - The data to hash and seal
 * @param {string} type - Reference type (e.g., 'violation', 'mcqbank')
 * @param {string} referenceId - Associated entity ID
 */
exports.sealGenericData = async (data, type, referenceId) => {
  try {
    const hashService = require('./hashService');
    const dataStr = typeof data === 'object' ? JSON.stringify(data) : String(data);
    const hash = hashService.computeHMAC(dataStr);

    logger.info(`Blockchain: sealing ${type} [${referenceId}]`);

    // We reuse sealResult as a generic anchor on the smart contract
    return await this.storeResultHash(hash, `${type}:${referenceId}`);
  } catch (err) {
    logger.error(`sealGenericData error [${type}]: ${err.message}`);
    throw err;
  }
};

/* ─── VERIFY RESULT HASH ──────────────────────────────────────────── */
/**
 * Verify a result hash against the blockchain
 * @param {string} resultHash
 * @returns {{ verified, resultId, timestamp, sealer, revoked }}
 */
exports.verifyResultOnBlockchain = async (resultHash) => {
  try {
    const c = getContract();
    const hash32 = hexToBytes32(resultHash);

    const [exists, resultId, timestamp, sealer, revoked] = await c.verifyResult(hash32);

    const verified = exists && !revoked;

    logger.info(`Blockchain verify: hash=${resultHash} exists=${exists} revoked=${revoked}`);

    return {
      verified,
      exists,
      resultId,
      timestamp: timestamp ? new Date(Number(timestamp) * 1000).toISOString() : null,
      sealer,
      revoked,
    };
  } catch (err) {
    logger.error(`verifyResultOnBlockchain error: ${err.message}`);
    throw err;
  }
};

/* ─── REVOKE RESULT ───────────────────────────────────────────────── */
exports.revokeResult = async (resultHash) => {
  try {
    const c = getContract();
    const hash32 = hexToBytes32(resultHash);
    const tx = await c.revokeResult(hash32, { gasLimit: 100000 });
    await tx.wait();
    logger.info(`Blockchain: revoked hash=${resultHash} tx=${tx.hash}`);
    return { success: true, txHash: tx.hash };
  } catch (err) {
    logger.error(`revokeResult error: ${err.message}`);
    throw err;
  }
};

/* ─── GET STATS ───────────────────────────────────────────────────── */
exports.getBlockchainStats = async () => {
  try {
    const c = getContract();
    const total = await c.getTotalSealed();
    const owner = await c.owner();
    const block = await provider.getBlockNumber();
    const net = await provider.getNetwork();
    return {
      totalSealed: total.toString(),
      owner,
      latestBlock: block,
      networkName: net.name,
      chainId: net.chainId.toString(),
    };
  } catch (err) {
    logger.error(`getBlockchainStats error: ${err.message}`);
    return { error: err.message };
  }
};

/* ─── HEALTH CHECK ────────────────────────────────────────────────── */
exports.blockchainHealthCheck = async () => {
  try {
    const p = provider || new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_NETWORK || 'http://127.0.0.1:8545');
    await p.getBlockNumber();
    return { healthy: true, network: process.env.BLOCKCHAIN_NETWORK };
  } catch (err) {
    return { healthy: false, error: err.message };
  }
};

/* Initialize on module load */
initBlockchain();