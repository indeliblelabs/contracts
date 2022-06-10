import fs from "fs-extra";
import * as erc721a from "../templates/IndelibleERC721A";

const buildContracts = async () => {
  const contract = erc721a.generateContract({
    name: "Example & Fren ” 😃", // test special characters and unicode
    tokenSymbol: "EXPL😃",
    mintPrice: "0",
    description: 'Example\'s ("Description")',
    maxTokens: 2000,
    numberOfLayers: 9,
    layerNames: [
      "example1😃",
      "example2😃",
      "example3😃",
      "example4😃",
      "example5😃",
      "example6😃",
      "example7😃",
      "example8😃",
      "example9😃",
    ],
    maxMintPerAddress: 100,
    tiers: [
      [2, 5, 10, 30, 40, 50, 1863],
      [40, 80, 100, 120, 160, 200, 250, 300, 350, 400],
      [
        10, 15, 20, 35, 50, 60, 65, 70, 75, 80, 90, 95, 150, 170, 180, 190, 200,
        215, 230,
      ],
      [
        10, 15, 20, 35, 50, 60, 70, 75, 80, 110, 115, 160, 220, 230, 240, 250,
        260,
      ],
      [200, 250, 280, 290, 300, 330, 350],
      [200, 300, 400, 500, 600],
      [40, 45, 55, 65, 80, 85, 95, 100, 110, 115, 120, 150, 220, 230, 240, 250],
      [50, 750, 1200],
      [10, 80, 100, 180, 200, 210, 220, 230, 240, 260, 270],
    ],
  });
  await fs.writeFile("./src/contracts/IndelibleERC721A.sol", contract);
};

buildContracts();
