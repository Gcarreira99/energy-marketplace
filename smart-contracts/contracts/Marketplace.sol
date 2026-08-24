// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Marketplace is ReentrancyGuard {
    struct SellOrder {
        address seller;
        uint256 quantity;
        uint256 price;
        uint256 timestamp;
        bool active;
    }

    IERC20 public immutable energyToken;
    uint256 public nextOrderId = 1;
    mapping(uint256 orderId => SellOrder order) public sellOrders;

    event SellOrderCreated(
        uint256 indexed orderId,
        address indexed seller,
        uint256 quantity,
        uint256 price,
        uint256 timestamp
    );
    event EnergyPurchased(
        uint256 indexed orderId,
        address indexed buyer,
        address indexed seller,
        uint256 quantity,
        uint256 price
    );
    event SellOrderCancelled(uint256 indexed orderId, address indexed seller);

    constructor(IERC20 energyTokenAddress) {
        require(address(energyTokenAddress) != address(0), "Invalid token address");
        energyToken = energyTokenAddress;
    }

    function createSellOrder(uint256 quantity, uint256 price)
        external
        nonReentrant
        returns (uint256 orderId)
    {
        require(quantity > 0, "Quantity must be greater than zero");
        require(price > 0, "Price must be greater than zero");

        require(
            energyToken.transferFrom(msg.sender, address(this), quantity),
            "Token escrow failed"
        );

        orderId = nextOrderId++;
        uint256 timestamp = block.timestamp;
        sellOrders[orderId] = SellOrder({
            seller: msg.sender,
            quantity: quantity,
            price: price,
            timestamp: timestamp,
            active: true
        });

        emit SellOrderCreated(orderId, msg.sender, quantity, price, timestamp);
    }

    function buyEnergy(uint256 orderId) external payable nonReentrant {
        SellOrder storage order = sellOrders[orderId];
        require(order.active, "Order is not active");
        require(msg.value == order.price, "Incorrect payment");

        order.active = false;

        require(energyToken.transfer(msg.sender, order.quantity), "Token transfer failed");

        (bool paymentSent, ) = payable(order.seller).call{value: msg.value}("");
        require(paymentSent, "Payment failed");

        emit EnergyPurchased(
            orderId,
            msg.sender,
            order.seller,
            order.quantity,
            order.price
        );
    }

    function cancelOrder(uint256 orderId) external nonReentrant {
        SellOrder storage order = sellOrders[orderId];
        require(order.active, "Order is not active");
        require(order.seller == msg.sender, "Only seller can cancel");

        order.active = false;
        require(energyToken.transfer(order.seller, order.quantity), "Token refund failed");

        emit SellOrderCancelled(orderId, order.seller);
    }

    function getOrder(uint256 orderId) external view returns (SellOrder memory) {
        return sellOrders[orderId];
    }
}