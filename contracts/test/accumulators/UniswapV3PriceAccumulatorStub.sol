//SPDX-License-Identifier: MIT
pragma solidity ^0.8;

pragma experimental ABIEncoderV2;

import "../../accumulators/proto/uniswap/UniswapV3PriceAccumulator.sol";

contract UniswapV3PriceAccumulatorStub is UniswapV3PriceAccumulator {
    constructor(
        address uniswapFactory_,
        bytes32 initCodeHash_,
        uint24[] memory poolFees_,
        address quoteToken_,
        uint256 updateTheshold_,
        uint256 minUpdateDelay_,
        uint256 maxUpdateDelay_
    )
        UniswapV3PriceAccumulator(
            uniswapFactory_,
            initCodeHash_,
            poolFees_,
            quoteToken_,
            updateTheshold_,
            minUpdateDelay_,
            maxUpdateDelay_
        )
    {}

    function stubFetchPrice(address token) public view returns (uint256 price) {
        return super.fetchPrice(token);
    }

    function stubComputeWholeUnitAmount(address token) public view returns (uint128 amount) {
        return super.computeWholeUnitAmount(token);
    }

    function validateObservation(address, uint112) internal virtual override returns (bool) {
        return true; // Disable for simplicity
    }
}