import fs from "fs-extra";
import * as erc721a from "../templates/IndelibleERC721A";

const buildContracts = async () => {
  const contractAllowList = erc721a.generateContract({
    name: "Example & Fren â ð", // test special characters and unicode
    tokenSymbol: "EXPLð",
    mintPrice: "0.005",
    description: 'Example\'s ("Description")',
    maxSupply: 100,
    layers: [
      { name: "example1ð", tiers: [2, 5, 10, 30, 40, 50, 1863] },
      {
        name: "example2ð",
        tiers: [40, 80, 100, 120, 160, 200, 250, 300, 350, 400],
      },
      {
        name: "example3ð",
        tiers: [
          10, 15, 20, 35, 50, 60, 65, 70, 75, 80, 90, 95, 150, 170, 180, 190,
          200, 215, 230,
        ],
      },
      {
        name: "example4ð",
        tiers: [
          10, 15, 20, 35, 50, 60, 70, 75, 80, 110, 115, 160, 220, 230, 240, 250,
          260,
        ],
      },
      { name: "example5ð", tiers: [200, 250, 280, 290, 300, 330, 350] },
      { name: "example6ð", tiers: [200, 300, 400, 500, 600] },
      {
        name: "example7ð",
        tiers: [
          40, 45, 55, 65, 80, 85, 95, 100, 110, 115, 120, 150, 220, 230, 240,
          250,
        ],
      },
      { name: "example8ð", tiers: [50, 750, 1200] },
      {
        name: "example9ð",
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
    allowList: {
      maxPerAllowList: 1,
      price: "0",
    },
    contractName: "IndelibleERC721A",
  });
  await fs.writeFile(
    "./src/contracts/IndelibleERC721A-allowlist.sol",
    contractAllowList
  );
  const contract = erc721a.generateContract({
    name: "Example & Fren â ð", // test special characters and unicode
    tokenSymbol: "EXPLð",
    mintPrice: "0.005",
    description: 'Example\'s ("Description")',
    maxSupply: 100,
    layers: [
      { name: "example1ð", tiers: [2, 5, 10, 30, 40, 50, 1863] },
      {
        name: "example2ð",
        tiers: [40, 80, 100, 120, 160, 200, 250, 300, 350, 400],
      },
      {
        name: "example3ð",
        tiers: [
          10, 15, 20, 35, 50, 60, 65, 70, 75, 80, 90, 95, 150, 170, 180, 190,
          200, 215, 230,
        ],
      },
      {
        name: "example4ð",
        tiers: [
          10, 15, 20, 35, 50, 60, 70, 75, 80, 110, 115, 160, 220, 230, 240, 250,
          260,
        ],
      },
      { name: "example5ð", tiers: [200, 250, 280, 290, 300, 330, 350] },
      { name: "example6ð", tiers: [200, 300, 400, 500, 600] },
      {
        name: "example7ð",
        tiers: [
          40, 45, 55, 65, 80, 85, 95, 100, 110, 115, 120, 150, 220, 230, 240,
          250,
        ],
      },
      { name: "example8ð", tiers: [50, 750, 1200] },
      {
        name: "example9ð",
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
    contractName: "IndelibleNoAllowList",
  });
  await fs.writeFile(
    "./src/contracts/IndelibleERC721A-no-allowlist.sol",
    contract
  );
};

buildContracts();
