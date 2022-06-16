import fs from "fs-extra";
import * as erc721a from "../templates/IndelibleERC721A";

const buildContracts = async () => {
  const contract = erc721a.generateContract({
    name: "Example & Fren ” 😃", // test special characters and unicode
    tokenSymbol: "EXPL😃",
    mintPrice: "0",
    description: 'Example\'s ("Description")',
    maxTokens: 100,
    layers: [
      { name: "example1😃", tiers: [50, 50] },
      { name: "example2😃", tiers: [50, 50] },
      { name: "example3😃", tiers: [50, 50] },
      { name: "example4😃", tiers: [50, 50] },
      { name: "example5😃", tiers: [50, 50] },
      { name: "example6😃", tiers: [50, 50] },
      { name: "example7😃", tiers: [50, 50] },
      { name: "example8😃", tiers: [50, 50] },
      { name: "example9😃", tiers: [50, 50] },
      { name: "example10😃", tiers: [50, 50] },
      { name: "example11😃", tiers: [50, 50] },
      { name: "example12😃", tiers: [50, 50] },
      { name: "example13😃", tiers: [50, 50] },
      { name: "example14😃", tiers: [50, 50] },
      { name: "example15😃", tiers: [50, 50] },
    ],
    maxMintPerAddress: 100,
    network: "rinkeby",
  });
  await fs.writeFile("./src/contracts/IndelibleERC721A.sol", contract);
};

buildContracts();
