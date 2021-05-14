import BigNumber from 'bignumber.js';
import ERC20ABI from '../../abi/ERC20.json';
import * as BaseInfo from './BaseInfo';

  
async function checkERC20(contractAddress) {
    var contract = new BaseInfo.web3.eth.Contract(ERC20ABI, contractAddress);
    try {
      const name = await BaseInfo.callContractFunc(contract, 'name', []);
      const totalSupply = await BaseInfo.callContractFunc(contract, 'totalSupply', []);
      const decimals = await BaseInfo.callContractFunc(contract, 'decimals', []);
      const symbol = await BaseInfo.callContractFunc(contract, 'symbol', []);
      await BaseInfo.callContractFunc(contract, 'balanceOf', [contractAddress]);
      await BaseInfo.callContractFunc(contract, 'allowance', [contractAddress, contractAddress]);
      return {name, totalSupply, decimals, symbol, assetid: contractAddress};
    } catch (error) {
      throw error;
    }
}

async function totalSupply(contractAddress) {
    var contract = new BaseInfo.web3.eth.Contract(ERC20ABI, contractAddress);
    const totalSupply = await BaseInfo.callContractFunc(contract, 'totalSupply', []);
    return new BigNumber(totalSupply);
  }

async function getBalance(contractAddress, owner) {
    var contract = new BaseInfo.web3.eth.Contract(ERC20ABI, contractAddress);
    const balance = await BaseInfo.callContractFunc(contract, 'balanceOf', [owner]);
    return new BigNumber(balance);
}
  
async function getAllowance(contractAddress, owner, spender) {
    var contract = new BaseInfo.web3.eth.Contract(ERC20ABI, contractAddress);
    const allowancedBalance =  await BaseInfo.callContractFunc(contract, 'allowance', [owner, spender]);
    return new BigNumber(allowancedBalance);
}

async function approve(contractAddress, spender, amount) {
    var contract = new BaseInfo.web3.eth.Contract(ERC20ABI, contractAddress);
    amount = '0x' + new BigNumber(amount).toString(16);
    return BaseInfo.executeContractFunc(contract, 'approve', [spender, amount]);
}

export {
    checkERC20,
    getBalance,
    getAllowance,
    approve,
    totalSupply
}