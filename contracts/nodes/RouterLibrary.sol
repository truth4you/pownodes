//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

library RouterLibrary {
    function WETH(address _router, string memory _eth) internal view returns (address) {
        bytes4 _method = bytes4(keccak256(abi.encodePacked('W',_eth,'()')));
        (bool success, bytes memory data) = _router.staticcall(abi.encodeWithSelector(_method));
        if(success)
            return abi.decode(data, (address));
        return address(0);
    }
    function price0CumulativeLast(address _pair) internal view returns (uint256) {
        bytes4 _method = bytes4(keccak256(bytes('price0CumulativeLast()')));
        (bool success, bytes memory data) = _pair.staticcall(abi.encodeWithSelector(_method));
        if(success)
            return abi.decode(data, (uint256));
        return 0;
    }
    function price1CumulativeLast(address _pair) internal view returns (uint256) {
        bytes4 _method = bytes4(keccak256(bytes('price1CumulativeLast()')));
        (bool success, bytes memory data) = _pair.staticcall(abi.encodeWithSelector(_method));
        if(success)
            return abi.decode(data, (uint256));
        return 0;
    }
    function token0(address _pair) internal view returns (address) {
        bytes4 _method = bytes4(keccak256(bytes('token0()')));
        (bool success, bytes memory data) = _pair.staticcall(abi.encodeWithSelector(_method));
        if(success)
            return abi.decode(data, (address));
        return address(0);
    }
    function token1(address _pair) internal view returns (address) {
        bytes4 _method = bytes4(keccak256(bytes('token1()')));
        (bool success, bytes memory data) = _pair.staticcall(abi.encodeWithSelector(_method));
        if(success)
            return abi.decode(data, (address));
        return address(0);
    }
    function getReserves(address _pair) internal view returns (uint256,uint256,uint32) {
        bytes4 _method = bytes4(keccak256(bytes('getReserves()')));
        (bool success, bytes memory data) = _pair.staticcall(abi.encodeWithSelector(_method));
        if(success)
            return abi.decode(data, (uint256,uint256,uint32));
        return (0,0,0);
    }
    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        address _router, 
        string memory _eth, 
        uint _amountIn, 
        uint _amountOut, 
        address[] memory _path, 
        address _to, 
        uint _deadline
    ) internal {
        bytes4 _method = bytes4(keccak256(abi.encodePacked('swapExactTokensFor',_eth,'SupportingFeeOnTransferTokens(uint,uint,address[],address,uint)')));
        (bool success,) = _router.call(abi.encodeWithSelector(_method, _amountIn, _amountOut, _path, _to, _deadline));
        if(!success)
            revert('RouterHelper: Swap Error!');
    }
    function addLiquidityETH(
        address _router, 
        string memory _eth, 
        address _token,
        uint _amountTokenDesired,
        uint _amountTokenMin,
        uint _amountETHMin,
        address _to,
        uint _deadline,
        uint _value
    ) internal {
        bytes4 _method = bytes4(keccak256(abi.encodePacked('addLiquidity',_eth,'(address,uint,uint,uint,address,uint)')));
        (bool success,) = _router.call{value:_value}(abi.encodeWithSelector(_method, _token, _amountTokenDesired, _amountTokenMin, _amountETHMin, _to, _deadline));
        if(!success)
            revert('RouterHelper: Add Liquidity Error!');
    }
    function getETHPair(address _router, string memory _eth, address _token) internal view returns (address) {
        bytes4 _method1 = bytes4(keccak256(bytes('factory()')));
        (bool success1, bytes memory data1) = _router.staticcall(abi.encodeWithSelector(_method1));
        if(!success1)
            return address(0);
        address _factory = abi.decode(data1, (address));
        bytes4 _method2 = bytes4(keccak256(bytes('getPair(address,address)')));
        address _WETH = RouterLibrary.WETH(_router, _eth);
        (bool success2, bytes memory data2) = _factory.staticcall(abi.encodeWithSelector(_method2,_token,_WETH));
        if(success2)
            return abi.decode(data2, (address));
        return address(0);
    }
}