import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("EnergyToken", function () {
  it("uses whole kWh units and restricts minting and burning to the owner", async function () {
    const [owner, producer, other] = await ethers.getSigners();
    const token = await ethers.deployContract("EnergyToken", [owner.address]);

    expect(await token.name()).to.equal("Energy Token");
    expect(await token.symbol()).to.equal("ENRG");
    expect(await token.decimals()).to.equal(0);

    await expect(token.mint(producer.address, 10n))
      .to.emit(token, "Transfer")
      .withArgs(ethers.ZeroAddress, producer.address, 10n);
    expect(await token.balanceOf(producer.address)).to.equal(10n);

    await expect(token.connect(other).mint(other.address, 1n))
      .to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount")
      .withArgs(other.address);

    await expect(token.burn(producer.address, 4n))
      .to.emit(token, "Transfer")
      .withArgs(producer.address, ethers.ZeroAddress, 4n);
    expect(await token.balanceOf(producer.address)).to.equal(6n);

    await expect(token.connect(other).burn(producer.address, 1n))
      .to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount")
      .withArgs(other.address);
  });

  it("supports standard transfers and allowances", async function () {
    const [owner, producer, buyer] = await ethers.getSigners();
    const token = await ethers.deployContract("EnergyToken", [owner.address]);

    await token.mint(producer.address, 10n);
    await token.connect(producer).approve(buyer.address, 3n);
    await token.connect(buyer).transferFrom(producer.address, buyer.address, 3n);

    expect(await token.balanceOf(producer.address)).to.equal(7n);
    expect(await token.balanceOf(buyer.address)).to.equal(3n);
  });
});