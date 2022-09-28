import fs from "fs-extra";
import * as generative from "../templates/generative";
import * as oneofone from "../templates/oneofone";

export const TEST_ADDRESS_1 = `0x10ec407c925a95fc2bf145bc671a733d1fba347e`;
export const TEST_ADDRESS_2 = `0x2052051A0474fB0B98283b3F38C13b0B0B6a3677`;
const buildGenerativeContracts = async () => {
  const contractAllowList = generative.generateContract({
    name: "Example & Fren ” 😃", // test special characters and unicode
    tokenSymbol: "EXPL😃",
    mintPrice: "0.005",
    description: 'Example\'s ("Description")',
    maxSupply: 2000,
    layers: [
      { name: "example1😃", tiers: [2, 5, 10, 30, 40, 50, 1863] },
      {
        name: "example2😃",
        tiers: [40, 80, 100, 120, 160, 200, 250, 300, 350, 400],
      },
      {
        name: "example3😃",
        tiers: [
          10, 15, 20, 35, 50, 60, 65, 70, 75, 80, 90, 95, 150, 170, 180, 190,
          200, 215, 230,
        ],
      },
      {
        name: "example4😃",
        tiers: [
          10, 15, 20, 35, 50, 60, 70, 75, 80, 110, 115, 160, 220, 230, 240, 250,
          260,
        ],
      },
      { name: "example5😃", tiers: [200, 250, 280, 290, 300, 330, 350] },
      { name: "example6😃", tiers: [200, 300, 400, 500, 600] },
      {
        name: "example7😃",
        tiers: [
          40, 45, 55, 65, 80, 85, 95, 100, 110, 115, 120, 150, 220, 230, 240,
          250,
        ],
      },
      { name: "example8😃", tiers: [50, 750, 1200] },
      {
        name: "example9😃",
        tiers: [10, 80, 100, 180, 200, 210, 220, 230, 240, 260, 270],
      },
    ],
    maxPerAddress: 100,
    network: "rinkeby",
    royalties: 0,
    royaltiesRecipient: "",
    image: "",
    banner: "",
    website: "https://indeliblelabs.io",
    withdrawRecipients: [
      { name: "test1", imageUrl: "", percentage: 40, address: TEST_ADDRESS_1 },
      { name: "test2", imageUrl: "", percentage: 20, address: TEST_ADDRESS_2 },
    ],
    allowList: {
      maxPerAllowList: 1,
      price: "0",
    },
    contractName: "IndelibleAllowList",
  });
  await fs.writeFile(
    "./src/contracts/IndelibleAllowList.sol",
    contractAllowList
  );
  const contract = generative.generateContract({
    name: "Example & Fren ” 😃", // test special characters and unicode
    tokenSymbol: "EXPL😃",
    mintPrice: "0.005",
    description: 'Example\'s ("Description")',
    maxSupply: 2000,
    layers: [
      { name: "example1😃", tiers: [2, 5, 10, 30, 40, 50, 1863] },
      {
        name: "example2😃",
        tiers: [40, 80, 100, 120, 160, 200, 250, 300, 350, 400],
      },
      {
        name: "example3😃",
        tiers: [
          10, 15, 20, 35, 50, 60, 65, 70, 75, 80, 90, 95, 150, 170, 180, 190,
          200, 215, 230,
        ],
      },
      {
        name: "example4😃",
        tiers: [
          10, 15, 20, 35, 50, 60, 70, 75, 80, 110, 115, 160, 220, 230, 240, 250,
          260,
        ],
      },
      { name: "example5😃", tiers: [200, 250, 280, 290, 300, 330, 350] },
      { name: "example6😃", tiers: [200, 300, 400, 500, 600] },
      {
        name: "example7😃",
        tiers: [
          40, 45, 55, 65, 80, 85, 95, 100, 110, 115, 120, 150, 220, 230, 240,
          250,
        ],
      },
      { name: "example8😃", tiers: [50, 750, 1200] },
      {
        name: "example9😃",
        tiers: [10, 80, 100, 180, 200, 210, 220, 230, 240, 260, 270],
      },
    ],
    maxPerAddress: 100,
    network: "rinkeby",
    royalties: 0,
    royaltiesRecipient: "",
    withdrawRecipients: [
      { name: "test1", imageUrl: "", percentage: 40, address: TEST_ADDRESS_1 },
      { name: "test2", imageUrl: "", percentage: 20, address: TEST_ADDRESS_2 },
    ],
    image: "",
    banner: "",
    website: "https://indeliblelabs.io",
    contractName: "IndelibleNoAllowList",
  });
  await fs.writeFile("./src/contracts/IndelibleNoAllowList.sol", contract);
};

buildGenerativeContracts();

const buildOneOfOneContracts = async () => {
  const contract = oneofone.generateContract({
    name: "Example & Fren ” 😃", // test special characters and unicode
    tokenSymbol: "EXPL😃",
    mintPrice: "0.005",
    description: 'Example\'s ("Description")',
    maxSupply: 100,
    maxPerAddress: 100,
    network: "rinkeby",
    royalties: 0,
    royaltiesRecipient: "",
    image: "",
    banner: "",
    website: "https://indeliblelabs.io",
    contractName: "IndelibleOneOfOne",
  });
  await fs.writeFile("./src/contracts/IndelibleOneOfOne.sol", contract);
};

buildOneOfOneContracts();
