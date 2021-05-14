import PairABI from '../../abi/pair.json';
import BigNumber from 'bignumber.js';
import eventProxy from '../../utils/eventProxy';
import * as BaseInfo from './BaseInfo';

var contractAddress = '';

// 每次pair合约发生变化，都需要发送此事件以更新pair合约地址
eventProxy.on('updatePairAddr', pairAddress => {
    contractAddress = pairAddress;
});

async function getReserves(pairAddr) {
    var contract = new BaseInfo.web3.eth.Contract(PairABI, pairAddr != null ? pairAddr : contractAddress);
    const reserves = await BaseInfo.callContractFunc(contract, 'getReserves', []);
    return reserves;
}

async function token0(pairAddr) {
    var contract = new BaseInfo.web3.eth.Contract(PairABI, pairAddr != null ? pairAddr : contractAddress);
    const token0Addr = await BaseInfo.callContractFunc(contract, 'token0', []);
    return token0Addr;
}

async function token1(pairAddr) {
    var contract = new BaseInfo.web3.eth.Contract(PairABI, pairAddr != null ? pairAddr : contractAddress);
    const token1Addr = await BaseInfo.callContractFunc(contract, 'token1', []);
    return token1Addr;
}

async function totalSupply(pairAddr) {
    var contract = new BaseInfo.web3.eth.Contract(PairABI, pairAddr != null ? pairAddr : contractAddress);
    const totalSupply = await BaseInfo.callContractFunc(contract, 'totalSupply', []);
    return new BigNumber(totalSupply);
  }

async function getBalance(owner, pairAddr) {
    var contract = new BaseInfo.web3.eth.Contract(PairABI, pairAddr != null ? pairAddr : contractAddress);
    const balance = await BaseInfo.callContractFunc(contract, 'balanceOf', [owner]);
    return new BigNumber(balance);
}


export {
    getReserves,
    token0,
    token1,
    totalSupply,
    getBalance
}