import { ethers, run } from "hardhat";

const WAIT_BLOCK_CONFIRMATIONS = 3;
const INDELIBLE_WALLET = "0x29FbB84b835F892EBa2D331Af9278b74C595EDf1";

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("Deploying contracts with the account:", deployer.address);

  console.log("Account balance:", (await deployer.getBalance()).toString());

  // DEPLOY SECURITY CONTRACT

  const IndelibleSecurity = await ethers.getContractFactory(
    "IndelibleSecurity"
  );
  const indelibleSecurity = await IndelibleSecurity.deploy();

  console.log("IndelibleSecurity address:", indelibleSecurity.address);

  await indelibleSecurity.deployTransaction.wait(WAIT_BLOCK_CONFIRMATIONS);

  await indelibleSecurity.updateSignerAddress(
    "0xF07e93D235A949Fd8d48830c0bB534F90c806C63"
  );
  await indelibleSecurity.grantRole(
    "0x0000000000000000000000000000000000000000000000000000000000000000",
    INDELIBLE_WALLET
  );

  // DEPLOY GENERATIVE IMPLEMENTATION

  const IndelibleGenerative = await ethers.getContractFactory(
    "IndelibleGenerative"
  );
  const indelibleGenerative = await IndelibleGenerative.deploy();

  console.log("IndelibleGenerative address:", indelibleGenerative.address);

  await indelibleGenerative.deployTransaction.wait(WAIT_BLOCK_CONFIRMATIONS);

  // DEPLOY DROP 721 IMPLEMENTATION

  const IndelibleDrop721 = await ethers.getContractFactory("IndelibleDrop721");
  const indelibleDrop721 = await IndelibleDrop721.deploy();

  console.log("IndelibleDrop721 address:", indelibleDrop721.address);

  await indelibleDrop721.deployTransaction.wait(WAIT_BLOCK_CONFIRMATIONS);

  // DEPLOY FACTORY

  const IndelibleFactory = await ethers.getContractFactory("IndelibleFactory");
  const indelibleFactory = await IndelibleFactory.deploy();

  console.log("Contract address:", indelibleFactory.address);

  await indelibleFactory.deployTransaction.wait(WAIT_BLOCK_CONFIRMATIONS);

  await indelibleFactory.grantRole(
    "0x0000000000000000000000000000000000000000000000000000000000000000",
    INDELIBLE_WALLET
  );

  await (
    await indelibleFactory.updateGenerativeImplementation(
      indelibleGenerative.address
    )
  ).wait();

  await (
    await indelibleFactory.updateDrop721Implementation(indelibleDrop721.address)
  ).wait();

  await (
    await indelibleFactory.updateIndelibleSecurity(indelibleSecurity.address)
  ).wait();

  await (
    await indelibleFactory.updateCollectorFeeRecipient(INDELIBLE_WALLET)
  ).wait();

  await (
    await indelibleFactory.updateCollectorFee(
      ethers.utils.parseEther(
        [137, 80001].includes(network.chainId) ? "1" : "0.000777"
      )
    )
  ).wait();

  console.log(`Verifying contract on Etherscan...`);
  try {
    await run(`verify:verify`, {
      address: indelibleSecurity.address,
      constructorArguments: [],
    });
  } catch (e) {
    console.log(e);
  }
  try {
    await run(`verify:verify`, {
      address: indelibleGenerative.address,
      constructorArguments: [],
    });
  } catch (e) {
    console.log(e);
  }
  try {
    await run(`verify:verify`, {
      address: indelibleDrop721.address,
      constructorArguments: [],
    });
  } catch (e) {
    console.log(e);
  }
  try {
    await run(`verify:verify`, {
      address: indelibleFactory.address,
      constructorArguments: [],
    });
  } catch (e) {
    console.log(e);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
