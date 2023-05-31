import { ethers, run } from "hardhat";

const WAIT_BLOCK_CONFIRMATIONS = 3;

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  console.log("Account balance:", (await deployer.getBalance()).toString());

  const IndelibleGenerative = await ethers.getContractFactory(
    "IndelibleGenerative"
  );
  const indelibleGenerative = await IndelibleGenerative.deploy();

  console.log("Contract address:", indelibleGenerative.address);

  await indelibleGenerative.deployTransaction.wait(WAIT_BLOCK_CONFIRMATIONS);

  const IndelibleFactory = await ethers.getContractFactory("IndelibleFactory");
  const indelibleFactory = await IndelibleFactory.deploy();

  console.log("Contract address:", indelibleFactory.address);

  await indelibleFactory.deployTransaction.wait(WAIT_BLOCK_CONFIRMATIONS);

  await (
    await indelibleFactory.updateGenerativeImplementation(
      indelibleGenerative.address
    )
  ).wait();

  await (
    await indelibleFactory.updateProContractAddress(
      "0xf3DAEb3772B00dFB3BBb1Ad4fB3494ea6b9Be4fE"
    )
  ).wait();

  await (
    await indelibleFactory.updateCollectorFeeRecipient(
      "0x29FbB84b835F892EBa2D331Af9278b74C595EDf1"
    )
  ).wait();

  await (
    await indelibleFactory.updateCollectorFee(
      ethers.utils.parseEther("0.000777")
    )
  ).wait();

  console.log(`Verifying contract on Etherscan...`);
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
