//SPDX-License-Identifier: MIT
pragma solidity ^0.8;

pragma experimental ABIEncoderV2;

import "../../accumulators/proto/uniswap/UniswapV2LiquidityAccumulator.sol";

contract UniswapV2LiquidityAccumulatorStub is UniswapV2LiquidityAccumulator {
    constructor(
        address uniswapFactory_,
        address quoteToken_,
        uint256 updateTheshold_,
        uint256 minUpdateDelay_,
        uint256 maxUpdateDelay_
    ) UniswapV2LiquidityAccumulator(uniswapFactory_, quoteToken_, updateTheshold_, minUpdateDelay_, maxUpdateDelay_) {}

    function harnessFetchLiquidity(address token)
        public
        view
        returns (uint256 tokenLiquidity, uint256 quoteTokenLiquidity)
    {
        return super.fetchLiquidity(token);
    }
}