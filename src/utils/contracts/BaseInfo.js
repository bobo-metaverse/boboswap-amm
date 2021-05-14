import eventProxy from '../../utils/eventProxy';
import BigNumber from 'bignumber.js';
import * as Notification from '../../utils/notification';

var web3 = null;
var accountAddr = '';

eventProxy.on('web3Inited', web3Info => {
    web3 = web3Info.web3;
    accountAddr = web3Info.accountAddr;
});

function callContractFunc(contract, funcName, paraValues) {
    return contract.methods[funcName](...paraValues).call();
}

async function executeContractFunc(contract, funcName, paraValues, ethValue) {
    const gasPrice = await web3.eth.getGasPrice();

    return contract.methods[funcName](...paraValues).send({gasPrice, from: accountAddr, value: ethValue != null ? ethValue : 0})
            .on('transactionHash', function(txHash) {
                Notification.displayTxInfo(txHash);
            })
            .on('receipt', function(receipt) {
                eventProxy.trigger('txStatus', receipt.status);
                if (!receipt.status) {
                    Notification.displayReceiptFailInfo(receipt.transactionHash);
                } else {
                    Notification.displayReceiptSuccessInfo(receipt.transactionHash);
                }
            });
}

async function getETHBalance() {
    return new BigNumber(await web3.eth.getBalance(accountAddr));
}

export {
    web3,
    accountAddr,
    callContractFunc,
    executeContractFunc,
    getETHBalance
}