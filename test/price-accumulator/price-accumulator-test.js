const { BigNumber } = require("ethers");
const { expect } = require("chai");

const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const GRT = "0xc944E90C64B2c07662A292be6244BDf05Cda44a7";

const TWO_PERCENT_CHANGE = 2000000;

const MAX_CUMULATIVE_VALUE = BigNumber.from(2).pow(112).sub(1);

async function currentBlockTimestamp() {
    const currentBlockNumber = await ethers.provider.getBlockNumber();

    return await blockTimestamp(currentBlockNumber);
}

async function blockTimestamp(blockNum) {
    return (await ethers.provider.getBlock(blockNum)).timestamp;
}

describe("PriceAccumulator#getCurrentObservation", function () {
    const minUpdateDelay = 10000;
    const maxUpdateDelay = 30000;

    var accumulator;

    beforeEach(async () => {
        const accumulatorFactory = await ethers.getContractFactory("PriceAccumulatorStub");
        accumulator = await accumulatorFactory.deploy(USDC, TWO_PERCENT_CHANGE, minUpdateDelay, maxUpdateDelay);
        await accumulator.deployed();

        // Configure price
        await accumulator.setPrice(GRT, 100);

        // Override changeThresholdPassed (true)
        await accumulator.overrideChangeThresholdPassed(true, true);
    });

    const tests = [[0], [1], [10], [ethers.utils.parseUnits("101.0", 18)]];

    for (const test of tests) {
        it(`price = ${test[0].toString()}`, async function () {
            // Configure price
            await accumulator.setPrice(GRT, test[0]);

            const [price, timestamp] = await accumulator.getCurrentObservation(GRT);

            expect(price).to.equal(test[0]);
            expect(timestamp).to.equal(await currentBlockTimestamp());
        });
    }
});

describe("PriceAccumulator#getCurrentAccumulation", function () {
    const minUpdateDelay = 10000;
    const maxUpdateDelay = 30000;

    var accumulator;

    beforeEach(async () => {
        const accumulatorFactory = await ethers.getContractFactory("PriceAccumulatorStub");
        accumulator = await accumulatorFactory.deploy(USDC, TWO_PERCENT_CHANGE, minUpdateDelay, maxUpdateDelay);
        await accumulator.deployed();
    });

    it("Reverts if the last observation is uninitialized", async function () {
        await expect(accumulator.getCurrentAccumulation(GRT)).to.be.revertedWith("PriceAccumulator: UNINITIALIZED");
    });
});

describe("PriceAccumulator#needsUpdate", () => {
    const minUpdateDelay = 10000;
    const maxUpdateDelay = 30000;

    var accumulator;

    var updateTime;

    beforeEach(async () => {
        const accumulatorFactory = await ethers.getContractFactory("PriceAccumulatorStub");
        accumulator = await accumulatorFactory.deploy(USDC, TWO_PERCENT_CHANGE, minUpdateDelay, maxUpdateDelay);
        await accumulator.deployed();

        // Configure price
        await accumulator.setPrice(GRT, 100);

        // Override changeThresholdPassed (false)
        await accumulator.overrideChangeThresholdPassed(true, false);

        // Time increases by 1 second with each block mined
        await hre.timeAndMine.setTimeIncrease(1);

        // Initial update
        const updateReceipt = await accumulator.update(GRT);
        updateTime = (await ethers.provider.getBlock(updateReceipt.blockNumber)).timestamp;
    });

    it("Shouldn't need update if delta time is less than the min update delay (update threshold passed)", async () => {
        // changeThresholdPassed = true
        await accumulator.overrideChangeThresholdPassed(true, true);

        // deltaTime = 1
        expect(await accumulator.needsUpdate(GRT)).to.equal(false);

        // deltaTime = minUpdateDelay - 1
        await hre.timeAndMine.setTime(updateTime + minUpdateDelay - 1);
        expect(await accumulator.needsUpdate(GRT)).to.equal(false);
    });

    it("Shouldn't need update if delta time is less than the min update delay (update threshold not passed)", async () => {
        // deltaTime = 1
        expect(await accumulator.needsUpdate(GRT)).to.equal(false);

        // deltaTime = minUpdateDelay - 1
        await hre.timeAndMine.setTime(updateTime + minUpdateDelay - 1);
        expect(await accumulator.needsUpdate(GRT)).to.equal(false);
    });

    it("Should need update if delta time is within min and max update delay (update threshold passed)", async () => {
        // changeThresholdPassed = true
        await accumulator.overrideChangeThresholdPassed(true, true);

        // deltaTime = minUpdateDelay
        await hre.timeAndMine.setTime(updateTime + minUpdateDelay);
        expect(await accumulator.needsUpdate(GRT)).to.equal(true);

        // deltaTime = maxUpdateDelay - 1
        await hre.timeAndMine.setTime(updateTime + maxUpdateDelay - 1);
        expect(await accumulator.needsUpdate(GRT)).to.equal(true);
    });

    it("Shouldn't need update if delta time is within min and max update delay (update threshold not passed)", async () => {
        // deltaTime = minUpdateDelay
        await hre.timeAndMine.setTime(updateTime + minUpdateDelay);
        expect(await accumulator.needsUpdate(GRT)).to.equal(false);

        // deltaTime = maxUpdateDelay - 1
        await hre.timeAndMine.setTime(updateTime + maxUpdateDelay - 1);
        expect(await accumulator.needsUpdate(GRT)).to.equal(false);
    });

    it("Should need update if delta time is >= max update delay (update threshold passed)", async () => {
        // changeThresholdPassed = true
        await accumulator.overrideChangeThresholdPassed(true, true);

        // deltaTime = maxUpdateDelay
        await hre.timeAndMine.setTime(updateTime + maxUpdateDelay);
        expect(await accumulator.needsUpdate(GRT)).to.equal(true);

        // deltaTime = maxUpdateDelay + 1
        await hre.timeAndMine.setTime(updateTime + maxUpdateDelay + 1);
        expect(await accumulator.needsUpdate(GRT)).to.equal(true);
    });

    it("Should need update if delta time is >= max update delay (update threshold not passed)", async () => {
        // deltaTime = maxUpdateDelay
        await hre.timeAndMine.setTime(updateTime + maxUpdateDelay);
        expect(await accumulator.needsUpdate(GRT)).to.equal(true);

        // deltaTime = maxUpdateDelay + 1
        await hre.timeAndMine.setTime(updateTime + maxUpdateDelay + 1);
        expect(await accumulator.needsUpdate(GRT)).to.equal(true);
    });
});

describe("PriceAccumulator#canUpdate", () => {
    const minUpdateDelay = 10000;
    const maxUpdateDelay = 30000;

    var accumulator;

    beforeEach(async () => {
        const accumulatorFactory = await ethers.getContractFactory("PriceAccumulatorStub");
        accumulator = await accumulatorFactory.deploy(USDC, TWO_PERCENT_CHANGE, minUpdateDelay, maxUpdateDelay);
    });

    describe("Can't update when it", function () {
        it("Doesn't need an update", async function () {
            await accumulator.overrideNeedsUpdate(true, false);

            expect(await accumulator.canUpdate(GRT)).to.equal(false);
        });

        it("Observation is still pending", async function () {
            await accumulator.overrideNeedsUpdate(true, true);

            const currentBlockNumber = await ethers.provider.getBlockNumber();

            await accumulator.setPendingObservation(GRT, 0, currentBlockNumber + 1);

            expect(await accumulator.canUpdate(GRT)).to.equal(false);
        });
    });

    describe("Can update when it needs an update and it", function () {
        beforeEach(async () => {
            await accumulator.overrideNeedsUpdate(true, true);
        });

        it("Has no pending observation", async function () {
            expect(await accumulator.canUpdate(GRT)).to.equal(true);
        });

        it("Has a pending observation which has passed the minimum block duration", async function () {
            const currentBlockNumber = await ethers.provider.getBlockNumber();
            const minPendingPeriod = await accumulator.OBSERVATION_BLOCK_MIN_PERIOD();

            await accumulator.setPendingObservation(GRT, 0, BigNumber.from(currentBlockNumber).sub(minPendingPeriod));

            expect(await accumulator.canUpdate(GRT)).to.equal(true);
        });
    });
});

describe("PriceAccumulator#changeThresholdSurpassed", () => {
    const minUpdateDelay = 10000;
    const maxUpdateDelay = 30000;

    var accumulator;

    const tests = [
        { args: [0, 0, TWO_PERCENT_CHANGE], expected: false },
        { args: [0, 100, TWO_PERCENT_CHANGE], expected: true },
        { args: [100, 0, TWO_PERCENT_CHANGE], expected: true },
        { args: [100, 101, TWO_PERCENT_CHANGE], expected: false },
        { args: [100, 102, TWO_PERCENT_CHANGE], expected: true },
        { args: [100, 103, TWO_PERCENT_CHANGE], expected: true },
        { args: [100, 1000000, TWO_PERCENT_CHANGE], expected: true },
        { args: [101, 100, TWO_PERCENT_CHANGE], expected: false },
        { args: [102, 100, TWO_PERCENT_CHANGE], expected: true },
        { args: [103, 100, TWO_PERCENT_CHANGE], expected: true },
        { args: [1000000, 100, TWO_PERCENT_CHANGE], expected: true },
    ];

    beforeEach(async () => {
        const accumulatorFactory = await ethers.getContractFactory("PriceAccumulatorStub");
        accumulator = await accumulatorFactory.deploy(USDC, TWO_PERCENT_CHANGE, minUpdateDelay, maxUpdateDelay);
        await accumulator.deployed();
    });

    tests.forEach(({ args, expected }) => {
        it(`Should evaluate to ${expected} with prices {${args[0]}, ${args[1]}} and update threshold ${args[2]}`, async () => {
            const received = await accumulator.harnessChangeThresholdSurpassed(args[0], args[1], args[2]);
            expect(received).to.equal(expected);
        });
    });
});

describe("PriceAccumulator#calculatePrice", () => {
    const minUpdateDelay = 10000;
    const maxUpdateDelay = 30000;

    var accumulator;

    const tests = [
        {
            // deltaCumulativePrice = 1
            // deltaTime = 1
            args: [
                { cumulativePrice: 0, timestamp: 1 },
                { cumulativePrice: 1, timestamp: 2 },
            ],
            expected: 1,
        },
        {
            // deltaCumulativePrice = 0
            // deltaTime = 1
            args: [
                { cumulativePrice: 0, timestamp: 1 },
                { cumulativePrice: 0, timestamp: 2 },
            ],
            expected: 0,
        },
        {
            // deltaCumulativePrice = 0
            // deltaTime = 1
            args: [
                { cumulativePrice: 1000000, timestamp: 1 },
                { cumulativePrice: 1000000, timestamp: 2 },
            ],
            expected: 0,
        },
        {
            // deltaCumulativePrice = 1000000
            // deltaTime = 1
            args: [
                { cumulativePrice: 1000000, timestamp: 1 },
                { cumulativePrice: 2000000, timestamp: 2 },
            ],
            expected: 1000000,
        },
        {
            // deltaCumulativePrice = 1000000
            // deltaTime = 10
            args: [
                { cumulativePrice: 1000000, timestamp: 1 },
                { cumulativePrice: 2000000, timestamp: 11 },
            ],
            expected: 100000,
        },
        {
            // deltaCumulativePrice = 1000000
            // deltaTime = 100000
            args: [
                { cumulativePrice: 1000000, timestamp: 100000 },
                { cumulativePrice: 2000000, timestamp: 200000 },
            ],
            expected: 10,
        },
        {
            // **Overflow test**
            // deltaCumulativePrice = 10
            // deltaTime = 1
            args: [
                {
                    cumulativePrice: MAX_CUMULATIVE_VALUE,
                    timestamp: 10,
                },
                { cumulativePrice: 9, timestamp: 11 },
            ],
            expected: 10,
        },
    ];

    const revertedWithTests = [
        {
            args: [
                { cumulativePrice: 0, timestamp: 0 },
                { cumulativePrice: 0, timestamp: 0 },
            ],
            expected: "PriceAccumulator: TIMESTAMP_CANNOT_BE_ZERO",
        },
        {
            args: [
                { cumulativePrice: 0, timestamp: 0 },
                { cumulativePrice: 0, timestamp: 1 },
            ],
            expected: "PriceAccumulator: TIMESTAMP_CANNOT_BE_ZERO",
        },
        {
            args: [
                { cumulativePrice: 0, timestamp: 1 },
                { cumulativePrice: 0, timestamp: 1 },
            ],
            expected: "PriceAccumulator: DELTA_TIME_CANNOT_BE_ZERO",
        },
        {
            args: [
                { cumulativePrice: 0, timestamp: 1 },
                { cumulativePrice: 0, timestamp: 0 },
            ],
            expected: false, // Subtraction underflow
        },
    ];

    beforeEach(async () => {
        const accumulatorFactory = await ethers.getContractFactory("PriceAccumulatorStub");
        accumulator = await accumulatorFactory.deploy(USDC, TWO_PERCENT_CHANGE, minUpdateDelay, maxUpdateDelay);
        await accumulator.deployed();
    });

    tests.forEach(({ args, expected }) => {
        it(`Should evaluate to ${expected} using accumulations {${JSON.stringify(args[0])}, ${JSON.stringify(
            args[1]
        )}}`, async () => {
            expect(await accumulator.calculatePrice(args[0], args[1])).to.equal(expected);
        });
    });

    revertedWithTests.forEach(({ args, expected }) => {
        it(`Should revert${expected ? " with " + expected : ""} using accumulations {${JSON.stringify(
            args[0]
        )}, ${JSON.stringify(args[1])}}`, async () => {
            if (expected) await expect(accumulator.calculatePrice(args[0], args[1])).to.be.revertedWith(expected);
            else await expect(accumulator.calculatePrice(args[0], args[1])).to.be.reverted;
        });
    });
});

describe("PriceAccumulator#update", () => {
    const minUpdateDelay = 10000;
    const maxUpdateDelay = 30000;

    var accumulator;

    var startingTime;

    const initialUpdateTests = [
        /* Basic tests w/ no price setting */
        {
            args: {
                initialPrice: undefined,
                overrideNeedsUpdate: {
                    needsUpdate: true,
                },
            },
            expectedReturn: true,
        },
        {
            args: {
                initialPrice: undefined,
                overrideNeedsUpdate: {
                    needsUpdate: false,
                },
            },
            expectedReturn: false,
        },
        /* Tests without overrides */
        {
            args: {
                initialPrice: ethers.utils.parseEther("0"),
            },
            expectedReturn: true,
        },
        {
            args: {
                initialPrice: ethers.utils.parseEther("0"),
            },
            expectedReturn: true,
        },
        {
            args: {
                initialPrice: ethers.utils.parseEther("100"),
            },
            expectedReturn: true,
        },
        {
            args: {
                initialPrice: ethers.utils.parseEther("100"),
            },
            expectedReturn: true,
        },
        {
            args: {
                initialPrice: ethers.utils.parseEther("100"),
            },
            expectedReturn: true,
        },
        {
            args: {
                initialPrice: ethers.utils.parseEther("200"),
            },
            expectedReturn: true,
        },
        {
            args: {
                initialPrice: MAX_CUMULATIVE_VALUE,
            },
            expectedReturn: true,
        },
        /* Tests with overrides - needsUpdate = false */
        {
            args: {
                initialPrice: ethers.utils.parseEther("0"),
                overrideNeedsUpdate: {
                    needsUpdate: false,
                },
            },
            expectedReturn: false,
        },
        {
            args: {
                initialPrice: ethers.utils.parseEther("0"),
                overrideNeedsUpdate: {
                    needsUpdate: false,
                },
            },
            expectedReturn: false,
        },
        {
            args: {
                initialPrice: ethers.utils.parseEther("100"),
                overrideNeedsUpdate: {
                    needsUpdate: false,
                },
            },
            expectedReturn: false,
        },
        {
            args: {
                initialPrice: ethers.utils.parseEther("100"),
                overrideNeedsUpdate: {
                    needsUpdate: false,
                },
            },
            expectedReturn: false,
        },
        {
            args: {
                initialPrice: ethers.utils.parseEther("100"),
                overrideNeedsUpdate: {
                    needsUpdate: false,
                },
            },
            expectedReturn: false,
        },
        {
            args: {
                initialPrice: ethers.utils.parseEther("200"),
                overrideNeedsUpdate: {
                    needsUpdate: false,
                },
            },
            expectedReturn: false,
        },
        {
            args: {
                initialPrice: MAX_CUMULATIVE_VALUE,
                overrideNeedsUpdate: {
                    needsUpdate: false,
                },
            },
            expectedReturn: false,
        },
        /* Tests with overrides - needsUpdate = true */
        {
            args: {
                initialPrice: ethers.utils.parseEther("0"),
                overrideNeedsUpdate: {
                    needsUpdate: true,
                },
            },
            expectedReturn: true,
        },
        {
            args: {
                initialPrice: ethers.utils.parseEther("0"),
                overrideNeedsUpdate: {
                    needsUpdate: true,
                },
            },
            expectedReturn: true,
        },
        {
            args: {
                initialPrice: ethers.utils.parseEther("100"),
                overrideNeedsUpdate: {
                    needsUpdate: true,
                },
            },
            expectedReturn: true,
        },
        {
            args: {
                initialPrice: ethers.utils.parseEther("100"),
                overrideNeedsUpdate: {
                    needsUpdate: true,
                },
            },
            expectedReturn: true,
        },
        {
            args: {
                initialPrice: ethers.utils.parseEther("100"),
                overrideNeedsUpdate: {
                    needsUpdate: true,
                },
            },
            expectedReturn: true,
        },
        {
            args: {
                initialPrice: ethers.utils.parseEther("200"),
                overrideNeedsUpdate: {
                    needsUpdate: true,
                },
            },
            expectedReturn: true,
        },
        {
            args: {
                initialPrice: MAX_CUMULATIVE_VALUE,
                overrideNeedsUpdate: {
                    needsUpdate: true,
                },
            },
            expectedReturn: true,
        },
    ];

    const secondUpdateTests = [
        {
            args: {
                initialPrice: ethers.utils.parseEther("0"),
                secondPrice: ethers.utils.parseEther("0"),
                overrideNeedsUpdate: {
                    needsUpdate: true,
                },
            },
            expectedReturn: true,
        },
        {
            args: {
                initialPrice: ethers.utils.parseEther("0"),
                secondPrice: ethers.utils.parseEther("100"),
                overrideNeedsUpdate: {
                    needsUpdate: true,
                },
            },
            expectedReturn: true,
        },
        {
            args: {
                initialPrice: ethers.utils.parseEther("100"),
                secondPrice: ethers.utils.parseEther("0"),
                overrideNeedsUpdate: {
                    needsUpdate: true,
                },
            },
            expectedReturn: true,
        },
        {
            args: {
                initialPrice: ethers.utils.parseEther("100"),
                secondPrice: ethers.utils.parseEther("100"),
                overrideNeedsUpdate: {
                    needsUpdate: true,
                },
            },
            expectedReturn: true,
        },
        {
            args: {
                initialPrice: ethers.utils.parseEther("50"),
                secondPrice: ethers.utils.parseEther("100"),
                overrideNeedsUpdate: {
                    needsUpdate: true,
                },
            },
            expectedReturn: true,
        },
        {
            args: {
                initialPrice: ethers.utils.parseEther("100"),
                secondPrice: ethers.utils.parseEther("50"),
                overrideNeedsUpdate: {
                    needsUpdate: true,
                },
            },
            expectedReturn: true,
        },
        {
            args: {
                initialPrice: ethers.utils.parseEther("25"),
                secondPrice: ethers.utils.parseEther("75"),
                overrideNeedsUpdate: {
                    needsUpdate: true,
                },
            },
            expectedReturn: true,
        },
        {
            // ** Overflow test **
            args: {
                initialPrice: MAX_CUMULATIVE_VALUE,
                secondPrice: ethers.utils.parseEther("100"),
                overrideNeedsUpdate: {
                    needsUpdate: true,
                },
            },
            expectedReturn: true,
        },
    ];

    beforeEach(async () => {
        const accumulatorFactory = await ethers.getContractFactory("PriceAccumulatorStub");
        accumulator = await accumulatorFactory.deploy(USDC, TWO_PERCENT_CHANGE, minUpdateDelay, maxUpdateDelay);
        await accumulator.deployed();

        await accumulator.overrideValidateObservation(true, true);

        startingTime = BigNumber.from(0);
    });

    async function verifyUpdate(expectedReturn, initialPrice, secondPrice = undefined, firstUpdateTime = 0) {
        expect(await accumulator.callStatic.update(GRT)).to.equal(expectedReturn);

        const receipt = await accumulator.update(GRT);
        await receipt.wait();

        const updateTime = (await ethers.provider.getBlock(receipt.blockNumber)).timestamp;

        const accumulation = await accumulator.getLastAccumulation(GRT);
        const observation = await accumulator.getLastObservation(GRT);

        var expectedCumulativePrice = 0;

        var expectedPrice = 0;

        var expectedTimestamp = startingTime;

        if (secondPrice) {
            // Verifying a second update

            if (expectedReturn) {
                // An update should have occurred

                // Increase time so that delta time from the last accumulation to the current is not 0
                await hre.timeAndMine.setTime((await currentBlockTimestamp()) + 10);

                const priceFromAccumulation = await accumulator.calculatePrice(
                    await accumulator.getLastAccumulation(GRT),
                    await accumulator.getCurrentAccumulation(GRT)
                );

                const deltaTime = updateTime - firstUpdateTime;

                // Calculate cumulatives
                expectedCumulativePrice = BigNumber.from(initialPrice).mul(BigNumber.from(deltaTime));

                // Process overflows
                while (expectedCumulativePrice.gt(MAX_CUMULATIVE_VALUE)) {
                    expectedCumulativePrice = expectedCumulativePrice.sub(
                        MAX_CUMULATIVE_VALUE.add(1) // = 2e256
                    );
                }

                expectedPrice = secondPrice;

                expectedTimestamp = updateTime;

                // Verify price from accumulations is correct
                expect(priceFromAccumulation, "LFA - TL").to.equal(expectedPrice);

                await expect(receipt, "2L - Log")
                    .to.emit(accumulator, "Updated")
                    .withArgs(GRT, USDC, updateTime, expectedPrice);
            } else {
                // No update should have occurred => use last values

                expectedCumulativePrice = initialPrice ?? 0;

                expectedPrice = initialPrice ?? 0;

                expectedTimestamp = firstUpdateTime;

                await expect(receipt, "2L - NLog").to.not.emit(accumulator, "Updated");
            }
        } else {
            // Verifying initial update

            if (expectedReturn) {
                // An update should have occurred

                expectedCumulativePrice = 0;

                expectedPrice = initialPrice ?? 0;

                expectedTimestamp = updateTime;

                await expect(receipt, "1L - Log")
                    .to.emit(accumulator, "Updated")
                    .withArgs(GRT, USDC, updateTime, expectedPrice);
            } else {
                // An update should not have occurred

                await expect(receipt, "1L - NLog").to.not.emit(accumulator, "Updated");
            }
        }

        expect(accumulation["cumulativePrice"], "CTL").to.equal(expectedCumulativePrice);
        expect(accumulation["timestamp"], "AT").to.equal(expectedTimestamp);

        expect(observation["price"], "TL").to.equal(expectedPrice);
        expect(observation["timestamp"], "OT").to.equal(expectedTimestamp);

        // Now we make the accumulator catch up and verify the latest accumulations

        // No changes expected => return
        if (!expectedReturn || !initialPrice) return;

        // Ensure enough time passes to warrent an update
        await hre.timeAndMine.setTime((await currentBlockTimestamp()) + maxUpdateDelay);

        const receipt2 = await accumulator.update(GRT);
        await receipt2.wait();

        const updateTime2 = (await ethers.provider.getBlock(receipt2.blockNumber)).timestamp;

        const accumulation2 = await accumulator.getLastAccumulation(GRT);
        const observation2 = await accumulator.getLastObservation(GRT);

        const deltaTime2 = updateTime2 - updateTime;

        if (secondPrice) {
            expectedCumulativePrice = BigNumber.from(expectedCumulativePrice).add(
                BigNumber.from(secondPrice).mul(BigNumber.from(deltaTime2))
            );
        } else {
            expectedCumulativePrice = BigNumber.from(expectedCumulativePrice).add(
                BigNumber.from(initialPrice).mul(BigNumber.from(deltaTime2))
            );
        }

        // Process overflows
        while (expectedCumulativePrice.gt(MAX_CUMULATIVE_VALUE)) {
            expectedCumulativePrice = expectedCumulativePrice.sub(
                MAX_CUMULATIVE_VALUE.add(1) // = 2e256
            );
        }

        expect(accumulation2["cumulativePrice"], "Final CTL").to.equal(expectedCumulativePrice);
        expect(accumulation2["timestamp"], "Final AT").to.equal(updateTime2);

        expect(observation2["price"], "Final TL").to.equal(expectedPrice);
        expect(observation2["timestamp"], "Final OT").to.equal(updateTime2);
    }

    initialUpdateTests.forEach(({ args, expectedReturn }) => {
        it(`${expectedReturn ? "Should" : "Shouldn't"} update (initial) using args ${JSON.stringify(
            args
        )}`, async function () {
            // Initialize the first observation and accumulation with zero price
            {
                await accumulator.overrideNeedsUpdate(true, true);
                await accumulator.update(GRT); // Initialize first (0) observation
                await accumulator.update(GRT); // Initialize first (0) accumulation
                [, startingTime] = await accumulator.getLastAccumulation(GRT);
                await accumulator.overrideNeedsUpdate(false, false);
                await hre.timeAndMine.setTime((await currentBlockTimestamp()) + maxUpdateDelay);
            }

            if (args["initialPrice"]) {
                // Configure price
                await (await accumulator.setPrice(GRT, args["initialPrice"])).wait();
            }

            if (args["overrideNeedsUpdate"]) {
                // Override needsUpdate
                await (await accumulator.overrideNeedsUpdate(true, args["overrideNeedsUpdate"]["needsUpdate"])).wait();
            }

            await verifyUpdate(expectedReturn, args["initialPrice"]);
        });
    });

    secondUpdateTests.forEach(({ args, expectedReturn }) => {
        it(`${expectedReturn ? "Should" : "Shouldn't"} update using args ${JSON.stringify(args)}`, async function () {
            // Initialize the first observation and accumulation with zero price
            {
                await accumulator.overrideNeedsUpdate(true, true);
                await accumulator.update(GRT); // Initialize first (0) observation
                await accumulator.update(GRT); // Initialize first (0) accumulation
                [, startingTime] = await accumulator.getLastAccumulation(GRT);
                await accumulator.overrideNeedsUpdate(false, false);
                await hre.timeAndMine.setTime((await currentBlockTimestamp()) + maxUpdateDelay);
            }

            // Configure initial price
            await (await accumulator.setPrice(GRT, args["initialPrice"])).wait();

            // Initial update
            const receipt = await accumulator.update(GRT);
            await receipt.wait();

            const updateTime = (await ethers.provider.getBlock(receipt.blockNumber)).timestamp;

            // Configure price
            await (await accumulator.setPrice(GRT, args["secondPrice"])).wait();

            if (args["overrideNeedsUpdate"]) {
                // Override needsUpdate
                await (await accumulator.overrideNeedsUpdate(true, args["overrideNeedsUpdate"]["needsUpdate"])).wait();
            }

            await verifyUpdate(expectedReturn, args["initialPrice"], args["secondPrice"], updateTime);
        });
    });

    it("Shouldn't update when deltaTime = 0", async () => {
        // Configure initial price
        const initialPrice = ethers.utils.parseEther("100");
        await (await accumulator.setPrice(GRT, initialPrice)).wait();

        // Override needsUpdate
        await (await accumulator.overrideNeedsUpdate(true, true)).wait();

        // Initial update
        const initialUpdateReceipt = await accumulator.update(GRT);
        await initialUpdateReceipt.wait();
        const initialUpdateTime = (await ethers.provider.getBlock(initialUpdateReceipt.blockNumber)).timestamp;

        // Configure price(1)
        const firstPrice = ethers.utils.parseEther("101");
        await (await accumulator.setPrice(GRT, firstPrice)).wait();

        // Disable automining
        await ethers.provider.send("evm_setAutomine", [false]);

        try {
            // Perform update(1)
            const firstUpdateReceipt = await accumulator.update(GRT);

            // Configure price(2)
            const updatePriceReceipt = await accumulator.setPrice(GRT, ethers.utils.parseEther("102"));

            // Perform update(2)
            const secondUpdateReceipt = await accumulator.update(GRT);

            // Mine the transactions
            await ethers.provider.send("evm_mine");

            // Wait for transactions to be mined
            await firstUpdateReceipt.wait();
            await updatePriceReceipt.wait();
            await secondUpdateReceipt.wait();

            const firstUpdateTime = (await ethers.provider.getBlock(firstUpdateReceipt.blockNumber)).timestamp;

            const deltaTime = firstUpdateTime - initialUpdateTime;

            const expectedCumulativePrice = initialPrice.mul(BigNumber.from(deltaTime));

            const accumulation = await accumulator.getLastAccumulation(GRT);
            const observation = await accumulator.getLastObservation(GRT);

            expect(accumulation["cumulativePrice"], "CTL").to.equal(expectedCumulativePrice);

            expect(observation["price"], "TL").to.equal(firstPrice);
        } finally {
            // Re-enable automining
            await ethers.provider.send("evm_setAutomine", [true]);
        }
    });

    it("Shouldn't update when validateObservation returns false", async () => {
        // Configure initial price
        const initialPrice = ethers.utils.parseEther("100");
        await (await accumulator.setPrice(GRT, initialPrice)).wait();

        // Override needsUpdate
        await (await accumulator.overrideNeedsUpdate(true, true)).wait();

        // Initial update
        const initialUpdateReceipt = await accumulator.update(GRT);
        await initialUpdateReceipt.wait();
        const initialUpdateTime = (await ethers.provider.getBlock(initialUpdateReceipt.blockNumber)).timestamp;

        // Configure price(1)
        const firstPrice = ethers.utils.parseEther("200");
        await (await accumulator.setPrice(GRT, firstPrice)).wait();

        // Make validateObservation return false
        await accumulator.overrideValidateObservation(true, false);

        // Perform update(1)
        const firstUpdateReceipt = await accumulator.update(GRT);

        await expect(firstUpdateReceipt).to.not.emit(accumulator, "Updated");

        const accumulation = await accumulator.getLastAccumulation(GRT);
        const observation = await accumulator.getLastObservation(GRT);

        expect(accumulation["cumulativePrice"]).to.equal(0);
        expect(observation["price"]).to.equal(initialPrice);
        expect(observation["timestamp"]).to.equal(initialUpdateTime);
    });
});

describe("PriceAccumulator#supportsInterface(interfaceId)", function () {
    const minUpdateDelay = 10000;
    const maxUpdateDelay = 30000;

    var accumulator;
    var interfaceIds;

    beforeEach(async () => {
        const accumulatorFactory = await ethers.getContractFactory("PriceAccumulatorStub");
        const interfaceIdsFactory = await ethers.getContractFactory("InterfaceIds");
        accumulator = await accumulatorFactory.deploy(USDC, TWO_PERCENT_CHANGE, minUpdateDelay, maxUpdateDelay);
        await accumulator.deployed();
        interfaceIds = await interfaceIdsFactory.deploy();
    });

    it("Should support IPriceAccumulator", async () => {
        const interfaceId = await interfaceIds.iPriceAccumulator();
        expect(await accumulator["supportsInterface(bytes4)"](interfaceId)).to.equal(true);
    });

    it("Should support IPriceOracle", async () => {
        const interfaceId = await interfaceIds.iPriceOracle();
        expect(await accumulator["supportsInterface(bytes4)"](interfaceId)).to.equal(true);
    });

    it("Should support IQuoteToken", async () => {
        const interfaceId = await interfaceIds.iQuoteToken();
        expect(await accumulator["supportsInterface(bytes4)"](interfaceId)).to.equal(true);
    });
});

describe("PriceAccumulator#consultPrice(token)", function () {
    const minUpdateDelay = 10000;
    const maxUpdateDelay = 30000;

    var accumulator;

    beforeEach(async () => {
        const accumulatorFactory = await ethers.getContractFactory("PriceAccumulatorStub");
        accumulator = await accumulatorFactory.deploy(USDC, TWO_PERCENT_CHANGE, minUpdateDelay, maxUpdateDelay);
    });

    tests = [0, 1, ethers.utils.parseUnits("1.0", 18), BigNumber.from(2).pow(112).sub(1)];

    tests.forEach(function (price) {
        it(`price = ${price}`, async function () {
            await accumulator.setPrice(ethers.constants.AddressZero, price);

            expect(await accumulator["consultPrice(address)"](ethers.constants.AddressZero)).to.equal(price);
        });
    });
});

describe("PriceAccumulator#consultPrice(token, maxAge)", function () {
    const minUpdateDelay = 10000;
    const maxUpdateDelay = 30000;

    var accumulator;

    beforeEach(async () => {
        const accumulatorFactory = await ethers.getContractFactory("PriceAccumulatorStub");
        accumulator = await accumulatorFactory.deploy(USDC, TWO_PERCENT_CHANGE, minUpdateDelay, maxUpdateDelay);
    });

    tests = [0, 1, ethers.utils.parseUnits("1.0", 18), BigNumber.from(2).pow(112).sub(1)];

    tests.forEach(function (price) {
        it(`price = ${price}`, async function () {
            await accumulator.setPrice(ethers.constants.AddressZero, price);

            expect(await accumulator["consultPrice(address,uint256)"](ethers.constants.AddressZero, 0)).to.equal(price);
        });
    });
});

describe("PriceAccumulator#validateObservation(token, tokenLiquidity, quoteTokenLiquidity)", function () {
    const minUpdateDelay = 10000;
    const maxUpdateDelay = 30000;

    var accumulator;
    var accumulatorCaller;
    var token;

    beforeEach(async () => {
        const accumulatorFactory = await ethers.getContractFactory("PriceAccumulatorStub");
        const accumulatorCallerFactory = await ethers.getContractFactory("PriceAccumulatorStubCaller");
        const erc20Factory = await ethers.getContractFactory("FakeERC20");

        accumulator = await accumulatorFactory.deploy(USDC, TWO_PERCENT_CHANGE, minUpdateDelay, maxUpdateDelay);
        await accumulator.deployed();

        accumulatorCaller = await accumulatorCallerFactory.deploy(accumulator.address);

        token = await erc20Factory.deploy("Token", "T", 18);
        await token.deployed();
    });

    it("Should revert when caller is a smart contract", async () => {
        await expect(accumulatorCaller.stubValidateObservation(token.address, 0)).to.be.revertedWith(
            "LiquidityAccumulator: MUST_BE_EOA"
        );
    });

    it("Should return false for the first observation", async () => {
        expect(await accumulator.callStatic.stubValidateObservation(token.address, 0)).to.equal(false);
    });

    const tests = [
        {
            price: ethers.utils.parseEther("0"),
        },
        {
            price: ethers.utils.parseEther("100"),
        },
    ];

    describe("Should store the observation upon first call", async () => {
        async function validate(price) {
            const receipt = await accumulator.stubValidateObservation(token.address, price);

            const [owner] = await ethers.getSigners();

            const pendingObservation = await accumulator.pendingObservations(token.address, owner.address);

            expect(pendingObservation["blockNumber"]).to.equal(receipt.blockNumber);
            expect(pendingObservation["price"]).to.equal(price);
        }

        tests.forEach(({ price }) => {
            it("price = " + price, async () => {
                await validate(price);
            });
        });
    });

    describe("Second call", async () => {
        async function validateBeforeMinPeriod(price) {
            const minPeriod = await accumulator.OBSERVATION_BLOCK_MIN_PERIOD();

            const firstReceipt = await accumulator.stubValidateObservation(token.address, price);

            expect(await accumulator.callStatic.stubValidateObservation(token.address, price)).to.equal(false);

            const secondReceipt = await accumulator.stubValidateObservation(token.address, price);

            expect(secondReceipt.blockNumber - firstReceipt.blockNumber).to.be.lessThan(minPeriod.toNumber());

            const [owner] = await ethers.getSigners();

            const pendingObservation = await accumulator.pendingObservations(token.address, owner.address);

            expect(pendingObservation["blockNumber"]).to.equal(firstReceipt.blockNumber);
            expect(pendingObservation["price"]).to.equal(price);
        }

        async function validateReturnWithinPeriod(price, useMin) {
            const minPeriod = await accumulator.OBSERVATION_BLOCK_MIN_PERIOD();
            const maxPeriod = await accumulator.OBSERVATION_BLOCK_MAX_PERIOD();

            await accumulator.stubValidateObservation(token.address, price);

            await hre.timeAndMine.mine(useMin ? minPeriod : maxPeriod);

            expect(await accumulator.callStatic.stubValidateObservation(token.address, price)).to.equal(true);
        }

        async function validateDeletesWithinPeriod(price, useMin) {
            const minPeriod = await accumulator.OBSERVATION_BLOCK_MIN_PERIOD();
            const maxPeriod = await accumulator.OBSERVATION_BLOCK_MAX_PERIOD();

            const firstReceipt = await accumulator.stubValidateObservation(token.address, price);

            await hre.timeAndMine.mine((useMin ? minPeriod : maxPeriod) - 1);

            const secondReceipt = await accumulator.stubValidateObservation(token.address, price);

            expect(secondReceipt.blockNumber - firstReceipt.blockNumber).to.be.within(
                minPeriod.toNumber(),
                maxPeriod.toNumber()
            );

            const [owner] = await ethers.getSigners();

            const pendingObservation = await accumulator.pendingObservations(token.address, owner.address);

            expect(pendingObservation["blockNumber"]).to.equal(0);
            expect(pendingObservation["price"]).to.equal(0);
        }

        async function validateAfterMaxPeriod(price) {
            const maxPeriod = await accumulator.OBSERVATION_BLOCK_MAX_PERIOD();

            const firstReceipt = await accumulator.stubValidateObservation(token.address, price);

            await hre.timeAndMine.mine(maxPeriod.add(1));

            expect(await accumulator.callStatic.stubValidateObservation(token.address, price)).to.equal(false);

            const secondReceipt = await accumulator.stubValidateObservation(token.address, price);

            expect(secondReceipt.blockNumber - firstReceipt.blockNumber).to.be.greaterThan(maxPeriod.toNumber());

            const [owner] = await ethers.getSigners();

            const pendingObservation = await accumulator.pendingObservations(token.address, owner.address);

            expect(pendingObservation["blockNumber"]).to.equal(0);
            expect(pendingObservation["price"]).to.equal(0);
        }

        async function validateWithinPeriodButOverChangeThreshold(price) {
            const minPeriod = await accumulator.OBSERVATION_BLOCK_MIN_PERIOD();
            const maxPeriod = await accumulator.OBSERVATION_BLOCK_MAX_PERIOD();

            const firstReceipt = await accumulator.stubValidateObservation(token.address, price);

            await hre.timeAndMine.mine(minPeriod.add(1));

            price = price.add(ethers.utils.parseEther("10000"));

            expect(await accumulator.callStatic.stubValidateObservation(token.address, price)).to.equal(false);

            const secondReceipt = await accumulator.stubValidateObservation(token.address, price);

            expect(secondReceipt.blockNumber - firstReceipt.blockNumber).to.be.within(
                minPeriod.toNumber(),
                maxPeriod.toNumber()
            );

            const [owner] = await ethers.getSigners();

            const pendingObservation = await accumulator.pendingObservations(token.address, owner.address);

            expect(pendingObservation["blockNumber"]).to.equal(0);
            expect(pendingObservation["price"]).to.equal(0);
        }

        describe("Should return false and keep the pending observation when delta blocks < min period", async () => {
            tests.forEach(({ price }) => {
                it("price = " + price, async () => {
                    await validateBeforeMinPeriod(price);
                });
            });
        });

        describe("Should return true when delta blocks = min period", async () => {
            tests.forEach(({ price }) => {
                it("price = " + price, async () => {
                    await validateReturnWithinPeriod(price, true);
                });
            });
        });

        describe("Should return true when delta blocks = max period", async () => {
            tests.forEach(({ price }) => {
                it("price = " + price, async () => {
                    await validateReturnWithinPeriod(price, false);
                });
            });
        });

        describe("Should delete the pending observation when delta blocks = min period", async () => {
            tests.forEach(({ price }) => {
                it("price = " + price, async () => {
                    await validateDeletesWithinPeriod(price, true);
                });
            });
        });

        describe("Should delete the pending observation when delta blocks = max period", async () => {
            tests.forEach(({ price }) => {
                it("price = " + price, async () => {
                    await validateDeletesWithinPeriod(price, false);
                });
            });
        });

        describe("Should return false and delete the pending observation when delta blocks > max period", async () => {
            tests.forEach(({ price }) => {
                it("price = " + price, async () => {
                    await validateAfterMaxPeriod(price);
                });
            });
        });

        describe("Should return false and delete the pending observation when change threshold surpassed", async () => {
            tests.forEach(({ price }) => {
                it("initial price = " + price, async () => {
                    await validateWithinPeriodButOverChangeThreshold(price);
                });
            });
        });
    });
});
