// We require the Hardhat Runtime Environment explicitly here. This is optional 
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");

const ethers = hre.ethers;

const uniswapV2FactoryAddress = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
const sushiswapFactoryAddress = "0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac";

const wethAddress = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const daiAddress = "0x6b175474e89094c44da98b954eedeac495271d0f";
const usdcAddress = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const grtAddress = "0xc944e90c64b2c07662a292be6244bdf05cda44a7";

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function createContract(name, ...deploymentArgs) {
  const contractFactory = await ethers.getContractFactory(name);

  const contract = await contractFactory.deploy(...deploymentArgs);

  await contract.deployed();

  return contract;
}

async function main() {
  const factoryAddress = uniswapV2FactoryAddress;

  const token = wethAddress;
  const quoteToken = usdcAddress;

  const period = 10; // 10 seconds

  const oracle = await createContract("UniswapV2PriceOracle", factoryAddress, quoteToken, period);

  while (true) {
    try {
      const estimation = await oracle.estimateGas.update(token);

      console.log("Update gas =", estimation.toString());

      await oracle.update(token);
    } catch (e) {
      console.log(e);
    }

    try {
      const result = await oracle.consultPrice(token);

      console.log("Price =", result.toString());
    } catch (e) {
      console.log(e);
    }

    await sleep(1000);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });