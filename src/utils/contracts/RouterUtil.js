import RouterABI from '../../abi/router.json';
import BigNumber from 'bignumber.js';
import eventProxy from '../../utils/eventProxy';
import * as BaseInfo from './BaseInfo';

var contractAddress = '';

// 每次router合约发生变化，都需要发送此事件以更新router合约地址
eventProxy.on('updateRouterAddr', routerAddress => {
    contractAddress = routerAddress;
});

async function getAmountsOut(amountIn, path) {
    var contract = new BaseInfo.web3.eth.Contract(RouterABI, contractAddress);
    amountIn = '0x' + new BigNumber(amountIn).toString(16);
    const amounts = await BaseInfo.callContractFunc(contract, 'getAmountsOut', [amountIn, path]);
    return amounts;
}

async function getAmountsIn(amountOut, path) {
    var contract = new BaseInfo.web3.eth.Contract(RouterABI, contractAddress);
    amountOut = '0x' + new BigNumber(amountOut).toString(16);
    const amounts = await BaseInfo.callContractFunc(contract, 'getAmountsIn', [amountOut, path]);
    return amounts;
}

async function addLiquidity(tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin, toAddress, deadline) {
    var contract = new BaseInfo.web3.eth.Contract(RouterABI, contractAddress);
    amountADesired = '0x' + new BigNumber(amountADesired).toString(16);
    amountBDesired = '0x' + new BigNumber(amountBDesired).toString(16);
    amountAMin = '0x' + new BigNumber(amountAMin).toString(16);
    amountBMin = '0x' + new BigNumber(amountBMin).toString(16);
    deadline = '0x' + new BigNumber(deadline).toString(16);
    return BaseInfo.executeContractFunc(contract, 'addLiquidity', [tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin, toAddress, deadline]);
}

async function addLiquidityETH(value, token, amountTokenDesired, amountAMin, amountBMin, toAddress, deadline) {
    var contract = new BaseInfo.web3.eth.Contract(RouterABI, contractAddress);
    amountTokenDesired = '0x' + new BigNumber(amountTokenDesired).toString(16);
    amountAMin = '0x' + new BigNumber(amountAMin).toString(16);
    amountBMin = '0x' + new BigNumber(amountBMin).toString(16);
    deadline = '0x' + new BigNumber(deadline).toString(16);
    return BaseInfo.executeContractFunc(contract, 'addLiquidityETH', [token, amountTokenDesired, amountAMin, amountBMin, toAddress, deadline], value);
}

async function removeLiquidity(tokenA, tokenB, liquidity, amountAMin, amountBMin, toAddress, deadline) {
    var contract = new BaseInfo.web3.eth.Contract(RouterABI, contractAddress);
    liquidity = '0x' + new BigNumber(liquidity).toString(16);
    amountAMin = '0x' + new BigNumber(amountAMin).toString(16);
    amountBMin = '0x' + new BigNumber(amountBMin).toString(16);
    deadline = '0x' + new BigNumber(deadline).toString(16);
    return BaseInfo.executeContractFunc(contract, 'removeLiquidity', 
                                        [tokenA, tokenB, liquidity, amountAMin, amountBMin, toAddress, deadline]);
}

async function removeLiquidityETH(token, liquidity, amountTokenMin, amountETHMin, toAddress, deadline) {
    var contract = new BaseInfo.web3.eth.Contract(RouterABI, contractAddress);
    liquidity = '0x' + new BigNumber(liquidity).toString(16);
    amountTokenMin = '0x' + new BigNumber(amountTokenMin).toString(16);
    amountETHMin = '0x' + new BigNumber(amountETHMin).toString(16);
    deadline = '0x' + new BigNumber(deadline).toString(16);
    return BaseInfo.executeContractFunc(contract, 'removeLiquidityETH', 
                                        [token, liquidity, amountTokenMin, amountETHMin, toAddress, deadline]);
}

async function swapExactTokensForTokens(amountIn, amountOutMin, path, to, deadline) {
    var contract = new BaseInfo.web3.eth.Contract(RouterABI, contractAddress);
    amountIn = '0x' + new BigNumber(amountIn).toString(16);
    amountOutMin = '0x' + new BigNumber(amountOutMin).toString(16);
    deadline = '0x' + new BigNumber(deadline).toString(16);
    return BaseInfo.executeContractFunc(contract, 'swapExactTokensForTokens', [amountIn, amountOutMin, path, to, deadline]);
}

// path[0] == WETH
async function swapExactETHForTokens(value, amountOutMin, path, to, deadline) {
    var contract = new BaseInfo.web3.eth.Contract(RouterABI, contractAddress);
    value = '0x' + new BigNumber(value).toString(16);
    amountOutMin = '0x' + new BigNumber(amountOutMin).toString(16);
    deadline = '0x' + new BigNumber(deadline).toString(16);
    return BaseInfo.executeContractFunc(contract, 'swapExactETHForTokens', [amountOutMin, path, to, deadline], value);
}

// path[path.length - 1] == WETH
async function swapExactTokensForETH(amountIn, amountOutMin, path, to, deadline) {
    var contract = new BaseInfo.web3.eth.Contract(RouterABI, contractAddress);
    amountIn = '0x' + new BigNumber(amountIn).toString(16);
    amountOutMin = '0x' + new BigNumber(amountOutMin).toString(16);
    deadline = '0x' + new BigNumber(deadline).toString(16);
    return BaseInfo.executeContractFunc(contract, 'swapExactTokensForETH', [amountIn, amountOutMin, path, to, deadline]);
}

        
export {
    getAmountsOut,
    getAmountsIn,
    addLiquidity,
    addLiquidityETH,
    removeLiquidity,
    removeLiquidityETH,
    swapExactTokensForTokens,
    swapExactETHForTokens,
    swapExactTokensForETH
}