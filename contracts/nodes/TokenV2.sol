//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
import "../Uniswap/IUniswapV2Factory.sol";
import "../Uniswap/IUniswapV2Pair.sol";
import "../Uniswap/IUniswapV2Router02.sol";
import '../common/Address.sol';
// import '../common/SafeMath.sol';
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "./RouterLibrary.sol";
import "hardhat/console.sol";

interface INodeManager {
    function feeManager() external view returns(address);
    function countOfUser(address account) external view returns(uint32);
}

contract PowToken is ERC20Upgradeable {
    // using SafeMath for uint256;
    function initialize() public initializer {
        __ERC20_init("Pow Token", "POW");
        
        owner = msg.sender;
        operator = msg.sender;
        transferTaxRate = 0;    // 0%
        buyBackFee = 500;       // 5%
        sellBackFee = 500;      // 5%
        operatorFee = 100;      // 100%
        liquidityFee = 0;
        minAmountToLiquify = 10 ether;
        maxTransferAmount = 500 ether;
        maxWalletAmount = 0;
        checkNodeBeforeSell = true;       

        minted = false; 
    }

    receive() external payable {}

    bool private _inSwapAndLiquify;
    uint32 public transferTaxRate;
    uint32 private buyBackFee;
    uint32 private sellBackFee;
    uint32 public operatorFee;
    uint32 public liquidityFee;
    
    uint256 private minAmountToLiquify;
    
    address public owner;
    address public operator;
    mapping(address => bool) public isExcludedFromFee;
    
    address public router;
    address public pair;
    uint256 public maxTransferAmount; // 1000
    uint256 private accumulatedOperatorTokensAmount;
    address public nodeManagerAddress;
    bool public checkNodeBeforeSell;
    uint256 public maxWalletAmount;
    bool private minted;

    mapping (address=>bool) blacklist;
    
    uint32 public constant PRICE_PERIOD = 24 hours;
    uint32 private priceTimestampLast;
    uint256 private priceCumulativeLast;
    uint256 public priceAverage;

    string private chainSymbol;

    event SwapAndLiquify(uint256, uint256, uint256);
    event uniswapV2RouterUpdated(address, address, address);
    event LiquidityAdded(uint256, uint256);

    modifier onlyOwner() {
        require(owner == msg.sender, "Ownable: caller is not the owner");
        _;
    }
    
    modifier lockTheSwap {
        _inSwapAndLiquify = true;
        _;
        _inSwapAndLiquify = false;
    }

    modifier transferTaxFree {
        uint32 _transferTaxRate = transferTaxRate;
        transferTaxRate = 0;
        _;
        transferTaxRate = _transferTaxRate;
    }

    function transferOwnership(address account) public onlyOwner {
        removeExcludedFromFee(owner);
        setExcludedFromFee(account);
        if(!minted) {
            _mint(account, 1000000 ether);
            minted = true;
        }
        owner = account;
    }

    function setTransferTaxRate(uint32 _transferTaxRate) public onlyOwner{
        transferTaxRate = _transferTaxRate;
    }

    function buyFee() public view returns (uint32) {
        return buyBackFee;
    }

    function setBuyFee(uint32 value) public onlyOwner{
        buyBackFee = value;
    }

    function sellFee() public view returns (uint32) {
        return sellBackFee;
    }

    function setSellFee(uint32 value) public onlyOwner{
        sellBackFee = value;
    }

    function setOperator(address account) public onlyOwner {
        operator = account;
    }

    function setOperatorFee(uint32 value) public onlyOwner{
        operatorFee = value;
        liquidityFee = 100 - operatorFee;
    }

    function setLiquidityFee(uint32 value) public onlyOwner {
        liquidityFee = value;
        operatorFee = 100 - liquidityFee;
    }

    function setExcludedFromFee(address account) public onlyOwner{
        isExcludedFromFee[account] = true;
    }

    function removeExcludedFromFee(address account) public onlyOwner{
        isExcludedFromFee[account] = false;
    }

    function setMinAmountToLiquify(uint256 value) public onlyOwner{
        minAmountToLiquify = value;
    }

    function setMaxTransferAmount(uint256 value) public onlyOwner{
        maxTransferAmount = value;
    }

    function setMaxWalletAmount(uint256 value) public onlyOwner{
        maxWalletAmount = value;
    }

    function setNodeManagerAddress(address _nodeManagerAddress) public onlyOwner {
        nodeManagerAddress = _nodeManagerAddress;
    }

    function setCheckNodeBeforeSell(bool check) public onlyOwner {
        checkNodeBeforeSell = check;
    }

    function _update() private {
        if(address(router)!=address(0)) {
            if(address(pair)!=address(0)) {
                // pair.sync();
                uint256 priceCumulative = RouterLibrary.price0CumulativeLast(pair);
                (uint256 reserve0,uint256 reserve1,uint32 reserveTimestamp) = RouterLibrary.getReserves(pair);
                if(RouterLibrary.token1(pair)==address(this)) {
                    priceCumulative = RouterLibrary.price1CumulativeLast(pair);
                    (reserve0, reserve1) = (reserve1, reserve0);
                }
                if(priceTimestampLast==0)  {
                    priceAverage = (reserve1 << 112) / reserve0;
                    priceCumulativeLast = priceCumulative;
                    priceTimestampLast = reserveTimestamp;
                } else {
                    uint32 timeElapsed = reserveTimestamp - priceTimestampLast;
                    if(timeElapsed >= PRICE_PERIOD && priceCumulative > priceCumulativeLast) {
                        priceAverage = (priceCumulative - priceCumulativeLast) / timeElapsed;
                        priceCumulativeLast = priceCumulative;
                        priceTimestampLast = reserveTimestamp;
                    }
                }
            }
        }
    }

    /// @dev overrides transfer function to meet tokenomics
    function _transfer(address from, address to, uint256 amount) internal virtual override {
        require(!blacklist[from], "stop");
        bool _isSwappable = router!=address(0) && pair!=address(0);
        bool _isBuying = _isSwappable && msg.sender==pair && from==pair;
        bool _isSelling = _isSwappable /*&& msg.sender==router*/ && to==pair;  
        uint256 _amount = amount;
                
        if (!isExcludedFromFee[from] && !isExcludedFromFee[to]) {
            uint256 taxAmount = 0;
            if(_isSelling && checkNodeBeforeSell && nodeManagerAddress != address(0) && !_inSwapAndLiquify) {
                INodeManager mgr = INodeManager(nodeManagerAddress);
                require(address(mgr.feeManager())==from || mgr.countOfUser(from) > 0, "Insufficient Node count!");
            }                    
            if(_isSelling && sellBackFee>0) {
                taxAmount = amount * sellBackFee / 10000;
            } else if(_isBuying && buyBackFee>0) {
                taxAmount = amount * buyBackFee / 10000;
            } else if(transferTaxRate > 0) {
                taxAmount = amount * transferTaxRate / 10000;
            }
            
            if(taxAmount>0) {
                super._transfer(from, address(this), taxAmount);
                accumulatedOperatorTokensAmount += taxAmount * operatorFee / 100;
                if(_isSelling && !_inSwapAndLiquify) {
                    swapAndSendToAddress(operator,accumulatedOperatorTokensAmount);
                    accumulatedOperatorTokensAmount = 0;
                }
                _amount -= taxAmount;
                // uint256 liquidityAmount = taxAmount * liquidityFee / 100;
                // _amount = amount - operatorFeeAmount - liquidityAmount;
            }  
        }
        // swap and liquify
        if (_isSwappable && !_inSwapAndLiquify && /*!_isSelling &&*/ !_isBuying && from != owner) {
            swapAndLiquify();
        }

        // antiwhale
        if(!isExcludedFromFee[from] && maxTransferAmount > 0) {
            require(amount <= maxTransferAmount, 'Anti whale' );
        }

        if(maxWalletAmount > 0 && !_isSelling && !isExcludedFromFee[to] && to!=address(this) && from!=owner) {
            require(balanceOf(to) + _amount <= maxWalletAmount, 'Overflow maxWallet amount');
        }  
        super._transfer(from, to, _amount);
        _update();
    }

    function swapAndSendToAddress(address destination, uint256 tokens) private lockTheSwap transferTaxFree{
        uint256 initialETHBalance = address(this).balance;
        swapTokensForEth(tokens);
        uint256 newBalance = address(this).balance - initialETHBalance;
        payable(destination).transfer(newBalance);
    }

    function swapAndLiquify() private lockTheSwap transferTaxFree {
        uint256 contractTokenBalance = balanceOf(address(this));
        if(contractTokenBalance >= accumulatedOperatorTokensAmount) {
            contractTokenBalance -= accumulatedOperatorTokensAmount;
            if (contractTokenBalance >= minAmountToLiquify) {
                uint256 liquifyAmount = contractTokenBalance;
                uint256 half = liquifyAmount / 2;
                uint256 otherHalf = liquifyAmount - half;

                uint256 initialBalance = address(this).balance;
                swapTokensForEth(half);
                uint256 newBalance = address(this).balance - initialBalance;
                addLiquidity(otherHalf, newBalance);
                
                emit SwapAndLiquify(half, newBalance, otherHalf);
            }
        }
    }

    function swapTokensForEth(uint256 tokenAmount) private {
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = RouterLibrary.WETH(router,ETH());
        _approve(address(this), router, tokenAmount);
        RouterLibrary.swapExactTokensForETHSupportingFeeOnTransferTokens(
            router,
            ETH(),
            tokenAmount,
            0, // accept any amount of ETH
            path,
            address(this),
            block.timestamp
        );
    }

    function getAmountOut(uint256 _amount) public view returns (uint256) {
        if(router==address(0)) return 0;
        uint32 timeElapsed = uint32(block.timestamp) - priceTimestampLast;
        if(timeElapsed > 0) {
            uint256 priceCumulative = RouterLibrary.token0(pair)==address(this) ? RouterLibrary.price0CumulativeLast(pair) : RouterLibrary.price1CumulativeLast(pair);
            (uint256 reserve0, uint256 reserve1, uint32 reservedTimestamp) = RouterLibrary.getReserves(pair);
            if(RouterLibrary.token1(pair)==address(this))
                (reserve0, reserve1) = (reserve1, reserve0);
            priceCumulative += (reserve1 << 112) * (block.timestamp - reservedTimestamp) / reserve0;
            uint256 priceAverageExtra = 0;
            if(priceAverage > 0)
                priceAverageExtra = (priceAverage * PRICE_PERIOD + priceCumulative - priceCumulativeLast) / (PRICE_PERIOD + timeElapsed);
            else
                priceAverageExtra = (priceCumulative - priceCumulativeLast) / timeElapsed;
            return (priceAverageExtra * _amount) >> 112;
        }
        return (priceAverage * _amount) >> 112;
    }

    function getPriceInfo() public view returns (uint256, uint32) {
        return (priceCumulativeLast, priceTimestampLast);
    }

    /// @dev Add liquidity
    function addLiquidity(uint256 tokenAmount, uint256 ethAmount) private {
        // approve token transfer to cover all possible scenarios
        _approve(address(this), router, tokenAmount);

        // add the liquidity
        RouterLibrary.addLiquidityETH(
            router,
            ETH(),
            address(this),
            tokenAmount,
            0, // slippage is unavoidable
            0, // slippage is unavoidable
            owner,
            block.timestamp,
            ethAmount
        );
        emit LiquidityAdded(tokenAmount, ethAmount);
    }

    function ETH() public view returns (string memory) {
        if(bytes(chainSymbol).length!=0) return chainSymbol;
        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        if(chainId==4002) return 'FTM';
        if(chainId==43113) return 'AVAX';
        return 'ETH';
    }

    /**
     * @dev Update the swap router.
     * Can only be called by the current operator.
     */
    function updateRouter(address _router) public onlyOwner {
        router = _router;
        pair = RouterLibrary.getETHPair(_router, ETH(), address(this));
        require(pair != address(0), "Token::updateRouter: Invalid pair address.");
        _update();
        emit uniswapV2RouterUpdated(msg.sender, router, pair);
    }

    function claimTokens(address teamWallet) public onlyOwner {
        payable(teamWallet).transfer(address(this).balance);
    }
    
    function claimOtherTokens(address anyToken, address recipient) external onlyOwner() {
        IERC20(anyToken).transfer(recipient, IERC20(anyToken).balanceOf(address(this)));
    }
    
    function clearStuckBalance(address payable account) external onlyOwner() {
        account.transfer(address(this).balance);
    }

    function addBlacklist(address _account) public onlyOwner {
        blacklist[_account] = true;
    }
    
    function removeBlacklist(address _account) public onlyOwner {
        blacklist[_account] = false;
    }
}