// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "../../../../oracles/proto/uniswap/UniswapV2Oracle.sol";

contract UniswapV2OracleStub is UniswapV2Oracle {
    struct Config {
        bool needsUpdateOverridden;
        bool needsUpdate;
    }

    Config public config;

    constructor(
        address liquidityAccumulator_,
        address uniswapFactory_,
        address quoteToken_,
        uint256 period_
    ) UniswapV2Oracle(liquidityAccumulator_, uniswapFactory_, quoteToken_, period_) {}

    function stubSetObservation(
        address token,
        uint256 price,
        uint256 tokenLiquidity,
        uint256 quoteTokenLiquidity,
        uint256 timestamp
    ) public {
        ObservationLibrary.Observation storage observation = observations[token];

        observation.price = price;
        observation.tokenLiquidity = tokenLiquidity;
        observation.quoteTokenLiquidity = quoteTokenLiquidity;
        observation.timestamp = timestamp;
    }

    function stubComputeWholeUnitAmount(address token) public view returns (uint256 amount) {
        amount = computeWholeUnitAmount(token);
    }

    function stubComputeAmountOut(
        uint256 priceCumulativeStart,
        uint256 priceCumulativeEnd,
        uint256 timeElapsed,
        uint256 amountIn
    ) public pure returns (uint256 amountOut) {
        // computeAmountOut uses binary fixed point numbers, but raw unsigned integers are more readable,
        // so this function takes raw unsigned integers and converts them as if they were binary fixed point numbers
        unchecked {
            uint256 delta = priceCumulativeEnd - priceCumulativeStart;
            uint256 deltaPerSecond = delta / timeElapsed;
            priceCumulativeEnd =
                priceCumulativeStart +
                (uint256(FixedPoint.encode(uint112(deltaPerSecond))._x) * timeElapsed);
            amountOut = computeAmountOut(priceCumulativeStart, priceCumulativeEnd, timeElapsed, amountIn);
        }
    }

    function overrideNeedsUpdate(bool overridden, bool needsUpdate_) public {
        config.needsUpdateOverridden = overridden;
        config.needsUpdate = needsUpdate_;
    }

    /* Overridden functions */

    function needsUpdate(address token) public view virtual override returns (bool) {
        if (config.needsUpdateOverridden) return config.needsUpdate;
        else return super.needsUpdate(token);
    }
}