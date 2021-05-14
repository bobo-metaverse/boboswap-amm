import FactoryABI from '../../abi/factory.json';
import BigNumber from 'bignumber.js';
import eventProxy from '../../utils/eventProxy';
import * as BaseInfo from './BaseInfo';

var contractAddress = '';

// 每次factory合约发生变化，都需要发送此事件以更新factory合约地址
eventProxy.on('updateFactoryAddr', factoryAddress => {
    contractAddress = factoryAddress;
});

async function getPair(tokenA, tokenB) {
    var contract = new BaseInfo.web3.eth.Contract(FactoryABI, contractAddress);
    if (new BigNumber(tokenA).gt(new BigNumber(tokenB))) {
        var tmpToken = tokenA;
        tokenA = tokenB;
        tokenB = tmpToken;
    }
    const pairAddr = await BaseInfo.callContractFunc(contract, 'getPair', [tokenA, tokenB]);
    return {exist: pairAddr != null && new BigNumber(pairAddr).toNumber() != 0, pairAddr, firstAssetId: tokenA};
}

async function pairFor(tokenA, tokenB) {
    var contract = new BaseInfo.web3.eth.Contract(FactoryABI, contractAddress);
    const pairAddr = await BaseInfo.callContractFunc(contract, 'pairFor', [tokenA, tokenB]);
    return pairAddr;
}

async function createPair(tokenA, tokenB) {
    var contract = new BaseInfo.web3.eth.Contract(FactoryABI, contractAddress);
    return BaseInfo.executeContractFunc(contract, 'createPair', [tokenA, tokenB]);
}

export {
    getPair,
    pairFor,
    createPair
}