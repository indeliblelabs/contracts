/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Signer, utils, Contract, ContractFactory, Overrides } from "ethers";
import { Provider, TransactionRequest } from "@ethersproject/providers";
import type {
  TestMinterContract,
  TestMinterContractInterface,
} from "../TestMinterContract";

const _abi = [
  {
    inputs: [],
    name: "contractToMint",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "toMint",
        type: "address",
      },
    ],
    name: "executeExternalContractMint",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "payable",
    type: "function",
  },
];

const _bytecode =
  "0x608060405234801561001057600080fd5b506101a2806100206000396000f3fe6080604052600436106100295760003560e01c80635aa8e74a1461002e578063f5798f521461006b575b600080fd5b34801561003a57600080fd5b5060005461004e906001600160a01b031681565b6040516001600160a01b0390911681526020015b60405180910390f35b61007e610079366004610123565b61008e565b6040519015158152602001610062565b60006001600160a01b0382166100a657506000919050565b60405163140e25ad60e31b81526001600482015282906000906001600160a01b0383169063a0712d6890349060240160206040518083038185885af11580156100f3573d6000803e3d6000fd5b50505050506040513d601f19601f820116820180604052508101906101189190610153565b506001949350505050565b60006020828403121561013557600080fd5b81356001600160a01b038116811461014c57600080fd5b9392505050565b60006020828403121561016557600080fd5b505191905056fea264697066735822122067c7fc056578e60c70e56e338e5dc6eb11f0b60fc433fbc35a0ad0c6b298ac0a64736f6c63430008110033";

export class TestMinterContract__factory extends ContractFactory {
  constructor(
    ...args: [signer: Signer] | ConstructorParameters<typeof ContractFactory>
  ) {
    if (args.length === 1) {
      super(_abi, _bytecode, args[0]);
    } else {
      super(...args);
    }
  }

  deploy(
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<TestMinterContract> {
    return super.deploy(overrides || {}) as Promise<TestMinterContract>;
  }
  getDeployTransaction(
    overrides?: Overrides & { from?: string | Promise<string> }
  ): TransactionRequest {
    return super.getDeployTransaction(overrides || {});
  }
  attach(address: string): TestMinterContract {
    return super.attach(address) as TestMinterContract;
  }
  connect(signer: Signer): TestMinterContract__factory {
    return super.connect(signer) as TestMinterContract__factory;
  }
  static readonly bytecode = _bytecode;
  static readonly abi = _abi;
  static createInterface(): TestMinterContractInterface {
    return new utils.Interface(_abi) as TestMinterContractInterface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): TestMinterContract {
    return new Contract(address, _abi, signerOrProvider) as TestMinterContract;
  }
}
