// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CredentialSeal
 * @author Surgical Exam System
 * @notice Stores and verifies SHA256 hashes of exam results on-chain.
 *         Only the deployer (owner) can seal and revoke results.
 * @dev    Uses bytes32 for gas-efficient hash storage.
 */
contract CredentialSeal {

    /* ─── State ─────────────────────────────────────────────────── */
    address public owner;
    uint256 private totalSealed;

    struct ResultRecord {
        bool    exists;
        string  resultId;       // MongoDB ObjectId string
        uint256 timestamp;
        address sealer;
        bool    revoked;
    }

    mapping(bytes32 => ResultRecord) private records;

    /* ─── Events ─────────────────────────────────────────────────── */
    event ResultSealed(
        bytes32 indexed resultHash,
        string  indexed resultId,
        uint256         timestamp,
        address         sealer
    );

    event ResultRevoked(
        bytes32 indexed resultHash,
        bool            revoked
    );

    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );

    /* ─── Errors ─────────────────────────────────────────────────── */
    error Unauthorized();
    error AlreadySealed(bytes32 resultHash);
    error NotFound(bytes32 resultHash);
    error ZeroHash();
    error EmptyResultId();

    /* ─── Modifiers ──────────────────────────────────────────────── */
    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier validHash(bytes32 hash) {
        if (hash == bytes32(0)) revert ZeroHash();
        _;
    }

    /* ─── Constructor ────────────────────────────────────────────── */
    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    /* ─── Write Functions ────────────────────────────────────────── */

    /**
     * @notice Seal an exam result hash on-chain.
     * @param resultHash SHA256 hash of result data (32 bytes)
     * @param resultId   MongoDB ObjectId string for reference
     */
    function sealResult(bytes32 resultHash, string calldata resultId)
        external
        onlyOwner
        validHash(resultHash)
    {
        if (bytes(resultId).length == 0)  revert EmptyResultId();
        if (records[resultHash].exists)   revert AlreadySealed(resultHash);

        records[resultHash] = ResultRecord({
            exists    : true,
            resultId  : resultId,
            timestamp : block.timestamp,
            sealer    : msg.sender,
            revoked   : false
        });

        totalSealed++;

        emit ResultSealed(resultHash, resultId, block.timestamp, msg.sender);
    }

    /**
     * @notice Batch seal multiple results in one transaction.
     * @param hashes    Array of SHA256 hashes
     * @param resultIds Array of corresponding MongoDB IDs
     */
    function batchSealResults(
        bytes32[] calldata hashes,
        string[]  calldata resultIds
    ) external onlyOwner {
        require(hashes.length == resultIds.length, "Length mismatch");
        require(hashes.length <= 50, "Max 50 per batch");

        for (uint256 i = 0; i < hashes.length; i++) {
            if (hashes[i] == bytes32(0))          continue;
            if (records[hashes[i]].exists)         continue;
            if (bytes(resultIds[i]).length == 0)   continue;

            records[hashes[i]] = ResultRecord({
                exists    : true,
                resultId  : resultIds[i],
                timestamp : block.timestamp,
                sealer    : msg.sender,
                revoked   : false
            });
            totalSealed++;
            emit ResultSealed(hashes[i], resultIds[i], block.timestamp, msg.sender);
        }
    }

    /**
     * @notice Revoke a previously sealed result (e.g. academic misconduct).
     * @param resultHash Hash to revoke
     */
    function revokeResult(bytes32 resultHash)
        external
        onlyOwner
        validHash(resultHash)
    {
        if (!records[resultHash].exists) revert NotFound(resultHash);
        records[resultHash].revoked = true;
        emit ResultRevoked(resultHash, true);
    }

    /**
     * @notice Reinstate a previously revoked result.
     * @param resultHash Hash to reinstate
     */
    function reinstateResult(bytes32 resultHash)
        external
        onlyOwner
        validHash(resultHash)
    {
        if (!records[resultHash].exists) revert NotFound(resultHash);
        records[resultHash].revoked = false;
        emit ResultRevoked(resultHash, false);
    }

    /* ─── Read Functions ─────────────────────────────────────────── */

    /**
     * @notice Verify a result hash.
     * @param resultHash Hash to verify
     * @return exists    Whether the hash was ever sealed
     * @return resultId  MongoDB ID reference
     * @return timestamp Block timestamp when sealed
     * @return sealer    Address that sealed the record
     * @return revoked   Whether the record has been revoked
     */
    function verifyResult(bytes32 resultHash)
        external
        view
        validHash(resultHash)
        returns (
            bool    exists,
            string  memory resultId,
            uint256 timestamp,
            address sealer,
            bool    revoked
        )
    {
        ResultRecord storage rec = records[resultHash];
        return (rec.exists, rec.resultId, rec.timestamp, rec.sealer, rec.revoked);
    }

    /**
     * @notice Quick check — returns true only if sealed and NOT revoked.
     * @param resultHash Hash to check
     */
    function isValid(bytes32 resultHash) external view returns (bool) {
        ResultRecord storage rec = records[resultHash];
        return rec.exists && !rec.revoked;
    }

    /**
     * @notice Get total number of sealed records.
     */
    function getTotalSealed() external view returns (uint256) {
        return totalSealed;
    }

    /**
     * @notice Transfer contract ownership.
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /**
     * @notice Prevent accidental ETH deposits.
     */
    receive() external payable {
        revert("ETH not accepted");
    }
}
