/**
 * src/services/blockchain/merkleService.js
 * Cryptographic Merkle Tree implementation for database auditing
 */

const crypto = require('crypto');

/**
 * Compute SHA256 of data with 0x prefix for blockchain compatibility
 */
const sha256 = (data) => {
    const hash = crypto.createHash('sha256').update(data).digest('hex');
    return `0x${hash}`;
};

/**
 * Generate a Merkle Tree from an array of leaf hashes
 * @param {string[]} leaves - Array of hex hashes (0x prefixed)
 * @returns {Object} Tree object with root and levels
 */
exports.createTree = (leaves) => {
    if (!leaves || leaves.length === 0) {
        return { root: `0x${'0'.repeat(64)}`, levels: [[]] };
    }

    // Sort leaves to ensure deterministic root
    let currentLevel = [...leaves].sort();
    const levels = [currentLevel];

    while (currentLevel.length > 1) {
        const nextLevel = [];
        for (let i = 0; i < currentLevel.length; i += 2) {
            const left = currentLevel[i];
            const right = currentLevel[i + 1] || left; // Duplicate last node if odd
            nextLevel.push(sha256(left + right));
        }
        currentLevel = nextLevel;
        levels.push(currentLevel);
    }

    return {
        root: levels[levels.length - 1][0],
        levels
    };
};

/**
 * Generate a Merkle Proof for a specific index
 */
exports.getProof = (tree, index) => {
    const proof = [];
    let currentIndex = index;

    for (let i = 0; i < tree.levels.length - 1; i++) {
        const level = tree.levels[i];
        const isRightNode = currentIndex % 2 !== 0;
        const pairIndex = isRightNode ? currentIndex - 1 : currentIndex + 1;

        if (pairIndex < level.length) {
            proof.push(level[pairIndex]);
        } else {
            proof.push(level[currentIndex]); // Duplicate node case
        }

        currentIndex = Math.floor(currentIndex / 2);
    }

    return proof;
};

/**
 * Verify a Merkle Proof
 */
exports.verifyProof = (leaf, proof, root) => {
    let hash = leaf;
    for (const p of proof) {
        // Determine order (smaller hash first for consistency)
        const combined = hash < p ? hash + p : p + hash;
        hash = sha256(combined);
    }
    return hash === root;
};
