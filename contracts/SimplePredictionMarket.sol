// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SimplePredictionMarket
 * @notice Prediction markets for Farcaster cast engagement
 * @dev Moon or Doom - Will it moon or will it doom?
 */
contract SimplePredictionMarket is Ownable, ReentrancyGuard {
    IERC20 public immutable USDC;

    uint256 public constant PROTOCOL_FEE = 100; // 1% (100 basis points)
    uint256 public constant FEE_DENOMINATOR = 10000;

    uint256 public nextMarketId = 1;
    uint256 public totalProtocolFees;

    enum Outcome { UNRESOLVED, MOON, DOOM }

    struct Market {
        uint256 id;
        string castUrl;
        uint256 threshold;
        uint256 deadline;
        uint256 totalMoonBets;
        uint256 totalDoomBets;
        Outcome outcome;
        bool resolved;
        address creator;
    }

    struct UserBet {
        uint256 moonAmount;
        uint256 doomAmount;
        bool claimed;
    }

    // marketId => Market
    mapping(uint256 => Market) public markets;

    // marketId => user => UserBet
    mapping(uint256 => mapping(address => UserBet)) public userBets;

    // Events
    event MarketCreated(
        uint256 indexed marketId,
        string castUrl,
        uint256 threshold,
        uint256 deadline,
        address creator
    );

    event BetPlaced(
        uint256 indexed marketId,
        address indexed user,
        bool isMoon,
        uint256 amount
    );

    event MarketResolved(
        uint256 indexed marketId,
        Outcome outcome,
        uint256 totalPool
    );

    event WinningsClaimed(
        uint256 indexed marketId,
        address indexed user,
        uint256 amount
    );

    event ProtocolFeesWithdrawn(address indexed to, uint256 amount);

    constructor(address _usdc) Ownable(msg.sender) {
        require(_usdc != address(0), "Invalid USDC address");
        USDC = IERC20(_usdc);
    }

    /**
     * @notice Create a new prediction market
     * @param castUrl The Warpcast URL of the cast to predict on
     * @param threshold The engagement threshold (e.g., 100 likes)
     * @param deadline Unix timestamp when market closes
     */
    function createMarket(
        string calldata castUrl,
        uint256 threshold,
        uint256 deadline
    ) external onlyOwner returns (uint256) {
        require(deadline > block.timestamp, "Deadline must be in future");
        require(threshold > 0, "Threshold must be positive");
        require(bytes(castUrl).length > 0, "Cast URL required");

        uint256 marketId = nextMarketId++;

        markets[marketId] = Market({
            id: marketId,
            castUrl: castUrl,
            threshold: threshold,
            deadline: deadline,
            totalMoonBets: 0,
            totalDoomBets: 0,
            outcome: Outcome.UNRESOLVED,
            resolved: false,
            creator: msg.sender
        });

        emit MarketCreated(marketId, castUrl, threshold, deadline, msg.sender);

        return marketId;
    }

    /**
     * @notice Bet that the cast will MOON (exceed threshold)
     * @param marketId The market to bet on
     * @param amount Amount of USDC to bet
     */
    function betMoon(uint256 marketId, uint256 amount) external nonReentrant {
        _placeBet(marketId, amount, true);
    }

    /**
     * @notice Bet that the cast will DOOM (not exceed threshold)
     * @param marketId The market to bet on
     * @param amount Amount of USDC to bet
     */
    function betDoom(uint256 marketId, uint256 amount) external nonReentrant {
        _placeBet(marketId, amount, false);
    }

    /**
     * @notice Internal function to place a bet
     */
    function _placeBet(uint256 marketId, uint256 amount, bool isMoon) internal {
        Market storage market = markets[marketId];
        require(market.id != 0, "Market does not exist");
        require(!market.resolved, "Market already resolved");
        require(block.timestamp < market.deadline, "Market closed");
        require(amount > 0, "Amount must be positive");

        // Transfer USDC from user
        require(
            USDC.transferFrom(msg.sender, address(this), amount),
            "USDC transfer failed"
        );

        // Update market totals
        if (isMoon) {
            market.totalMoonBets += amount;
            userBets[marketId][msg.sender].moonAmount += amount;
        } else {
            market.totalDoomBets += amount;
            userBets[marketId][msg.sender].doomAmount += amount;
        }

        emit BetPlaced(marketId, msg.sender, isMoon, amount);
    }

    /**
     * @notice Resolve a market (owner only for MVP)
     * @param marketId The market to resolve
     * @param outcome The outcome (MOON or DOOM)
     */
    function resolveMarket(uint256 marketId, Outcome outcome) external onlyOwner {
        Market storage market = markets[marketId];
        require(market.id != 0, "Market does not exist");
        require(!market.resolved, "Market already resolved");
        require(block.timestamp >= market.deadline, "Market not yet closed");
        require(outcome == Outcome.MOON || outcome == Outcome.DOOM, "Invalid outcome");

        market.resolved = true;
        market.outcome = outcome;

        uint256 totalPool = market.totalMoonBets + market.totalDoomBets;

        // Calculate protocol fee
        uint256 protocolFee = (totalPool * PROTOCOL_FEE) / FEE_DENOMINATOR;
        totalProtocolFees += protocolFee;

        emit MarketResolved(marketId, outcome, totalPool);
    }

    /**
     * @notice Claim winnings from a resolved market
     * @param marketId The market to claim from
     */
    function claimWinnings(uint256 marketId) external nonReentrant {
        Market storage market = markets[marketId];
        require(market.id != 0, "Market does not exist");
        require(market.resolved, "Market not resolved");

        UserBet storage bet = userBets[marketId][msg.sender];
        require(!bet.claimed, "Already claimed");

        uint256 userWinningBet;
        uint256 totalWinningBets;

        if (market.outcome == Outcome.MOON) {
            userWinningBet = bet.moonAmount;
            totalWinningBets = market.totalMoonBets;
        } else {
            userWinningBet = bet.doomAmount;
            totalWinningBets = market.totalDoomBets;
        }

        require(userWinningBet > 0, "No winning bet");

        bet.claimed = true;

        // Calculate winnings
        uint256 totalPool = market.totalMoonBets + market.totalDoomBets;
        uint256 protocolFee = (totalPool * PROTOCOL_FEE) / FEE_DENOMINATOR;
        uint256 prizePool = totalPool - protocolFee;

        // User's share of prize pool proportional to their winning bet
        uint256 winnings = (prizePool * userWinningBet) / totalWinningBets;

        require(
            USDC.transfer(msg.sender, winnings),
            "USDC transfer failed"
        );

        emit WinningsClaimed(marketId, msg.sender, winnings);
    }

    /**
     * @notice Withdraw accumulated protocol fees
     * @param to Address to send fees to
     */
    function withdrawProtocolFees(address to) external onlyOwner {
        require(to != address(0), "Invalid address");
        uint256 amount = totalProtocolFees;
        require(amount > 0, "No fees to withdraw");

        totalProtocolFees = 0;

        require(
            USDC.transfer(to, amount),
            "USDC transfer failed"
        );

        emit ProtocolFeesWithdrawn(to, amount);
    }

    /**
     * @notice Get market details
     */
    function getMarket(uint256 marketId) external view returns (Market memory) {
        return markets[marketId];
    }

    /**
     * @notice Get user's bet for a market
     */
    function getUserBet(uint256 marketId, address user) external view returns (UserBet memory) {
        return userBets[marketId][user];
    }

    /**
     * @notice Calculate current odds for MOON
     * @return moonOdds Percentage odds for MOON (0-10000, where 10000 = 100%)
     */
    function getMoonOdds(uint256 marketId) external view returns (uint256 moonOdds) {
        Market storage market = markets[marketId];
        uint256 totalBets = market.totalMoonBets + market.totalDoomBets;

        if (totalBets == 0) {
            return 5000; // 50% if no bets yet
        }

        moonOdds = (market.totalMoonBets * 10000) / totalBets;
    }

    /**
     * @notice Calculate potential winnings for a bet
     * @param marketId The market
     * @param amount Bet amount
     * @param isMoon Whether betting on MOON
     * @return potentialWinnings Maximum potential winnings
     */
    function calculatePotentialWinnings(
        uint256 marketId,
        uint256 amount,
        bool isMoon
    ) external view returns (uint256 potentialWinnings) {
        Market storage market = markets[marketId];

        uint256 totalMoonBets = market.totalMoonBets;
        uint256 totalDoomBets = market.totalDoomBets;

        // Add user's bet to relevant side
        if (isMoon) {
            totalMoonBets += amount;
        } else {
            totalDoomBets += amount;
        }

        uint256 totalPool = totalMoonBets + totalDoomBets;
        uint256 protocolFee = (totalPool * PROTOCOL_FEE) / FEE_DENOMINATOR;
        uint256 prizePool = totalPool - protocolFee;

        uint256 winningBets = isMoon ? totalMoonBets : totalDoomBets;

        if (winningBets == 0) return 0;

        potentialWinnings = (prizePool * amount) / winningBets;
    }
}
