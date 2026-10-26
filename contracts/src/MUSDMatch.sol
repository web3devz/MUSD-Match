// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @notice Full-fill MUSD offers for native BTC. No deposits, admin, fees or upgrades.
/// @dev A maker nonce identifies one settlement slot: filling or cancelling invalidates all offers using it.
contract MUSDMatch {
    struct Offer {
        address maker;
        address taker; // zero permits any taker
        uint256 musdAmount;
        uint256 btcAmount;
        uint256 expiry;
        uint256 nonce;
    }

    bytes32 public constant OFFER_TYPEHASH = keccak256(
        "Offer(address maker,address taker,uint256 musdAmount,uint256 btcAmount,uint256 expiry,uint256 nonce)"
    );
    bytes32 private constant DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );
    uint256 private constant HALF_ORDER = 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0;
    bytes4 private constant MAGIC = 0x1626ba7e;
    IERC20 public immutable musd;
    mapping(address => mapping(uint256 => bool)) public nonceUsed;
    uint256 private entered;

    error InvalidToken();
    error InvalidOffer();
    error Expired();
    error NonceUnavailable();
    error WrongTaker();
    error WrongValue();
    error InvalidSignature();
    error TokenTransferFailed();
    error InexactTransfer();
    error NativeTransferFailed();
    error ReentrantCall();

    event Filled(bytes32 indexed digest, address indexed maker, address indexed taker, uint256 nonce, uint256 musdAmount, uint256 btcAmount);
    event Cancelled(address indexed maker, uint256 indexed nonce);

    constructor(address token) {
        if (token == address(0) || token.code.length == 0) revert InvalidToken();
        musd = IERC20(token);
    }

    modifier nonReentrant() {
        if (entered != 0) revert ReentrantCall();
        entered = 1;
        _;
        entered = 0;
    }

    function domainSeparator() public view returns (bytes32) {
        return keccak256(abi.encode(DOMAIN_TYPEHASH, keccak256("MUSD Match"), keccak256("1"), block.chainid, address(this)));
    }

    function hashOffer(Offer calldata offer) public view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator(), keccak256(abi.encode(
            OFFER_TYPEHASH, offer.maker, offer.taker, offer.musdAmount, offer.btcAmount, offer.expiry, offer.nonce
        ))));
    }

    function isValidSignature(Offer calldata offer, bytes calldata signature) public view returns (bool) {
        bytes32 digest = hashOffer(offer);
        if (offer.maker.code.length > 0) {
            (bool ok, bytes memory result) = offer.maker.staticcall(abi.encodeWithSelector(MAGIC, digest, signature));
            return ok && result.length >= 32 && abi.decode(result, (bytes4)) == MAGIC;
        }
        if (signature.length != 65) return false;
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        if (uint256(s) > HALF_ORDER || (v != 27 && v != 28)) return false;
        address recovered = ecrecover(digest, v, r, s);
        return recovered != address(0) && recovered == offer.maker;
    }

    function cancel(uint256 nonce) external {
        if (nonceUsed[msg.sender][nonce]) revert NonceUnavailable();
        nonceUsed[msg.sender][nonce] = true;
        emit Cancelled(msg.sender, nonce);
    }

    function fill(Offer calldata offer, bytes calldata signature) external payable nonReentrant {
        if (offer.maker == address(0) || offer.maker == msg.sender || offer.musdAmount == 0 || offer.btcAmount == 0) revert InvalidOffer();
        if (block.timestamp >= offer.expiry) revert Expired();
        if (nonceUsed[offer.maker][offer.nonce]) revert NonceUnavailable();
        if (offer.taker != address(0) && offer.taker != msg.sender) revert WrongTaker();
        if (msg.value != offer.btcAmount) revert WrongValue();
        if (!isValidSignature(offer, signature)) revert InvalidSignature();

        nonceUsed[offer.maker][offer.nonce] = true;
        uint256 makerBefore = musd.balanceOf(offer.maker);
        uint256 takerBefore = musd.balanceOf(msg.sender);
        (bool ok, bytes memory result) = address(musd).call(abi.encodeCall(IERC20.transferFrom, (offer.maker, msg.sender, offer.musdAmount)));
        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) revert TokenTransferFailed();
        uint256 makerAfter = musd.balanceOf(offer.maker);
        uint256 takerAfter = musd.balanceOf(msg.sender);
        if (makerAfter > makerBefore || makerBefore - makerAfter != offer.musdAmount || takerAfter < takerBefore || takerAfter - takerBefore != offer.musdAmount) revert InexactTransfer();
        (bool paid,) = payable(offer.maker).call{value: msg.value}("");
        if (!paid) revert NativeTransferFailed();
        emit Filled(hashOffer(offer), offer.maker, msg.sender, offer.nonce, offer.musdAmount, offer.btcAmount);
    }
}
