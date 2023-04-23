// SPDX-License-Identifier: MIT
pragma solidity =0.8.13;

import "../../PriceAccumulator.sol";
import "../../../libraries/SafeCastExt.sol";

abstract contract ICToken {
    function supplyRatePerBlock() external view virtual returns (uint256);

    function borrowRatePerBlock() external view virtual returns (uint256);

    function underlying() external view virtual returns (address);
}

contract CompoundV2RateAccumulator is PriceAccumulator {
    using SafeCastExt for uint256;

    address public immutable cToken;

    uint256 public immutable blocksPerYear;

    error InvalidRateType(uint256 rateType);

    constructor(
        IAveragingStrategy averagingStrategy_,
        uint256 blocksPerYear_,
        address cToken_,
        address quoteToken_,
        uint256 updateTheshold_,
        uint256 minUpdateDelay_,
        uint256 maxUpdateDelay_
    ) PriceAccumulator(averagingStrategy_, quoteToken_, updateTheshold_, minUpdateDelay_, maxUpdateDelay_) {
        // Throw error if blocksPerYear is 0 or >= 2^112
        blocksPerYear = blocksPerYear_;
        cToken = cToken_;
    }

    function fetchPrice(bytes memory data) internal view virtual override returns (uint112 rate) {
        uint256 rateType = abi.decode(data, (uint256));

        if (rateType == 1) {
            rate = uint112(ICToken(cToken).supplyRatePerBlock());
        } else if (rateType == 2) {
            rate = uint112(ICToken(cToken).borrowRatePerBlock());
        } else {
            revert InvalidRateType(rateType);
        }

        // Convert from block rate to yearly rate
        rate *= uint112(blocksPerYear);
    }
}
