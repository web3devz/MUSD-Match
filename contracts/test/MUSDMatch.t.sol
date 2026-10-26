// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
import {MUSDMatch} from "../src/MUSDMatch.sol";

interface Vm {
    function addr(uint256 key) external returns(address);
    function sign(uint256 key, bytes32 digest) external returns(uint8, bytes32, bytes32);
    function prank(address sender) external;
    function deal(address who, uint256 value) external;
    function warp(uint256 time) external;
    function chainId(uint256 id) external;
    function etch(address target, bytes calldata code) external;
    function expectRevert(bytes4 reason) external;
    function expectRevert() external;
}
contract Token {
    mapping(address=>uint256) public balanceOf;
    mapping(address=>mapping(address=>uint256)) public allowance;
    bool public fee;
    bool public fail;
    function mint(address to,uint256 value) external {balanceOf[to]+=value;}
    function approve(address spender,uint256 value) external returns(bool){allowance[msg.sender][spender]=value;return true;}
    function setFee(bool v) external {fee=v;}
    function setFail(bool v) external {fail=v;}
    function transferFrom(address from,address to,uint256 value) external returns(bool){
        if(fail)return false;
        allowance[from][msg.sender]-=value;
        balanceOf[from]-=value;
        balanceOf[to]+=fee?value-1:value;
        return true;
    }
}
contract ContractMaker {
    bool public rejectPayment;
    bool public reenter;
    MUSDMatch public matchContract;
    bytes32 public approvedDigest;
    constructor(MUSDMatch m){matchContract=m;}
    function approveToken(Token t,uint256 value) external {t.approve(address(matchContract),value);}
    function approveDigest(bytes32 h) external {approvedDigest=h;}
    function configure(bool reject_,bool reenter_) external {rejectPayment=reject_;reenter=reenter_;}
    function isValidSignature(bytes32 h,bytes calldata) external view returns(bytes4){return h==approvedDigest?bytes4(0x1626ba7e):bytes4(0xffffffff);}
    receive() external payable {
        require(!rejectPayment,"no BTC");
        if(reenter){MUSDMatch.Offer memory empty;try matchContract.fill(empty,""){revert("reentry allowed");}catch{}}
    }
}
contract MUSDMatchTest {
    Vm constant vm=Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    Token token;
    MUSDMatch exchange;
    address maker;
    address buyer=address(0xB0B);
    uint256 constant KEY=0xA11CE;
    MUSDMatch.Offer offer;
    function setUp() public {
        token=new Token();exchange=new MUSDMatch(address(token));maker=vm.addr(KEY);
        token.mint(maker,10000 ether);vm.prank(maker);token.approve(address(exchange),10000 ether);
        vm.deal(buyer,10 ether);
        offer=MUSDMatch.Offer(maker,address(0),1000 ether,.01 ether,block.timestamp+3600,42);
    }
    function signature(MUSDMatch.Offer memory o) internal returns(bytes memory){(uint8 v,bytes32 r,bytes32 s)=vm.sign(KEY,exchange.hashOffer(o));return abi.encodePacked(r,s,v);}
    function buy(MUSDMatch.Offer memory o,bytes memory sig) internal {vm.prank(buyer);exchange.fill{value:o.btcAmount}(o,sig);}
    function testAtomicSettlement() public {bytes memory sig=signature(offer);buy(offer,sig);require(token.balanceOf(buyer)==1000 ether);require(token.balanceOf(maker)==9000 ether);require(maker.balance==.01 ether);require(address(exchange).balance==0);require(exchange.nonceUsed(maker,42));}
    function testReplayRejected() public {bytes memory sig=signature(offer);buy(offer,sig);vm.expectRevert(MUSDMatch.NonceUnavailable.selector);buy(offer,sig);}
    function testMakerCancellation() public {bytes memory sig=signature(offer);vm.prank(maker);exchange.cancel(42);vm.expectRevert(MUSDMatch.NonceUnavailable.selector);buy(offer,sig);}
    function testOtherWalletCannotCancelMaker() public {vm.prank(buyer);exchange.cancel(42);buy(offer,signature(offer));}
    function testSharedNonceInvalidatesOtherTerms() public {bytes memory sig=signature(offer);MUSDMatch.Offer memory other=offer;other.musdAmount=500 ether;bytes memory otherSig=signature(other);buy(offer,sig);vm.expectRevert(MUSDMatch.NonceUnavailable.selector);buy(other,otherSig);}
    function testExpiryBoundary() public {bytes memory sig=signature(offer);vm.warp(offer.expiry);vm.expectRevert(MUSDMatch.Expired.selector);buy(offer,sig);}
    function testTamperedPriceRejected() public {bytes memory sig=signature(offer);offer.btcAmount=1;vm.expectRevert(MUSDMatch.InvalidSignature.selector);buy(offer,sig);}
    function testTamperedMakerRejected() public {bytes memory sig=signature(offer);offer.maker=address(0xCAFE);vm.expectRevert(MUSDMatch.InvalidSignature.selector);buy(offer,sig);}
    function testWrongTaker() public {offer.taker=address(0xBAD);bytes memory sig=signature(offer);vm.expectRevert(MUSDMatch.WrongTaker.selector);buy(offer,sig);}
    function testRestrictedTakerCanFill() public {offer.taker=buyer;buy(offer,signature(offer));require(token.balanceOf(buyer)==offer.musdAmount);}
    function testExactNativeValue() public {bytes memory sig=signature(offer);vm.expectRevert(MUSDMatch.WrongValue.selector);vm.prank(buyer);exchange.fill{value:offer.btcAmount+1}(offer,sig);}
    function testInsufficientAllowanceRollsBack() public {bytes memory sig=signature(offer);vm.prank(maker);token.approve(address(exchange),0);vm.expectRevert(MUSDMatch.TokenTransferFailed.selector);buy(offer,sig);require(!exchange.nonceUsed(maker,42));require(maker.balance==0);}
    function testInsufficientBalanceRollsBack() public {offer.musdAmount=20000 ether;bytes memory sig=signature(offer);vm.expectRevert(MUSDMatch.TokenTransferFailed.selector);buy(offer,sig);require(!exchange.nonceUsed(maker,42));}
    function testFeeTokenRejected() public {token.setFee(true);bytes memory sig=signature(offer);vm.expectRevert(MUSDMatch.InexactTransfer.selector);buy(offer,sig);require(token.balanceOf(buyer)==0);require(!exchange.nonceUsed(maker,42));}
    function testFalseTokenRejected() public {token.setFail(true);bytes memory sig=signature(offer);vm.expectRevert(MUSDMatch.TokenTransferFailed.selector);buy(offer,sig);}
    function testCrossChainReplayRejected() public {bytes memory sig=signature(offer);vm.chainId(block.chainid+1);vm.expectRevert(MUSDMatch.InvalidSignature.selector);buy(offer,sig);}
    function testViemEip712DigestFixture() public {
        address fixedSettlement=address(0x1111111111111111111111111111111111111111);
        vm.etch(fixedSettlement,address(exchange).code);
        vm.chainId(31611);
        MUSDMatch.Offer memory fixedOffer=MUSDMatch.Offer(
            address(0x2222222222222222222222222222222222222222),address(0),1000 ether,.01 ether,2000000000,42
        );
        require(MUSDMatch(fixedSettlement).hashOffer(fixedOffer)==0xa753a3c6f3e0c093791ceffbae07d22a1cc225c72a1f36c2c70fd74e67b9a348);
    }
    function testCrossContractReplayRejected() public {bytes memory sig=signature(offer);MUSDMatch other=new MUSDMatch(address(token));vm.expectRevert(MUSDMatch.InvalidSignature.selector);vm.prank(buyer);other.fill{value:offer.btcAmount}(offer,sig);}
    function testMalformedSignatureRejected() public {vm.expectRevert(MUSDMatch.InvalidSignature.selector);buy(offer,hex"1234");}
    function testInvalidVRejected() public {bytes memory sig=signature(offer);sig[64]=bytes1(uint8(1));vm.expectRevert(MUSDMatch.InvalidSignature.selector);buy(offer,sig);}
    function testHighSRejected() public {bytes memory sig=signature(offer);for(uint256 i=32;i<64;i++)sig[i]=0xff;vm.expectRevert(MUSDMatch.InvalidSignature.selector);buy(offer,sig);}
    function testZeroAmountRejected() public {offer.musdAmount=0;bytes memory sig=signature(offer);vm.expectRevert(MUSDMatch.InvalidOffer.selector);buy(offer,sig);}
    function testSelfTradeRejected() public {offer.maker=buyer;vm.expectRevert(MUSDMatch.InvalidOffer.selector);buy(offer,hex"00");}
    function contractOffer() internal returns(ContractMaker m){m=new ContractMaker(exchange);token.mint(address(m),1000 ether);m.approveToken(token,1000 ether);offer.maker=address(m);m.approveDigest(exchange.hashOffer(offer));}
    function testERC1271Maker() public {ContractMaker m=contractOffer();buy(offer,hex"00");require(address(m).balance==offer.btcAmount);require(token.balanceOf(buyer)==offer.musdAmount);}
    function testERC1271WrongDigest() public {ContractMaker m=contractOffer();m.approveDigest(bytes32(0));vm.expectRevert(MUSDMatch.InvalidSignature.selector);buy(offer,hex"00");}
    function testRejectedBTCRevertsTokenLeg() public {ContractMaker m=contractOffer();m.configure(true,false);vm.expectRevert(MUSDMatch.NativeTransferFailed.selector);buy(offer,hex"00");require(token.balanceOf(buyer)==0);require(token.balanceOf(address(m))==1000 ether);require(!exchange.nonceUsed(address(m),42));}
    function testMakerReentryCannotFill() public {ContractMaker m=contractOffer();m.configure(false,true);buy(offer,hex"00");require(token.balanceOf(buyer)==1000 ether);}
    function testFuzzExactConservation(uint128 value,uint128 btc) public {if(value==0||btc==0)return;offer.musdAmount=value;offer.btcAmount=btc;token.mint(maker,value);vm.prank(maker);token.approve(address(exchange),value);vm.deal(buyer,btc);uint256 before=token.balanceOf(maker);buy(offer,signature(offer));require(token.balanceOf(maker)==before-value);require(token.balanceOf(buyer)==value);require(maker.balance==btc);require(address(exchange).balance==0);}
}
