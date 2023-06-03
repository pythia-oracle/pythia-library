// SPDX-License-Identifier: MIT
pragma solidity =0.8.13;

import "../../oracles/PriceVolatilityOracle.sol";

contract PriceVolatilityOracleStub is PriceVolatilityOracle {
    struct Config {
        bool needsUpdateOverridden;
        bool needsUpdate;
        bool canUpdateOverriden;
        bool canUpdate;
        bool sourceOverridden;
        IHistoricalOracle source;
        bool filterAmountOverridden;
        uint256 filterAmount;
        bool filterOffsetOverridden;
        uint256 filterOffset;
        bool filterIncrementOverridden;
        uint256 filterIncrement;
        bool volatilityViewOverridden;
        VolatilityOracleView volatilityView;
        bool meanTypeOverridden;
        uint256 meanType;
    }

    Config internal config;

    constructor(
        VolatilityOracleView view_,
        IHistoricalOracle source_,
        uint256 filterAmount_,
        uint256 filterOffset_,
        uint256 filterIncrement_,
        uint256 meanType_
    ) PriceVolatilityOracle(view_, source_, filterAmount_, filterOffset_, filterIncrement_, meanType_) {}

    function stubPush(
        address token,
        uint112 price,
        uint112 tokenLiquidity,
        uint112 quoteTokenLiquidity,
        uint32 timestamp
    ) public {
        ObservationLibrary.Observation memory observation = ObservationLibrary.Observation({
            price: price,
            tokenLiquidity: tokenLiquidity,
            quoteTokenLiquidity: quoteTokenLiquidity,
            timestamp: timestamp
        });

        push(token, observation);
    }

    function stubPushNow(address token, uint112 price, uint112 tokenLiquidity, uint112 quoteTokenLiquidity) public {
        stubPush(token, price, tokenLiquidity, quoteTokenLiquidity, uint32(block.timestamp));
    }

    function stubOverrideNeedsUpdate(bool overridden, bool needsUpdate_) public {
        config.needsUpdateOverridden = overridden;
        config.needsUpdate = needsUpdate_;
    }

    function stubOverrideCanUpdate(bool overridden, bool canUpdate_) public {
        config.canUpdateOverriden = overridden;
        config.canUpdate = canUpdate_;
    }

    function stubOverrideSource(bool overridden, IHistoricalOracle source_) public {
        config.sourceOverridden = overridden;
        config.source = source_;
    }

    function stubOverrideFilterAmount(bool overridden, uint256 filterAmount_) public {
        config.filterAmountOverridden = overridden;
        config.filterAmount = filterAmount_;
    }

    function stubOverrideFilterOffset(bool overridden, uint256 filterOffset_) public {
        config.filterOffsetOverridden = overridden;
        config.filterOffset = filterOffset_;
    }

    function stubOverrideFilterIncrement(bool overridden, uint256 filterIncrement_) public {
        config.filterIncrementOverridden = overridden;
        config.filterIncrement = filterIncrement_;
    }

    function stubOverrideVolatilityView(bool overridden, VolatilityOracleView volatilityView_) public {
        config.volatilityViewOverridden = overridden;
        config.volatilityView = volatilityView_;
    }

    function stubOverrideMeanType(bool overridden, uint256 meanType_) public {
        config.meanTypeOverridden = overridden;
        config.meanType = meanType_;
    }

    function needsUpdate(bytes memory data) public view virtual override returns (bool) {
        if (config.needsUpdateOverridden) {
            return config.needsUpdate;
        }

        return super.needsUpdate(data);
    }

    function canUpdate(bytes memory data) public view virtual override returns (bool) {
        if (config.canUpdateOverriden) {
            return config.canUpdate;
        }

        return super.canUpdate(data);
    }

    function _source() internal view virtual override returns (IHistoricalOracle) {
        if (config.sourceOverridden) {
            return config.source;
        }

        return super._source();
    }

    function _observationAmount() internal view virtual override returns (uint256) {
        if (config.filterAmountOverridden) {
            return config.filterAmount;
        }

        return super._observationAmount();
    }

    function _observationOffset() internal view virtual override returns (uint256) {
        if (config.filterOffsetOverridden) {
            return config.filterOffset;
        }

        return super._observationOffset();
    }

    function _observationIncrement() internal view virtual override returns (uint256) {
        if (config.filterIncrementOverridden) {
            return config.filterIncrement;
        }

        return super._observationIncrement();
    }

    function _volatilityView() internal view virtual override returns (VolatilityOracleView) {
        if (config.volatilityViewOverridden) {
            return config.volatilityView;
        }

        return super._volatilityView();
    }

    function _meanType() internal view virtual override returns (uint256) {
        if (config.meanTypeOverridden) {
            return config.meanType;
        }

        return super._meanType();
    }
}
