/**
 * smart-contracts/deploy.js
 * Hardhat deployment script for CredentialSeal
 * Run: npx hardhat run deploy.js --network localhost
 */

const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`\n🔑 Deploying with: ${deployer.address}`);
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH\n`);

  /* Deploy CredentialSeal */
  const CredentialSeal = await ethers.getContractFactory('CredentialSeal');
  const contract = await CredentialSeal.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`✅ CredentialSeal deployed to: ${address}`);
  console.log(`📋 Transaction hash: ${contract.deploymentTransaction()?.hash}\n`);

  /* Verify deployment */
  const owner = await contract.owner();
  const totalSealed = await contract.getTotalSealed();
  console.log(`👤 Owner   : ${owner}`);
  console.log(`🔒 Sealed  : ${totalSealed}`);

  /* Write deployment info to file */
  const deploymentInfo = {
    network: process.env.HARDHAT_NETWORK || 'localhost',
    contractAddress: address,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    txHash: contract.deploymentTransaction()?.hash,
  };

  // Adjust path to output deployment info
  const outDir = path.join(__dirname, '..', '..', 'backend', 'src', 'config');
  const outPath = path.join(outDir, 'deployment.json');

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(outPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\n📄 Deployment info saved to: ${outPath}`);
  console.log(`\n⚙️  Update .env:\nCONTRACT_ADDRESS=${address}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Deployment failed:', err);
    process.exit(1);
  });