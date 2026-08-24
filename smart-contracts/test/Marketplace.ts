import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("Marketplace", function () {
  async function deployMarketplace() {
    const [owner, seller, buyer, other] = await ethers.getSigners();
    const token = await ethers.deployContract("EnergyToken", [owner.address]);
    const marketplace = await ethers.deployContract("Marketplace", [token.target]);

    await token.mint(seller.address, 10n);
    await token.connect(seller).approve(marketplace.target, 10n);

    return { owner, seller, buyer, other, token, marketplace };
  }

  it("escrows energy when creating a sell order", async function () {
    const { seller, token, marketplace } = await deployMarketplace();

    await expect(marketplace.connect(seller).createSellOrder(4n, 100n))
      .to.emit(marketplace, "SellOrderCreated")
      .withArgs(1n, seller.address, 4n, 100n, (value: bigint) => value > 0n);

    const order = await marketplace.getOrder(1n);
    expect(order.seller).to.equal(seller.address);
    expect(order.quantity).to.equal(4n);
    expect(order.price).to.equal(100n);
    expect(order.active).to.equal(true);
    expect(await token.balanceOf(seller.address)).to.equal(6n);
    expect(await token.balanceOf(marketplace.target)).to.equal(4n);
  });

  it("rejects empty orders", async function () {
    const { seller, marketplace } = await deployMarketplace();

    await expect(marketplace.connect(seller).createSellOrder(0n, 100n))
      .to.be.revertedWith("Quantity must be greater than zero");
    await expect(marketplace.connect(seller).createSellOrder(1n, 0n))
      .to.be.revertedWith("Price must be greater than zero");
  });

  it("settles an order for exact ETH payment", async function () {
    const { seller, buyer, token, marketplace } = await deployMarketplace();
    await marketplace.connect(seller).createSellOrder(4n, 100n);

    await expect(marketplace.connect(buyer).buyEnergy(1n, { value: 100n }))
      .to.emit(marketplace, "EnergyPurchased")
      .withArgs(1n, buyer.address, seller.address, 4n, 100n);

    const order = await marketplace.getOrder(1n);
    expect(order.active).to.equal(false);
    expect(await token.balanceOf(buyer.address)).to.equal(4n);
    expect(await token.balanceOf(marketplace.target)).to.equal(0n);
    expect(await ethers.provider.getBalance(marketplace.target)).to.equal(0n);

    await expect(marketplace.connect(buyer).buyEnergy(1n, { value: 100n }))
      .to.be.revertedWith("Order is not active");
  });

  it("allows only the seller to cancel and refunds escrow", async function () {
    const { seller, buyer, token, marketplace } = await deployMarketplace();
    await marketplace.connect(seller).createSellOrder(4n, 100n);

    await expect(marketplace.connect(buyer).cancelOrder(1n))
      .to.be.revertedWith("Only seller can cancel");

    await expect(marketplace.connect(seller).cancelOrder(1n))
      .to.emit(marketplace, "SellOrderCancelled")
      .withArgs(1n, seller.address);

    expect(await token.balanceOf(seller.address)).to.equal(10n);
    expect((await marketplace.getOrder(1n)).active).to.equal(false);
  });
});