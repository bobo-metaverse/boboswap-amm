import React, { Component } from 'react';
import { Dialog, Select } from '@icedesign/base';
import { Input, Button, Table, Grid, Checkbox, Collapse, Message, Icon, Balloon, Divider } from '@alifd/next';
import IceContainer from '@icedesign/container';
import * as oexchain from 'oex-web3';
import * as ethers from 'ethers';
import cookie from 'react-cookies';
import BigNumber from 'bignumber.js';
import cx from 'classnames';

import * as abiUtil from 'ethereumjs-abi';

import * as utils from '../../utils/utils';
import * as BaseUtil from '../../utils/contracts/BaseInfo';
import * as ERC20Util from '../../utils/contracts/ERC20Util';
import * as FactoryUtil from '../../utils/contracts/FactoryUtil';
import * as RouterUtil from '../../utils/contracts/RouterUtil';
import * as PairUtil from '../../utils/contracts/PairUtil';
import * as Notification from '../../utils/notification';
import { T, TUP } from '../../utils/lang';
import * as Constant from '../../utils/constant';
import './style.scss';
import './ui.scss';
import { UiDialog } from '../../components/Ui/UiDialog';
import { UiDialog2 } from '../../components/Ui/UiDialog2';
import { UiDialog3 } from '../../components/Ui/UiDialog3';
import { UiDialog4 } from '../../components/Ui/UiDialog4';
import { UiProgressControl } from '../../components/Ui/UiProgressControl';

import { Iconfont } from '../../components/Ui/iconfont';
import MinerInfo from '../../components/MinerInfo';
import { getAssetInfoById } from '../../utils/oexSDK';
import { popFromUserPairIndexList, pushToUserPairIndexList, updateUserPairIndexList, UserPairIndexList } from '../../utils/userPairList';
import eventProxy from '../../utils/eventProxy';

const { Row, Col } = Grid;
// const oexLogo =
const oexTokenLogo = require('./images/oexToken.png');
const PNG_max = require('./images/max.png');
const PNG_transfer = require('./images/transfer.png');
const otherTokenLogo = require('./images/default-logo.png');
const PNG_ctTop = require('./images/ct-top.png');
const PNG_ctBottom = require('./images/ct-bottom.png');

const assetData = [{ label: 'OEX', value: 0 }];

export default class OexSwap extends Component {
  static displayName = 'OexSwap';

  constructor(props) {
    super(props);
    const account = utils.getDataFromFile(Constant.AccountObj);
    const txInfoList = utils.getDataFromFile(Constant.TxInfoFile);
    this.state = {
      web3: null,
      chainId: 56,
      accountAddr: '',
      WETH: '',
      middleTokenList: [],

      account,
      accountName: account != null ? account.accountName : '',
      txInfoList: txInfoList != null ? txInfoList : [],
      fromInfo: { value: '', maxValue: 0, selectAssetTip: T('选择通证'), selectAssetInfo: null, tmpSelectAssetInfo: null },
      toInfo: { value: '', maxValue: 0, selectAssetTip: T('选择通证'), selectAssetInfo: null, tmpSelectAssetInfo: null },
      assetList: [],
      assetSelectorDialogVisible: false,
      swapPoolDialogVisible: false,
      swapPoolDialogData: null,

      tokenApprovedDialogVisible: false,

      minerInfoDialogVisible: false,

      mySwapPoolDialogVisible: false,
      mySwapPoolDialogData: [],
      myOutPoolDialogVisible: false,
      myOutPoolDialogData: null,
      outPoolValue: 50,
      outPoolAmount: 0,
      removedAmount0: 0,
      removedAmount1: 0,
      UiProgressControlKey: 0, // 控制子组件渲染

      assetDisplayList: [],
      isFromAsset: true,
      pairList: [],
      pairMap: {},
      feeRate: 0,
      curPairInfo: { myPercent: 0, impactedPricePercent: 0, minReceivedAmount: 0, feeAmount: 0 },
      contractName: 'oexswaptest012',
      minerContractName: 'oexminertest034',
      liquidToBeRemoved: '',
      maxLiquidTip: '最多可移除的流动性数量:',
      txInfoVisible: false,
      sysTokenID: 0,
      myKeystore: null,
      suggestionPrice: 0,
      callbackFunc: null,
      selectedTolerance: 1,
      toleranceInputEnable: false,
      inputTolerance: 0,
      gasPrice: 100,
      gasLimit: 1000000,
      pairAssetInfoData: null,
      pairAssetInfo: '',
      password: '',
      bLiquidOp: false,
      userRemovedLiquidVisible: false,
      liquidDecimals: 0,
      miningVisible: false,
      miningInfo: { curMiningOEX: 0, myHavestOEX: 0, miningSettings: [] },
      assetInfoMap: {},
      broswerInfo: {'56': 'https://bscscan.com', '128': 'https://hecoinfo.com'},
      logoInfo: {'56': 'https://doulaig.oss-cn-hangzhou.aliyuncs.com/wallet/bsc/', '128': 'https://doulaig.oss-cn-hangzhou.aliyuncs.com/wallet/heco/'},
      platformTokenInfo: {'56': 'https://bscscan.com/stat/supply', '128': 'https://hecoinfo.com/stat/supply'},
      timer: null,

      toleranceData: [
        { label: '0.1%', value: 1 },
        { label: '0.2%', value: 2 },
        { label: '1%', value: 10 },
        { label: '2%', value: 20 },
        { label: T('自定义'), value: 0 },
      ],

      factoryAddr: '',
      routerAddr: '',

      curApprovedAssetInfo: {symbol: ''},
      nextStepFunc: () => {},
      txStatus: true,
      usedPairsInfo: {}
    };
  }

  componentDidMount = async () => {
    eventProxy.on('showMiningInfo', () => this.showMiningInfo());
    eventProxy.on('MinerInfo:invitationHarvest', () => this.setState({ callbackFunc: this.invitationHarvest, txInfoVisible: true }));
    eventProxy.on('MinerInfo:harvest', () => this.setState({ callbackFunc: this.harvest, txInfoVisible: true }));
    eventProxy.on('web3Inited', web3Info => {
      this.state.web3 = web3Info.web3;
      this.setState({chainId: web3Info.chainId, accountAddr: web3Info.accountAddr});
      this.getDefaultAssets();
      eventProxy.trigger("updateBroswerURL", this.state.broswerInfo[web3Info.chainId]);
    });
    eventProxy.on('txStatus', txStatus => {
      this.state.txStatus = txStatus;
    });

    this.state.usedPairsInfo = JSON.parse(localStorage.getItem('usedPairsInfo') || {});

    let nodeInfo = cookie.load('nodeInfo');
    await oexchain.utils.setProvider(nodeInfo);
    var chainConfig = await oexchain.oex.getChainConfig(false);
    if (chainConfig == null) {
      chainConfig = await oexchain.oex.getChainConfig(true);
    }
    await oexchain.oex.setChainConfig(chainConfig);
    this.getAllPair();
    this.getFeeRate();
    this.state.myKeystore = utils.getDataFromFile(Constant.KeyStore);
    oexchain.account.getAccountByName(this.state.accountName).then((account) => {
      this.setState({ account });
    });
    oexchain.oex.getSuggestionGasPrice().then((gasPrice) => {
      this.setState({ suggestionPrice: utils.getReadableNumber(gasPrice, 9, 9) });
    });
    this.state.timer = setInterval(this.updatePool.bind(this), 500000);
  };

  getDefaultAssets = () => {
    fetch('https://doulaig.oss-cn-hangzhou.aliyuncs.com/honestswap/defaultAssets.json', 
        {
        mode: 'cors', 
        headers: new Headers({
          'Accept': 'application/json',
          "Access-Control-Allow-Origin": "*"
        })})
      .then((response) => {
        return response.json();
      })
      .then((tokensInfo) => {
        if (tokensInfo != null) {
          const assetList = tokensInfo[this.state.chainId].assets;
          const assetDisplayList = this.getAssetDisplayInfo(assetList);
          this.setState({ assetList, assetDisplayList, 
                          factoryAddr: tokensInfo[this.state.chainId].factoryContract,
                          routerAddr: tokensInfo[this.state.chainId].routerContract});
          eventProxy.trigger('updateFactoryAddr', this.state.factoryAddr);
          eventProxy.trigger('updateRouterAddr', this.state.routerAddr);
        }
      });
  }

  componentWillUnmount() {
    clearInterval(this.state.timer);
  }

  // 每隔 5秒更新一次数据
  updatePool() {
    if (!this.state.fromInfo) return;
    if (!this.state.toInfo) return;
    this.updateBaseInfo(this.state.fromInfo, this.state.toInfo);
    this.updateToValue();
    //this.updateUserInfo();
  }

  getAllPair = async () => {
    const _this = this;
    let payloadInfo = { funcName: 'getPairNumber', types: [], values: [] }; // types和values即合约方法的参数类型和值
    let pairNumber = await oexchain.action.readContract(this.state.accountName, this.state.contractName, payloadInfo, 'latest');
    pairNumber = parseInt(pairNumber);
    console.log(pairNumber);
    _this.state.pairList = [];
    _this.state.pairMap = {};
    for (let i = 0; i < pairNumber; i++) {
      _this.getPairByIndex(i, true).then((pairInfo) => {
        pairInfo.index = i;
        _this.state.pairList.push(pairInfo);
        _this.state.pairMap[pairInfo.firstAssetId + '-' + pairInfo.secondAssetId] = pairInfo;
        if (this.state.assetInfoMap[pairInfo.firstAssetId] == null) {
          getAssetInfoById(pairInfo.firstAssetId).then((assetInfo) => {
            if (i === 0) console.log(pairInfo, assetInfo);
            if (!assetInfo) return;
            this.state.assetInfoMap[pairInfo.firstAssetId] = assetInfo;
          });
        }
        if (this.state.assetInfoMap[pairInfo.secondAssetId] == null) {
          getAssetInfoById(pairInfo.secondAssetId).then((assetInfo) => {
            if (i === 0) console.log(pairInfo, assetInfo);
            if (!assetInfo) return;
            this.state.assetInfoMap[pairInfo.secondAssetId] = assetInfo;
          });
        }
        // 默认选一个
        // if (i === 0 && !this.state.fromInfo.selectAssetInfo && !this.state.toInfo.selectAssetInfo) {
        //   Promise.all(awaitList).then(() => {
        //     if (!this.state.assetInfoMap[pairInfo.firstAssetId]) return;
        //     if (!this.state.assetInfoMap[pairInfo.secondAssetId]) return;
        //     this.startExchange(pairInfo);
        //   });
        // }
      });
    }
  };

  getFeeRate = () => {
    let payloadInfo = { funcName: 'feeRate', types: [], values: [] }; // types和values即合约方法的参数类型和值
    oexchain.action
      .readContract(this.state.accountName, this.state.contractName, payloadInfo, 'latest')
      .then((feeRate) => {
        this.setState({ feeRate: parseInt(feeRate) });
      })
      .catch((err) => console.log(err));
  };
  getPairByIndexCache = JSON.parse(localStorage.getItem('getPairByIndex') || '{}');
  getPairByIndex = async (pairIndex, cacheAble = false) => {
    const key = this.state.contractName + ':' + pairIndex;
    if (cacheAble && this.getPairByIndexCache[key]) {
      const res = utils.clone(this.getPairByIndexCache[key]);
      res.firstAssetNumber = new BigNumber(res.firstAssetNumber);
      res.secondAssetNumber = new BigNumber(res.secondAssetNumber);
      res.totalLiquidOfFirstAsset = new BigNumber(res.totalLiquidOfFirstAsset);
      res.totalLiquidOfSecondAsset = new BigNumber(res.totalLiquidOfSecondAsset);
      return res;
    }
    const payloadInfo = { funcName: 'pairList', types: ['uint256'], values: [pairIndex] };
    const pairInfo = await oexchain.action.readContract(this.state.accountName, this.state.contractName, payloadInfo, 'latest');
    const pi = utils.parseResult(['uint', 'uint', 'uint', 'uint', 'uint', 'uint'], pairInfo);
    const res = { firstAssetId: pi[0], secondAssetId: pi[1], firstAssetNumber: pi[2], secondAssetNumber: pi[3], totalLiquidOfFirstAsset: pi[4], totalLiquidOfSecondAsset: pi[5] };
    this.getPairByIndexCache[key] = utils.clone(res);
    localStorage.setItem('getPairByIndex', JSON.stringify(this.getPairByIndexCache));
    res.firstAssetNumber = new BigNumber(res.firstAssetNumber);
    res.secondAssetNumber = new BigNumber(res.secondAssetNumber);
    res.totalLiquidOfFirstAsset = new BigNumber(res.totalLiquidOfFirstAsset);
    res.totalLiquidOfSecondAsset = new BigNumber(res.totalLiquidOfSecondAsset);
    return res;
  };

  getPairByAddr = async (pairAddr) => {
    eventProxy.trigger('updatePairAddr', pairAddr);
    const reservesInfo = await PairUtil.getReserves();
    const token0 = await PairUtil.token0();
    const token1 = await PairUtil.token1();
    return {firstAssetId: token0, secondAssetId: token1, firstAssetNumber: new BigNumber(reservesInfo.reserve0), secondAssetNumber: new BigNumber(reservesInfo.reserve1)}
  }

  getPairTotalLiquid = async (pairAddr) => {
    const totalSupply = await PairUtil.totalSupply(pairAddr);
    return totalSupply;
  }

  getUserLiquid = async (pairAddr) => {
    const balance = await PairUtil.getBalance(this.state.accountAddr, pairAddr);
    return balance;
  }

  getPairByAssetId = async (firstAssetId, secondAssetId) => {
    var pairInfo = await FactoryUtil.getPair(firstAssetId, secondAssetId);
    return pairInfo;
  };

  // getPairTotalLiquid = async (pairIndex) => {
  //   const payloadInfo = { funcName: 'pairTotalLiquidMap', types: ['uint256'], values: [pairIndex] };
  //   const totalLiquid = await oexchain.action.readContract(this.state.accountName, this.state.contractName, payloadInfo, 'latest');
  //   return new BigNumber(totalLiquid);
  // };

  getUserLiquidInPair = async (pairIndex) => {
    const payloadInfo = { funcName: 'getUserLiquid', types: ['uint256'], values: [pairIndex] };
    const userLiquid = await oexchain.action.readContract(this.state.accountName, this.state.contractName, payloadInfo, 'latest');
    const res = new BigNumber(userLiquid);
    if (res.isGreaterThan(0)) pushToUserPairIndexList(pairIndex);
    return res;
  };

  addLiquidity = async () => {
    const { fromInfo, toInfo, WETH, selectedTolerance, inputTolerance, accountAddr, routerAddr } = this.state;
    const fromAssetId = fromInfo.selectAssetInfo.assetid;
    const toAssetId = toInfo.selectAssetInfo.assetid;
    const fromAllowancedAmount = fromAssetId == '0' ? await BaseUtil.getETHBalance() : await ERC20Util.getAllowance(fromAssetId, accountAddr, routerAddr);
    const toAllowancedAmount = toAssetId == '0' ? await BaseUtil.getETHBalance() : await ERC20Util.getAllowance(toAssetId, accountAddr, routerAddr);
    const fromAmount = new BigNumber(fromInfo.value).shiftedBy(fromInfo.selectAssetInfo.decimals);
    const toAmount = new BigNumber(toInfo.value).shiftedBy(toInfo.selectAssetInfo.decimals);

    const tolerance = selectedTolerance > 0 ? selectedTolerance : inputTolerance * 10;
    const amountInMin = fromAmount
                        .multipliedBy(1000 - tolerance)
                        .dividedBy(1000)
                        .integerValue();
    const amountOutMin = toAmount
                        .multipliedBy(1000 - tolerance)
                        .dividedBy(1000)
                        .integerValue();
    const deadline = Math.floor(new Date().getTime() / 1000) + 60;  

    const addLiq = async () => {
      if (fromAssetId == '0' || toAssetId == '0') {
        const value = fromAssetId == '0' ? fromAmount : toAmount;
        const token = fromAssetId == '0' ? toAssetId : fromAssetId;
        const amount = fromAssetId == '0' ? toAmount : fromAmount;
        await RouterUtil.addLiquidityETH(value, token, amount, amountInMin, amountOutMin, accountAddr, deadline);
      } else {
        await RouterUtil.addLiquidity(fromAssetId, toAssetId, fromAmount, toAmount, amountInMin, amountOutMin, accountAddr, deadline);
      }
      if (this.state.txStatus) {
        this.updateBaseInfo(fromInfo, toInfo);
      }
    }

    if (fromAmount.gt(fromAllowancedAmount)) {
      this.state.nextStepFunc = async () => {
        await ERC20Util.approve(fromAssetId, routerAddr, new BigNumber(1).shiftedBy(50));
        if (this.state.txStatus) {
          if (toAmount.gt(toAllowancedAmount)) {
            await ERC20Util.approve(toAssetId, routerAddr, new BigNumber(1).shiftedBy(50));
            if (this.state.txStatus) {
              addLiq();
            }
          } else {
            addLiq();
          }
        }
      }
      this.setState({tokenApprovedDialogVisible: true, curApprovedAssetInfo: fromInfo.selectAssetInfo});
    } else {
      if (toAmount.gt(toAllowancedAmount)) {
        await ERC20Util.approve(toAssetId, routerAddr, new BigNumber(1).shiftedBy(50));
        if (this.state.txStatus) {
          addLiq();
        }
      } else {
        addLiq();
      }
    }
  };

  // removeLiquidity = (gasInfo, privateKey) => {
  //   const { curPairInfo, liquidToBeRemoved, accountName, contractName, fromInfo } = this.state;
  //   const liquidRemoved = '0x' + new BigNumber(liquidToBeRemoved).shiftedBy(this.state.liquidDecimals - 2).toString(16);
  //   let actionInfo = { accountName, toAccountName: contractName, assetId: 0, amount: new BigNumber(0), remark: '' };
  //   let payloadInfo = { funcName: 'removeLiquidity', types: ['uint256', 'uint256'], values: [curPairInfo.index, liquidRemoved] };

  //   oexchain.action.executeContract(actionInfo, gasInfo, payloadInfo, privateKey).then((txHash) => {
  //     this.checkReceipt(txHash, {
  //       txHash,
  //       actionInfo: {
  //         typeId: 1,
  //         typeName: '移除流动性',
  //         accountName,
  //       },
  //     });
  //   });
  // };

  swapAsset = async () => {
    const { fromInfo, toInfo, WETH, selectedTolerance, inputTolerance, accountAddr, routerAddr } = this.state;
    const fromAssetId = fromInfo.selectAssetInfo.assetid;
    const toAssetId = toInfo.selectAssetInfo.assetid;
    const amountIn = new BigNumber(fromInfo.value).shiftedBy(fromInfo.selectAssetInfo.decimals);
    
    const tolerance = selectedTolerance > 0 ? selectedTolerance : inputTolerance * 10;
    var amountOutMin = new BigNumber(toInfo.value)
                      .shiftedBy(toInfo.selectAssetInfo.decimals - 3)
                      .multipliedBy(1000 - tolerance)
                      .integerValue();

    var path = [fromAssetId, toAssetId];
    const deadline = Math.floor(new Date().getTime() / 1000) + 60;  
    // 0表示是平台币
    if (fromAssetId == '0') {  // amountIn是平台币，不需要进行授权验证
      path = [WETH.assetid, toAssetId];
      await RouterUtil.swapExactETHForTokens(amountIn, amountOutMin, path, accountAddr, deadline);
      if (this.state.txStatus) {
        this.updateBaseInfo(fromInfo, toInfo);
      }
      return;
    } else if (toAssetId == '0') {  // amountOut是平台币，需要对amountIn进行授权验证
      path = [fromAssetId, WETH.assetid]
    }

    const allowancedAmount = await ERC20Util.getAllowance(fromAssetId, accountAddr, routerAddr);
    if (amountIn.gt(allowancedAmount)) {
      this.state.nextStepFunc = async () => {
        await ERC20Util.approve(fromAssetId, routerAddr, new BigNumber(1).shiftedBy(50));
        if (this.state.txStatus) {
          Notification.displayNotice(T('开始兑换'), 1500);
          (toAssetId == '0') ? await RouterUtil.swapExactTokensForETH(amountIn, amountOutMin, path, accountAddr, deadline)
                              :
                             await RouterUtil.swapExactTokensForTokens(amountIn, amountOutMin, path, accountAddr, deadline);
          if (this.state.txStatus) {
            this.updateBaseInfo(fromInfo, toInfo);
          }
        }
      }
      this.setState({tokenApprovedDialogVisible: true, curApprovedAssetInfo: fromInfo.selectAssetInfo});
    } else {
      (toAssetId == '0') ? await RouterUtil.swapExactTokensForETH(amountIn, amountOutMin, path, accountAddr, deadline)
                           :
                           await RouterUtil.swapExactTokensForTokens(amountIn, amountOutMin, path, accountAddr, deadline);
      if (this.state.txStatus) {
        this.updateBaseInfo(fromInfo, toInfo);
      }
    }
  };

  getMiningOEXPerBlock = () => {
    oexchain.oex.getCurrentBlock().then((blockInfo) => {
      let payloadInfo = { funcName: 'getReward', types: ['uint256'], values: [blockInfo.number] }; // types和values即合约方法的参数类型和值
      oexchain.action
        .readContract(this.state.accountName, this.state.minerContractName, payloadInfo, 'latest')
        .then((reward) => {
          this.state.miningInfo.curMiningOEX = new BigNumber(reward).shiftedBy(-18).toString();
          this.setState({ miningInfo: this.state.miningInfo });
        })
        .catch((err) => console.log(err));
    });
  };

  getMyHavestOEX = () => {
    let payloadInfo = { funcName: 'getAmount', types: [], values: [] }; // types和values即合约方法的参数类型和值
    oexchain.action
      .readContract(this.state.accountName, this.state.minerContractName, payloadInfo, 'latest')
      .then((reward) => {
        this.state.miningInfo.myHavestOEX = new BigNumber(reward).shiftedBy(-18).toString();
        this.setState({ miningInfo: this.state.miningInfo });
      })
      .catch((err) => console.log(err));
  };

  getMiningSettings = async () => {
    var index = 0;
    this.state.miningInfo.miningSettings = [];
    while (true) {
      let payloadInfo = { funcName: 'rewardSettingList', types: ['uint'], values: [index] }; // types和values即合约方法的参数类型和值
      const miningSetting = await oexchain.action.readContract(this.state.accountName, this.state.minerContractName, payloadInfo, 'latest');
      if (miningSetting == null || miningSetting == '0x') break;
      const miningSettingElements = utils.parseResult(['uint', 'uint'], miningSetting);
      this.state.miningInfo.miningSettings.push({ reward: miningSettingElements[0], startBlockNumber: miningSettingElements[1] });
      index++;
    }
    this.setState({ miningInfo: this.state.miningInfo });
  };

  // harvest = (gasInfo, privateKey) => {
  //   const { accountName, minerContractName } = this.state;
  //   let actionInfo = { accountName, toAccountName: minerContractName, assetId: 0, amount: new BigNumber(0), remark: '' };
  //   let payloadInfo = { funcName: 'withdraw', types: [], values: [] };

  //   oexchain.action.executeContract(actionInfo, gasInfo, payloadInfo, privateKey).then((txHash) => {
  //     this.checkReceipt(txHash, {
  //       txHash,
  //       actionInfo: {
  //         typeId: 3,
  //         typeName: '提取挖矿奖励',
  //         accountName,
  //       },
  //     });
  //   });
  // };

  checkReceipt = (txHash, txDetailInfo) => {
    let count = 0;
    if (txHash != null) {
      Notification.displayTxInfo(txHash);
    }
    const intervalId = setInterval(() => {
      oexchain.oex.getTransactionReceipt(txHash).then(async (receipt) => {
        if (receipt == null) {
          count++;
          if (count == 10) {
            Notification.displayReceiptUnknownInfo(txHash);
            clearInterval(intervalId);
          }
        } else {
          clearInterval(intervalId);
          const actionResults = receipt.actionResults;
          if (actionResults[0].status == 0) {
            Notification.displayReceiptFailInfo(txHash);
          } else {
            Notification.displayReceiptSuccessInfo(txHash);
            this.updateBaseInfo(this.state.fromInfo, this.state.toInfo);
          }
          if (txDetailInfo != null) {
            var { txInfoList } = this.state;
            txDetailInfo.status = actionResults[0].status;
            if (txDetailInfo.status == 1) {
              const internalTx = await oexchain.oex.getInternalTxByHash(txHash);
              if (internalTx != null) {
                txDetailInfo.innerActions = internalTx.actions[0].internalActions;
              }
            }
            txDetailInfo.time = new Date().toLocaleString();
            txInfoList = [txDetailInfo, ...txInfoList];
            if (txInfoList.length > 100) {
              txInfoList = txInfoList.slice(0, 100);
            }
            this.state.txInfoList = txInfoList;
            utils.storeDataToFile(Constant.TxInfoFile, txInfoList);
          }
        }
      });
    }, 3000);
  };

  startAddLiquidity = () => {
    const { fromInfo, toInfo } = this.state;
    if (fromInfo.selectAssetInfo == null || fromInfo.value == 0 || toInfo.selectAssetInfo == null || toInfo.value == 0) {
      Notification.displayWarningInfo('请选择通证并输入有效金额');
      return;
    }
    this.addLiquidity();
  };

  startRemoveLiquidity = () => {
    this.setState({ userRemovedLiquidVisible: true });
  };

  startSwapAsset = () => {
    if (!this.isPairNormal()) {
      Notification.displayWarningInfo('交易路径不存在，无法交易');
      return;
    }
    this.swapAsset();
  };

  getLiquidOfSecondAsset = async (pairIndex, firstAssetAmount) => {
    const pairInfo = await this.getPairByIndex(pairIndex);
    const neededSecondAssetValue = new BigNumber(firstAssetAmount).multipliedBy(new BigNumber(pairInfo.secondAssetNumber)).dividedBy(new BigNumber(pairInfo.firstAssetNumber)).plus(1);
    return neededSecondAssetValue;
  };

  getOutAmount = async (pairAddr, inAmount) => {
    const { fromInfo, toInfo, feeRate } = this.state;
    const pairInfo = await this.getPairByAddr(pairAddr);
    const firstAssetId = fromInfo.selectAssetInfo.assetid == '0' ? this.state.WETH.assetid : fromInfo.selectAssetInfo.assetid;
    const bFirstAsset = pairInfo.firstAssetId == firstAssetId;
    var outValue;
    var x;
    var y;
    var k;
    inAmount = new BigNumber(inAmount).shiftedBy(fromInfo.selectAssetInfo.decimals);
    inAmount = inAmount.multipliedBy(1000 - feeRate).dividedBy(1000);
    k = new BigNumber(pairInfo.firstAssetNumber).multipliedBy(new BigNumber(pairInfo.secondAssetNumber));
    x = new BigNumber(bFirstAsset ? pairInfo.firstAssetNumber : pairInfo.secondAssetNumber).plus(inAmount);
    outValue = new BigNumber(bFirstAsset ? pairInfo.secondAssetNumber : pairInfo.firstAssetNumber).minus(k.dividedBy(x));
    return outValue.shiftedBy(toInfo.selectAssetInfo.decimals * -1);
  };

  assetRender = (item) => {
    return item.name + '(' + item.symbol + ')';
  };

  // 每隔5秒更新用户通证信息
  async updateUserInfo() {
    const { fromInfo, toInfo, web3, accountAddr } = this.state;
    const infos = [fromInfo, toInfo];

    for (var i = 0; i < infos.length; i++) {
      const info = infos[i];
      if (!info.selectAssetInfo) continue;
      const balance = await ERC20Util.getBalance(info.assetid, accountAddr);
      const amount = balance.shiftedBy(info.selectAssetInfo.decimals * -1).toFixed(info.selectAssetInfo.decimals);
      info.maxValue = amount;
    }

    this.setState({ fromInfo, toInfo });
  }

  onSelectAssetOK = async () => {
    const { fromInfo, toInfo, accountAddr, isFromAsset, web3 } = this.state;

    const tmpSelectAssetInfo = isFromAsset ? fromInfo.tmpSelectAssetInfo : toInfo.tmpSelectAssetInfo;
    if (tmpSelectAssetInfo == null) {
      Notification.displayWarningInfo('请选择通证');
      return;
    }
    const balance = (tmpSelectAssetInfo.assetid == '0') ? await BaseUtil.getETHBalance() :
                                                        await ERC20Util.getBalance(tmpSelectAssetInfo.assetid, accountAddr);
    const amount = balance.shiftedBy(tmpSelectAssetInfo.decimals * -1).toFixed(tmpSelectAssetInfo.decimals);

    if (isFromAsset) {
      fromInfo.selectAssetInfo = tmpSelectAssetInfo;
      fromInfo.selectAssetTip = tmpSelectAssetInfo.symbol.toUpperCase();
      fromInfo.maxValue = amount;
      this.setState({ fromInfo, assetSelectorDialogVisible: false });
    } else {
      toInfo.selectAssetInfo = tmpSelectAssetInfo;
      toInfo.selectAssetTip = tmpSelectAssetInfo.symbol.toUpperCase();
      toInfo.maxValue = amount;
      this.setState({ toInfo, assetSelectorDialogVisible: false });
    }
    this.updateBaseInfo(fromInfo, toInfo);
  };

  findBestSwapPath = async (amountIn, fromAssetId, toAssetId) => {
    var path = [fromAssetId, toAssetId];
    var amountsOutDirectly = await RouterUtil.getAmountsOut(amountIn, path);
    console.log(path, amountsOutDirectly)
    var amountOut = amountsOutDirectly[1];
    for(var i = 0; i < this.state.middleTokenList.length; i++) {
      const middleToken = this.state.middleTokenList[i];
      const multiPath = [fromAssetId, middleToken.assetid, toAssetId];
      try {
        const amountsOut = await RouterUtil.getAmountsOut(amountIn, multiPath);
        console.log(multiPath, amountsOut)
        if (new BigNumber(amountsOut[amountsOut.length - 1]).gt(new BigNumber(amountOut))) {
          amountOut = amountsOut[amountsOut.length - 1];
          path = multiPath;
        }
      } catch (error) {
        console.log('路径无效', multiPath)
      }
    };
    return path;
  }

  updateBaseInfo = async (fromInfo, toInfo) => {
    if (fromInfo.selectAssetInfo != null && toInfo.selectAssetInfo != null) {
      const fromAssetId = fromInfo.selectAssetInfo.assetid == '0' ? this.state.WETH.assetid : fromInfo.selectAssetInfo.assetid;
      const toAssetId = toInfo.selectAssetInfo.assetid == '0' ? this.state.WETH.assetid : toInfo.selectAssetInfo.assetid;
      //const path = await this.findBestSwapPath(new BigNumber(1).shiftedBy(18), fromAssetId, toAssetId);
      const curPairInfo = await this.getPairByAssetId(fromAssetId, toAssetId);
      if (curPairInfo.exist) {
        if (this.state.usedPairsInfo[curPairInfo.pairAddr] != true) {
          this.state.usedPairsInfo[curPairInfo.pairAddr] = {firstAsset: (fromInfo.selectAssetInfo.assetid == '0' ? this.state.WETH : fromInfo.selectAssetInfo), 
                                                            secondAsset: (toInfo.selectAssetInfo.assetid == '0' ? this.state.WETH : toInfo.selectAssetInfo)};
          localStorage.setItem('usedPairsInfo', JSON.stringify(this.state.usedPairsInfo));
        }
        const totalLiquid = await ERC20Util.totalSupply(curPairInfo.pairAddr);
        const userLiquid = await ERC20Util.getBalance(curPairInfo.pairAddr, this.state.accountAddr);
        curPairInfo.totalLiquid = totalLiquid.multipliedBy(100);
        curPairInfo.userLiquid = userLiquid.multipliedBy(100);
        curPairInfo.myPercent = userLiquid.dividedBy(totalLiquid).multipliedBy(100).toFixed(2);
        curPairInfo.feeAmount = new BigNumber(fromInfo.value).multipliedBy(this.state.feeRate).shiftedBy(-3).toFixed(6).toString().replace(/(?:\.0*|(\.\d+?)0+)$/,'$1');
        curPairInfo.minReceivedAmount = 0;

        const pairInfo = await this.getPairByAddr(curPairInfo.pairAddr);
        var firstAssetInfo = fromInfo.selectAssetInfo;
        var secondAssetInfo = toInfo.selectAssetInfo;
        if (pairInfo.firstAssetId != fromAssetId) {
          firstAssetInfo = toInfo.selectAssetInfo;
          secondAssetInfo = fromInfo.selectAssetInfo;
          curPairInfo.firstAssetSymbol = toInfo.selectAssetInfo.symbol;
          curPairInfo.secondAssetSymbol = fromInfo.selectAssetInfo.symbol;
        } else {
          curPairInfo.firstAssetSymbol = fromInfo.selectAssetInfo.symbol;
          curPairInfo.secondAssetSymbol = toInfo.selectAssetInfo.symbol;
        }

        this.state.liquidDecimals = firstAssetInfo.decimals;
        curPairInfo.totalLiquid = curPairInfo.totalLiquid.shiftedBy(this.state.liquidDecimals * -1);
        curPairInfo.userLiquid = curPairInfo.userLiquid.shiftedBy(this.state.liquidDecimals * -1);
        curPairInfo.firstAssetNumber = pairInfo.firstAssetNumber;
        curPairInfo.secondAssetNumber = pairInfo.secondAssetNumber;
        curPairInfo.firstAssetId = pairInfo.firstAssetId;
        curPairInfo.secondAssetId = pairInfo.secondAssetId;

        const firstAssetAmount = pairInfo.firstAssetNumber.shiftedBy(firstAssetInfo.decimals * -1).toFixed(6);
        const secondAssetAmount = pairInfo.secondAssetNumber.shiftedBy(secondAssetInfo.decimals * -1).toFixed(6);
        this.setPairAssetInfo(firstAssetAmount, firstAssetInfo, secondAssetAmount, secondAssetInfo);
      } else {
        this.setPairAssetInfo(0, fromInfo.selectAssetInfo, 0, toInfo.selectAssetInfo);
        Notification.displayWarningInfo('交易路径不存在，无法交易');
      }
      this.setState({ curPairInfo });
    }
  };

  setPairAssetInfo(firstAssetAmount, firstAssetInfo, secondAssetAmount, secondAssetInfo) {
    this.setState({
      pairAssetInfoData: JSON.parse(JSON.stringify({ firstAssetAmount, firstAssetInfo, secondAssetAmount, secondAssetInfo })),
      pairAssetInfo: (
        <div className="ui-pairInfo-num">
          <div className="ui-pairInfo-first ui-ell ui-clearfix" title={firstAssetAmount}>
            <div className="ui-pair-symbol">{firstAssetInfo.symbol.toUpperCase()}</div>
            {firstAssetAmount}
          </div>
          <div className="ui-paireInfo-join">/</div>
          <div className="ui-pairInfo-second ui-ell ui-clearfix" title={secondAssetAmount}>
            <div className="ui-pair-symbol">{secondAssetInfo.symbol.toUpperCase()}</div>
            {secondAssetAmount}
          </div>
        </div>
      ),
    });
  }

  updateBaseInfoByPairInfo = async (curPairInfo, fromInfo, toInfo) => {
    curPairInfo.exist = true;
    const totalLiquid = await this.getPairTotalLiquid(curPairInfo.index);
    const userLiquid = await this.getUserLiquidInPair(curPairInfo.index, this.state.account.accountID);
    curPairInfo.totalLiquid = totalLiquid.multipliedBy(100);
    curPairInfo.userLiquid = userLiquid.multipliedBy(100);
    curPairInfo.myPercent = userLiquid.dividedBy(totalLiquid).multipliedBy(100).toFixed(2);

    var firstAssetInfo = fromInfo.selectAssetInfo;
    var secondAssetInfo = toInfo.selectAssetInfo;
    this.state.liquidDecimals = firstAssetInfo.decimals;
    curPairInfo.totalLiquid = curPairInfo.totalLiquid.shiftedBy(this.state.liquidDecimals * -1);
    curPairInfo.userLiquid = curPairInfo.userLiquid.shiftedBy(this.state.liquidDecimals * -1);

    const firstAssetAmount = curPairInfo.firstAssetNumber.shiftedBy(firstAssetInfo.decimals * -1).toFixed(6);
    const secondAssetAmount = curPairInfo.secondAssetNumber.shiftedBy(secondAssetInfo.decimals * -1).toFixed(6);
    this.setPairAssetInfo(firstAssetAmount, firstAssetInfo, secondAssetAmount, secondAssetInfo);
    this.setState({ curPairInfo });
  };

  getAssetDisplayInfo = (assetList) => {
    const { fromInfo, toInfo, isFromAsset, chainId } = this.state;
    this.state.middleTokenList = [];
    const assetDisplayList = assetList.map((assetInfo) => {
      if (assetInfo.wrappedETH) {
        this.state.WETH = assetInfo;
      }
      if (assetInfo.middleToken) {
        this.state.middleTokenList.push(assetInfo);
      }
      const symbol = assetInfo.symbol.toUpperCase();
      const tmpSelectAssetInfo = isFromAsset ? fromInfo.tmpSelectAssetInfo : toInfo.tmpSelectAssetInfo;
      const classNames = ['ui-assetInfo'];
      if (tmpSelectAssetInfo != null && tmpSelectAssetInfo.assetid == assetInfo.assetid) {
        classNames.push('ui-select');
      }
      var needBtn = true;
      if (isFromAsset) {
        if (toInfo.selectAssetInfo != null) {
          needBtn = assetInfo.assetid != toInfo.selectAssetInfo.assetid;
        }
      } else {
        if (fromInfo.selectAssetInfo != null) {
          needBtn = assetInfo.assetid != fromInfo.selectAssetInfo.assetid;
        }
      }
      var imgExist = true;
      if (assetInfo.assetid != '0' && !utils.validateImage(this.state.logoInfo[this.state.chainId] + assetInfo.assetid.toLowerCase() + '.png')) {
        imgExist = false;
      }
      return (
        <div key={assetInfo.symbol} className={classNames.join(' ')} style={{ cursor: needBtn ? 'pointer' : 'default' }} onClick={() => needBtn && this.clickAsset(assetInfo)}>
          <a className="ui-assetInfo-account" target='_blank' 
                href={assetInfo.assetid == '0' ? this.state.platformTokenInfo[chainId] : this.state.broswerInfo[this.state.chainId] + '/token/' + assetInfo.assetid}><u>{T('通证详情')}</u></a>
          {
            imgExist ? <img src={this.state.logoInfo[this.state.chainId] + (assetInfo.assetid == '0' ? assetInfo.logoAddr : assetInfo.assetid).toLowerCase() + '.png'} />
                      :
                      <input type="button" value={assetInfo.symbol.length > 3 ? assetInfo.symbol.substr(0, 3) : assetInfo.symbol} className='ui-logo'></input>
          }
          
          <div className="ui-assetInfo-symbol">
            {symbol}
            {
              assetInfo.assetid == '0' ? '' : <span>地址:{assetInfo.assetid.substr(0, 6) + '...' + assetInfo.assetid.substr(assetInfo.assetid.length - 4)}</span>
            }
            
          </div>
          <span>{assetInfo.name}</span>
          {needBtn ? (
            <div className="ui-btn" onClick={() => this.clickAsset(assetInfo)}>
              {T('选择此通证').toLocaleUpperCase()}
            </div>
          ) : (
            ''
          )}
        </div>
      );
    });
    return assetDisplayList;
  };

  clickAsset = (assetInfo) => {
    const { fromInfo, toInfo, isFromAsset, assetList } = this.state;
    if (isFromAsset) {
      fromInfo.tmpSelectAssetInfo = assetInfo;
    } else {
      toInfo.tmpSelectAssetInfo = assetInfo;
    }
    const assetDisplayList = this.getAssetDisplayInfo(assetList);
    this.setState({ assetDisplayList });
  };

  searchAsset = async () => {
    if (utils.isEmptyObj(this.state.assetContent)) {
      Notification.displayWarningInfo('请输入通证地址/名称');
      return;
    }
    var assetList = this.getAssetInfos(this.state.assetContent);

    if (assetList.length == 0 || (!utils.equalWithoutCase(assetList[0].symbol, this.state.assetContent) 
                                  && !utils.equalWithoutCase(assetList[0].assetid, this.state.assetContent))) {
      if (this.state.assetContent.charAt(0) >= 0 && this.state.assetContent.charAt(0) <= 9) {
        try {
          const assetInfo = await ERC20Util.checkERC20(this.state.web3, this.state.assetContent);
          //assetInfo.assetid = assetInfo.assetId;
          assetList = [assetInfo, ...assetList];
        } catch (error) {
          Notification.displayWarningInfo('通证不存在');
          return;
        }
      } else {
        Notification.displayWarningInfo('通证不存在');
        return;
      }
    }

    const assetDisplayList = this.getAssetDisplayInfo(assetList);
    this.setState({ assetList, assetDisplayList });
  };

  getAssetInfos = (assetContent) => {
    const { assetList } = this.state;
    const index = assetList.findIndex((assetInfo) => assetInfo.assetid.toUpperCase() == assetContent.toUpperCase() 
                                                  || assetInfo.symbol.toUpperCase() == assetContent.toUpperCase());
    if (index > -1) {
      const assetInfo = assetList[index];
      return [assetInfo, ...assetList.filter((v, i) => i != index)];
    }
    return assetList;
  };

  selectFromAsset = () => {
    this.state.isFromAsset = true;
    const assetDisplayList = this.getAssetDisplayInfo(this.state.assetList);
    this.setState({ assetSelectorDialogVisible: true, assetDisplayList, isFromAsset: this.state.isFromAsset });
  };

  selectToAsset = () => {
    this.state.isFromAsset = false;
    const assetDisplayList = this.getAssetDisplayInfo(this.state.assetList);
    this.setState({ assetSelectorDialogVisible: true, assetDisplayList, isFromAsset: this.state.isFromAsset });
  };

  inputMaxFromAmount = () => {
    this.state.fromInfo.value = this.state.fromInfo.maxValue;
    this.setState({ fromInfo: this.state.fromInfo });
    this.updateToValue(); // 更新
  };

  inputMaxToAmount = () => {
    this.state.toInfo.value = this.state.toInfo.maxValue;
    this.setState({ toInfo: this.state.toInfo });
    this.updateToValue(); // 更新
  };

  swapFromAndTo = () => {
    const fromInfo = this.state.fromInfo;
    const toInfo = this.state.toInfo;
    this.setState({ fromInfo: toInfo, toInfo: fromInfo });
  };

  onTxConfirmOK = () => {
    const { fromInfo, toInfo, sysTokenID, myKeystore } = this.state;
    if (this.state.gasPrice == '') {
      Notification.displayWarningInfo(T('请输入GAS单价'));
      return;
    }

    if (this.state.gasLimit == '') {
      Notification.displayWarningInfo(T('请输入愿意支付的最多GAS数量'));
      return;
    }

    if (this.state.password == '') {
      Notification.displayWarningInfo(T('请输入钱包密码'));
      return;
    }

    let curAccountOEXBalance = 0;
    for (const balance of this.state.account.balances) {
      if (balance.assetID == sysTokenID) {
        curAccountOEXBalance = balance.balance;
        break;
      }
    }

    const gasValue = new BigNumber(this.state.gasPrice).multipliedBy(this.state.gasLimit).shiftedBy(9);
    const maxValue = new BigNumber(curAccountOEXBalance);
    if (gasValue.comparedTo(maxValue) > 0) {
      Notification.displayWarningInfo(T('余额不足以支付gas费用'));
      return;
    }
    if (fromInfo.selectAssetInfo.assetid == sysTokenID || toInfo.selectAssetInfo.assetid == sysTokenID) {
      var oexAmount = 0;
      if (fromInfo.selectAssetInfo.assetid == sysTokenID) {
        oexAmount = new BigNumber(fromInfo.selectAssetInfo.value).shiftedBy(18);
      } else {
        oexAmount = new BigNumber(toInfo.selectAssetInfo.value).shiftedBy(18);
      }
      const valueAddGasFee = oexAmount.plus(gasValue);
      if (valueAddGasFee.comparedTo(maxValue) > 0) {
        Notification.displayWarningInfo(T('余额不足'));
        return;
      }
    }
    this.setState({ txInfoVisible: false });
    const gasInfo = { gasPrice: '0x' + new BigNumber(this.state.gasPrice).shiftedBy(9).toString(16), gasLimit: '0x' + new BigNumber(this.state.gasLimit).toString(16) };

    ethers.Wallet.fromEncryptedJson(JSON.stringify(myKeystore), this.state.password).then((wallet) => {
      this.state.callbackFunc(gasInfo, wallet.privateKey);
    });
  };

  changeTolerance = (v) => {
    if (v > 0) {
      this.setState({ selectedTolerance: v, toleranceInputEnable: false });
    } else {
      this.setState({ toleranceInputEnable: true });
    }
  };

  updateToValue = () => {
    const { fromInfo, toInfo, curPairInfo, selectedTolerance, inputTolerance } = this.state;
    if (fromInfo.selectAssetInfo == null || toInfo.selectAssetInfo == null) return;

    const firstAssetId = fromInfo.selectAssetInfo.assetid == '0' ? this.state.WETH.assetid : fromInfo.selectAssetInfo.assetid;
    if (this.isPairNormal() && fromInfo.value > 0) {
      const toDecimals = toInfo.selectAssetInfo.decimals;
      if (!this.state.bLiquidOp) {
        this.getOutAmount(curPairInfo.pairAddr, this.state.fromInfo.value).then((outAmount) => {
          //outAmount = new BigNumber(outAmount).shiftedBy(this.state.toInfo.selectAssetInfo.decimals * -1).toString();
          this.state.toInfo.value = outAmount.toFixed(toDecimals, 1);
          const tolerance = selectedTolerance > 0 ? selectedTolerance : inputTolerance * 10;
          curPairInfo.minReceivedAmount = outAmount.multipliedBy(1000 - tolerance).dividedBy(1000).toFixed(6).toString().replace(/(?:\.0*|(\.\d+?)0+)$/,'$1');
          
          const fromValue = new BigNumber(fromInfo.value).shiftedBy(fromInfo.selectAssetInfo.decimals);
          const toValue = new BigNumber(this.state.toInfo.value).shiftedBy(toInfo.selectAssetInfo.decimals);
          var oldPrice = 0;
          var newPrice = 0;
          var deltaDecimals = 0;       
          if (firstAssetId.toUpperCase() == curPairInfo.firstAssetId.toUpperCase()) {
            deltaDecimals = toInfo.selectAssetInfo.decimals - fromInfo.selectAssetInfo.decimals;
            oldPrice = curPairInfo.firstAssetNumber.shiftedBy(deltaDecimals).dividedBy(curPairInfo.secondAssetNumber);
            newPrice = curPairInfo.firstAssetNumber.plus(fromValue).shiftedBy(deltaDecimals).dividedBy(curPairInfo.secondAssetNumber.minus(toValue));
            curPairInfo.impactedPricePercent = newPrice.minus(oldPrice).dividedBy(oldPrice).multipliedBy(100).toFixed(2);
          } else {
            deltaDecimals = fromInfo.selectAssetInfo.decimals - toInfo.selectAssetInfo.decimals;
            oldPrice = curPairInfo.firstAssetNumber.shiftedBy(deltaDecimals).dividedBy(curPairInfo.secondAssetNumber);
            newPrice = curPairInfo.firstAssetNumber.minus(toValue).shiftedBy(deltaDecimals).dividedBy(curPairInfo.secondAssetNumber.plus(fromValue));
            curPairInfo.impactedPricePercent = oldPrice.minus(newPrice).dividedBy(oldPrice).multipliedBy(100).toFixed(2);
          }
          curPairInfo.oldPrice = oldPrice;
          curPairInfo.newPrice = newPrice;
          
          console.log(oldPrice.toFixed(6), newPrice.toFixed(6), curPairInfo.impactedPricePercent);
              
          this.setState({ toInfo: this.state.toInfo, curPairInfo });
        });
      } else {
        this.getPairByAddr(curPairInfo.pairAddr).then((pairInfo) => {
          var outValue;
          const fromAmount = new BigNumber(fromInfo.value).shiftedBy(fromInfo.selectAssetInfo.decimals - toDecimals);
          if (firstAssetId == pairInfo.firstAssetId) {
            outValue = pairInfo.secondAssetNumber.multipliedBy(fromAmount).dividedBy(pairInfo.firstAssetNumber);
          } else {
            outValue = pairInfo.firstAssetNumber.multipliedBy(fromAmount).dividedBy(pairInfo.secondAssetNumber);
          }
          if (outValue.toNumber() == 0) {
            outValue = new BigNumber(1).shiftedBy(toDecimals * -1).toFixed(toDecimals);
          } else {
            outValue = outValue
              .shiftedBy(toDecimals)
              .plus(1)
              .shiftedBy(toDecimals * -1)
              .toFixed(toDecimals);
          }
          this.state.toInfo.value = outValue;
          this.setState({ toInfo: this.state.toInfo });
        });
      }
    }
  };

  isPairNormal = () => {
    return this.state.curPairInfo.exist == true;
  };

  onInputRemovedLiquidOK = () => {
    if (this.state.liquidToBeRemoved == null) {
      Notification.displayWarningInfo('请输入流动性数值');
      return;
    }
    if (new BigNumber(this.state.liquidToBeRemoved).gt(this.state.curPairInfo.userLiquid)) {
      Notification.displayWarningInfo('输入的流动性数值已大于您可移除的上限');
      return;
    }
    this.setState({ userRemovedLiquidVisible: false, callbackFunc: this.removeLiquidity, txInfoVisible: true });
  };

  changeLiquidityOp = (v) => {
    this.state.bLiquidOp = v;
    this.updateToValue();
    this.setState({ bLiquidOp: v });
  };

  showAllPairs = () => {
    this.setState({ pairListVisible: true });
  };

  showTxTable = () => {
    this.setState({ myTxInfoVisible: true });
  };

  showMiningInfo = () => {
    this.setState({ minerInfoDialogVisible: true });
    // Notification.displayNotice(T('敬请期待'));
    // this.getMiningOEXPerBlock();
    // this.getMyHavestOEX();
    // this.getMiningSettings();
    // this.setState({ miningVisible: true });
  };

  startHarvest = () => {
    if (this.state.miningInfo.myHavestOEX == 0) {
      Notification.displayWarningInfo('您尚无矿可提取，请努力挖矿!');
      return;
    }
    this.setState({ callbackFunc: this.harvest, txInfoVisible: true });
  };

  showInnerTxs = async (internalActions) => {
    const actions = [];
    for (const internalAction of internalActions) {
      let action = {};
      action.actionType = txParser.getActionTypeStr(internalAction.action.type);
      action.fromAccount = internalAction.action.from;
      action.toAccount = internalAction.action.to;
      action.assetId = internalAction.action.assetID;
      action.value = await this.getValue(action.assetId, internalAction.action.value);
      action.payload = internalAction.action.payload;
      actions.push(action);
    }
    this.setState({
      innerTxVisible: true,
      innerTxInfos: actions,
    });
  };

  displayAssetInfo = (value, index, pairInfo) => {
    const assetOneId = pairInfo.firstAssetId;
    const assetTwoId = pairInfo.secondAssetId;
    const assetOneInfo = this.state.assetInfoMap[assetOneId];
    const assetTwoInfo = this.state.assetInfoMap[assetTwoId];
    const assetOneSymbol = assetOneInfo ? assetOneInfo.symbol.toUpperCase() : '';
    const assetTwoSymbol = assetTwoInfo ? assetTwoInfo.symbol.toUpperCase() : '';
    return (
      <div>
        <div className="ui-color-primary" title={assetTwoInfo && assetTwoInfo.name}>
          {assetOneSymbol} [ID: {assetOneId}]
        </div>
        <div title={assetTwoInfo && assetTwoInfo.name}>
          {assetTwoSymbol} [ID: {assetTwoId}]
        </div>
      </div>
    );
  };

  displayCurLiquid = (value, index, pairInfo) => {
    const assetOneInfo = this.state.assetInfoMap[pairInfo.firstAssetId];
    const assetTwoInfo = this.state.assetInfoMap[pairInfo.secondAssetId];
    const assetOneLiquid = pairInfo.firstAssetNumber;
    const assetTwoLiquid = pairInfo.secondAssetNumber;
    if (!assetOneInfo || !assetTwoInfo) return '';
    return (
      <div>
        <div className="ui-color-primary">
          {assetOneLiquid.shiftedBy(assetOneInfo.decimals * -1).toString()} {assetOneInfo.symbol.toUpperCase()}
        </div>
        <div>
          {assetTwoLiquid.shiftedBy(assetTwoInfo.decimals * -1).toString()} {assetTwoInfo.symbol.toUpperCase()}
        </div>
      </div>
    );
  };

  displayTotalLiquid = (value, index, pairInfo) => {
    const assetOneInfo = this.state.assetInfoMap[pairInfo.firstAssetId];
    const assetTwoInfo = this.state.assetInfoMap[pairInfo.secondAssetId];
    const assetOneLiquid = pairInfo.totalLiquidOfFirstAsset;
    const assetTwoLiquid = pairInfo.totalLiquidOfSecondAsset;
    if (!assetOneInfo || !assetTwoInfo) return '';
    return (
      <div>
        <div className="ui-color-primary">
          {assetOneLiquid.shiftedBy(assetOneInfo.decimals * -1).toString()} {assetOneInfo.symbol.toUpperCase()}
        </div>
        <div>
          {assetTwoLiquid.shiftedBy(assetTwoInfo.decimals * -1).toString()} {assetTwoInfo.symbol.toUpperCase()}
        </div>
      </div>
    );
  };

  startEX = (value, index, pairInfo) => {
    return (
      <Button className="ui-button" type="primary" onClick={() => this.startExchange(pairInfo)}>
        {T('开始交易')}
      </Button>
    );
  };

  showMiningSettings = () => {
    var miningSettingInfos = [];
    this.state.miningInfo.miningSettings.map((miningSetting, index) => {
      miningSettingInfos.push(
        <p key={index}>
          阶段{index + 1}: 从区块高度{miningSetting.startBlockNumber}开始，每个区块产出:
          {new BigNumber(miningSetting.reward).shiftedBy(-18).toNumber()} OEX
        </p>
      );
    });
    return miningSettingInfos;
  };

  startExchange = (pairInfo) => {
    const assetOneInfo = this.state.assetInfoMap[pairInfo.firstAssetId];
    const assetTwoInfo = this.state.assetInfoMap[pairInfo.secondAssetId];
    const balanceInfoAssetOne = this.state.account.balances.find((v) => v.assetID == pairInfo.firstAssetId);
    const amountOfAssetOne = balanceInfoAssetOne != null ? new BigNumber(balanceInfoAssetOne.balance).shiftedBy(assetOneInfo.decimals * -1).toFixed(assetOneInfo.decimals) : 0;
    const balanceInfoAssetTwo = this.state.account.balances.find((v) => v.assetID == pairInfo.secondAssetId);
    const amountOfAssetTwo = balanceInfoAssetTwo != null ? new BigNumber(balanceInfoAssetTwo.balance).shiftedBy(assetTwoInfo.decimals * -1).toFixed(assetTwoInfo.decimals) : 0;

    assetOneInfo.assetid = assetOneInfo.assetId;
    assetTwoInfo.assetid = assetTwoInfo.assetId;
    const fromInfo = { value: '', maxValue: amountOfAssetOne, selectAssetTip: assetOneInfo.symbol.toUpperCase(), selectAssetInfo: assetOneInfo, tmpSelectAssetInfo: assetOneInfo };
    const toInfo = { value: '', maxValue: amountOfAssetTwo, selectAssetTip: assetTwoInfo.symbol.toUpperCase(), selectAssetInfo: assetTwoInfo, tmpSelectAssetInfo: assetTwoInfo };

    this.setState({ fromInfo, toInfo, pairListVisible: false });
    this.updateBaseInfoByPairInfo(pairInfo, fromInfo, toInfo);
  };

  openSwapPoolDialog() {
    // pairAssetInfoData: { firstAssetAmount, firstAssetInfo, secondAssetAmount, secondAssetInfo };
    this.setState({ swapPoolDialogData: null, swapPoolDialogVisible: true });
  }

  updateLiquidityInfo = async () => {
    // const { fromInfo, toInfo } = this.state;
    // if (fromInfo.selectAssetInfo == null || toInfo.selectAssetInfo == null) return;

    const mySwapPoolDialogData = [];
    this.state.mySwapPoolDialogData = [];
    this.setState({ mySwapPoolDialogData: [] });

    for (var pairAddr in this.state.usedPairsInfo) {
      const usedPair = this.state.usedPairsInfo[pairAddr];
      const data = {
        pairAddr,
        firstAsset: usedPair.firstAsset,
        secondAsset: usedPair.secondAsset,
        totalLiquid: 0,
        userLiquid: 0,
        myPercent: 0,
        bigRemoveNum: 0,
        firstAssetReserve: 0,
        secondAssetReserve: 0,
      };
      data.totalLiquid = await this.getPairTotalLiquid(pairAddr);
      data.userLiquid = await this.getUserLiquid(pairAddr);
      const totalLiquid = data.totalLiquid;
      const userLiquid = data.userLiquid;
      if (userLiquid.gt(new BigNumber(0))) {
        data.myPercent = userLiquid.dividedBy(totalLiquid).multipliedBy(100).toFixed(2);
        data.bigRemoveNum = userLiquid;
        const reserves = await PairUtil.getReserves(pairAddr);
        data.firstAssetReserve = new BigNumber(reserves.reserve0).multipliedBy(userLiquid).dividedBy(totalLiquid);
        data.secondAssetReserve = new BigNumber(reserves.reserve1).multipliedBy(userLiquid).dividedBy(totalLiquid);
        mySwapPoolDialogData.push(data);
        this.setState({ mySwapPoolDialogData });
      }
    }
  }

  /**
   * 用户开启【我的资金池】界面，开始加载自己的流动性数据
   */
  openMySwapPoolDialog = async () => {
    this.updateLiquidityInfo();
    this.setState({ mySwapPoolDialogVisible: true });
  }

  // 打开退出流动性弹窗
  outPoolDialogOpen(item) {
    this.state.myOutPoolDialogData = item;
    this.updateOutPoolValue(50);
    this.setState({ myOutPoolDialogVisible: true, myOutPoolDialogData: item });
  }
  outPoolAmountChange(evt) {
    const val = new BigNumber(evt.currentTarget.value);
    if (val.isNaN()) return;
    const { bigRemoveNum } = this.state.myOutPoolDialogData;
    const outPoolValue = val.shiftedBy(18).dividedBy(bigRemoveNum).multipliedBy(100).toNumber();
    this.setState({ outPoolValue, outPoolAmount: val.shiftedBy(18).toNumber(), UiProgressControlKey: ++this.state.UiProgressControlKey });
  }
  updateOutPoolValue(outPoolValue) {
    const { bigRemoveNum, firstAssetReserve, secondAssetReserve, firstAsset } = this.state.myOutPoolDialogData;
    const amount = bigRemoveNum.multipliedBy(outPoolValue).dividedBy(100).shiftedBy(-18).toNumber();
    const removedAmount0 = firstAssetReserve.multipliedBy(outPoolValue).dividedBy(100);
    const removedAmount1 = secondAssetReserve.multipliedBy(outPoolValue).dividedBy(100);
    this.setState({ outPoolValue, outPoolAmount: amount, removedAmount0, removedAmount1 });
  }
  myOutPoolSubmit() {
    this.removeLiquidity();
    this.setState({ myOutPoolDialogVisible: false });
  }

  removeLiquidity = async () => {
    const { firstAsset, secondAsset, pairAddr } = this.state.myOutPoolDialogData;
    const { outPoolAmount, removedAmount0, removedAmount1, accountAddr, selectedTolerance, inputTolerance, routerAddr, fromInfo, toInfo } = this.state;
    
    const liquidity = new BigNumber(outPoolAmount).shiftedBy(18);
    const tolerance = selectedTolerance > 0 ? selectedTolerance : inputTolerance * 10;
    const amount0Min = removedAmount0
                      .multipliedBy(1000 - tolerance)
                      .dividedBy(1000)
                      .integerValue();
    const amount1Min = removedAmount1
                      .multipliedBy(1000 - tolerance)
                      .dividedBy(1000)
                      .integerValue();
    const deadline = Math.floor(new Date().getTime() / 1000) + 600;  

    const fromAssetId = firstAsset.assetid;
    const toAssetId = secondAsset.assetid;
    const allowancedAmount = await ERC20Util.getAllowance(pairAddr, accountAddr, routerAddr);  // pairAddr同时也是ERC20地址，因为pair继承了ERC20
    if (liquidity.gt(allowancedAmount)) {
      this.state.nextStepFunc = async () => {
        await ERC20Util.approve(pairAddr, routerAddr, new BigNumber(1).shiftedBy(50));
        if (this.state.txStatus) {
          if (firstAsset.wrappedETH || secondAsset.wrappedETH) {
            const token = firstAsset.wrappedETH ? toAssetId : fromAssetId;
            const amountTokenMin = firstAsset.wrappedETH ? amount1Min : amount0Min;
            const amountETHMin = firstAsset.wrappedETH ? amount0Min : amount1Min;
            await RouterUtil.removeLiquidityETH(token, liquidity, amountTokenMin, amountETHMin, accountAddr, deadline);
          } else {
            await RouterUtil.removeLiquidity(fromAssetId, toAssetId, liquidity, amount0Min, amount1Min, accountAddr, deadline);
          }

          if (this.state.txStatus) {
            this.updateLiquidityInfo();
            this.updateBaseInfo(fromInfo, toInfo);
          }
        }
      }
      this.setState({tokenApprovedDialogVisible: true, curApprovedAssetInfo: {symbol: ''}});
    } else {
      if (firstAsset.wrappedETH || secondAsset.wrappedETH) {
        const token = firstAsset.wrappedETH ? toAssetId : fromAssetId;
        const amountTokenMin = firstAsset.wrappedETH ? amount1Min : amount0Min;
        const amountETHMin = firstAsset.wrappedETH ? amount0Min : amount1Min;
        await RouterUtil.removeLiquidityETH(token, liquidity, amountTokenMin, amountETHMin, accountAddr, deadline);
      } else {
        await RouterUtil.removeLiquidity(fromAssetId, toAssetId, liquidity, amount0Min, amount1Min, accountAddr, deadline);
      }
      if (this.state.txStatus) {
        this.updateLiquidityInfo();
        this.updateBaseInfo(fromInfo, toInfo);
      }
    }
  }

  removeLiquidity2 = (gasInfo, privateKey) => {
    const { firstAsset, pairInfo, secondAsset } = this.state.myOutPoolDialogData;
    const { outPoolAmount, contractName, accountName } = this.state;
    const liquidRemoved = '0x' + new BigNumber(outPoolAmount).shiftedBy(firstAsset.decimals - 2).toString(16);
    let actionInfo = { accountName, toAccountName: contractName, assetId: 0, amount: new BigNumber(0), remark: '' };
    let payloadInfo = { funcName: 'removeLiquidity', types: ['uint256', 'uint256'], values: [pairInfo.index, liquidRemoved] };
    oexchain.action.executeContract(actionInfo, gasInfo, payloadInfo, privateKey).then((txHash) => {
      this.checkReceipt(txHash, {
        txHash,
        actionInfo: { typeId: 1, typeName: '移除流动性', accountName, inAssetInfo: { assetInfo: firstAsset, amount: outPoolAmount }, outAssetInfo: { assetInfo: secondAsset, amount: outPoolAmount } },
      });
    });
  };

  invitationHarvest = async (gasInfo, privateKey) => {
    const account = utils.getDataFromFile(Constant.AccountObj);
    if (!account) return;
    const actionInfo = { accountName: account.accountName, toAccountName: Constant.oexswapminer, assetId: 0, amount: new BigNumber(0), remark: '' };
    const payloadInfo = { funcName: 'withdrawSpreadReward', types: [], values: [] };
    const txHash = await oexchain.action.executeContract(actionInfo, gasInfo, payloadInfo, privateKey);
    this.checkReceipt(txHash, {
      txHash,
      actionInfo: { typeId: 4, typeName: '提取雇佣奖励', accountName: account.accountName },
    });
  };
  harvest = async (gasInfo, privateKey) => {
    const account = utils.getDataFromFile(Constant.AccountObj);
    if (!account) return;
    const actionInfo = { accountName: account.accountName, toAccountName: Constant.oexswapminer, assetId: 0, amount: new BigNumber(0), remark: '' };
    const payloadInfo = { funcName: 'withdraw', types: [], values: [] };
    const txHash = await oexchain.action.executeContract(actionInfo, gasInfo, payloadInfo, privateKey);
    this.checkReceipt(txHash, { txHash, actionInfo: { typeId: 3, typeName: '提取挖矿奖励', accountName: account.accountName } });
  };

  render() {
    const fromAmountInput = (
      <div style={styles.amountInfo}>
        <div className="ui-assetSelectButton" onClick={() => this.selectFromAsset()}>
          <span>{this.state.fromInfo.selectAssetTip}</span>
          <Icon type="arrow-down" />
        </div>
        <img src={PNG_max} style={{ marginRight: '12px', cursor: 'pointer' }} onClick={() => this.inputMaxFromAmount()} />
      </div>
    );
    const toAmountInput = (
      <div style={styles.amountInfo}>
        <div className="ui-assetSelectButton" onClick={() => this.selectToAsset()}>
          <span>{this.state.toInfo.selectAssetTip}</span>
          <Icon type="arrow-down" />
        </div>
        <img src={PNG_max} style={{ marginRight: '12px', cursor: 'pointer' }} onClick={() => this.inputMaxToAmount()} />
      </div>
    );
    const symbolUnit = this.state.curPairInfo.firstAssetSymbol + '/' + this.state.curPairInfo.secondAssetSymbol;
    return (
      <div>
        <Row justify="center" align="center" style={{ height: window.innerHeight }}>
          <div style={styles.card}>
            <div style={styles.card1}>
              <div className="ui-swap-tab">
                <div className={cx({ 'ui-select': !this.state.bLiquidOp })} onClick={() => this.changeLiquidityOp(false)}>
                  {T('兑换').toLocaleUpperCase()}
                </div>
                <div className={cx({ 'ui-select': this.state.bLiquidOp })} onClick={() => this.changeLiquidityOp(true)}>
                  {T('资金池').toLocaleUpperCase()}
                </div>
              </div>
              <div className="ui-card2">
                <div style={styles.assetAmounInfo}>
                  <div>
                    <font>{T('余额：')}</font>
                    <font>{this.state.fromInfo.maxValue}</font>
                  </div>
                  {/* <font>
                    {T('通证ID：')}
                    {this.state.fromInfo.selectAssetInfo && this.state.fromInfo.selectAssetInfo.assetid}
                  </font> */}
                </div>
                <div>
                  <Input
                    size="large"
                    className="ui-card2-input"
                    value={this.state.fromInfo.value}
                    //onChange={(v) => this.changeFromValue.bind(this)}
                    onChange={(v) => {
                      this.state.fromInfo.value = v;
                      var feeAmount = new BigNumber(v).multipliedBy(this.state.feeRate).shiftedBy(-3).toFixed(6).toString();
                      const regexp = /(?:\.0*|(\.\d+?)0+)$/;
                      feeAmount = feeAmount.replace(regexp,'$1');
                      this.state.curPairInfo.feeAmount = feeAmount;
                      this.setState({ fromInfo: this.state.fromInfo, curPairInfo: this.state.curPairInfo });
                    }}
                    onBlur={() => this.updateToValue()}
                    innerAfter={fromAmountInput}
                  />
                </div>
              </div>
              <img src={PNG_transfer} style={{ marginTop: '18px', cursor: 'pointer' }} onClick={() => this.swapFromAndTo()} />
              <div className="ui-card2" style={{ marginTop: '10px' }}>
                <div style={styles.assetAmounInfo}>
                  <div>
                    <font>{T('余额：')}</font>
                    <font>{this.state.toInfo.maxValue}</font>
                  </div>
                  {/* <font>
                    {T('通证ID：')}
                    {this.state.toInfo.selectAssetInfo && this.state.toInfo.selectAssetInfo.assetid}
                  </font> */}
                </div>
                <div>
                  <Input
                    size="large"
                    className="ui-card2-input"
                    value={this.state.toInfo.value}
                    onChange={(v) => {
                      this.state.toInfo.value = v;
                      this.setState({ toInfo: this.state.toInfo });
                    }}
                    innerAfter={toAmountInput}
                  />
                </div>
                {/* </div> */}
              </div>
              <Row justify="start" align="center" className="ui-swap-info-row" style={{ marginTop: '22px' }}>
                <font>{T('可接受的最大滑点：')}</font>
                {this.state.toleranceInputEnable && (
                  <Input
                    autoFocus
                    disabled={!this.state.toleranceInputEnable}
                    value={this.state.inputTolerance}
                    onChange={(v) => this.setState({ inputTolerance: v })}
                    className="ui-inputTolerance"
                    innerAfter="%"></Input>
                )}
                <Select
                  popupClassName="ui-swap-tolerance-select-popup"
                  dataSource={this.state.toleranceData}
                  defaultValue={this.state.selectedTolerance}
                  className="ui-swap-tolerance-select"
                  onChange={(v) => this.changeTolerance(v)}
                />
              </Row>
              <Row justify="start" align="center" className="ui-swap-info-row">
                <font>{T('兑换手续费：')}</font>
                {
                  (this.state.fromInfo.selectAssetInfo != null && this.state.curPairInfo.feeAmount > 0) ? 
                  <div style={{ float: 'right' }}>(
                    {this.state.curPairInfo.feeAmount}{this.state.fromInfo.selectAssetInfo.symbol}
                    )
                  </div> : ''
                }
                <div style={{ float: 'right' }}>{this.state.feeRate / 10} %</div>
              </Row>
              <Row justify="start" align="center" className="ui-swap-info-row">
                <font>{T('您的流动性占比：')}</font>
                <div style={{ float: 'right' }}>{this.state.curPairInfo.myPercent} %</div>
              </Row>
              {
                this.state.bLiquidOp ? '' :  
                                    <Row justify="start" align="center" className="ui-swap-info-row">
                                      <font>{T('价格影响：')}</font>
                                      {
                                        (this.state.curPairInfo.oldPrice != null && this.state.curPairInfo.newPrice != null) ? 
                                          <div style={{ float: 'right' }}>
                                            (
                                            {this.state.curPairInfo.oldPrice.toFixed(2)} {'->'} {this.state.curPairInfo.newPrice.toFixed(2)}{' '} {symbolUnit}
                                            )
                                          </div> : ''
                                      }
                                      
                                      <div style={{ float: 'right' }}>{this.state.curPairInfo.impactedPricePercent} %</div>
                                    </Row>
              }
              {
                this.state.bLiquidOp ? '' :  
                                    <Row justify="start" align="center" className="ui-swap-info-row">
                                      <font>{T('最低收到：')}</font>
                                      <div style={{ float: 'right' }}>{this.state.curPairInfo.minReceivedAmount + (this.state.toInfo.selectAssetInfo ? this.state.toInfo.selectAssetInfo.symbol : '')} </div>
                                    </Row>
              }
              {this.state.bLiquidOp ? (
                <Row justify="start" align="center" className="ui-swap-info-row">
                  <font>{T('流动池数量')}</font>
                  {/* <span style={{ marginLeft: '10px', color: '#00C9A7', cursor: 'pointer' }} onClick={() => this.openSwapPoolDialog()}>
                    资金池详情 &gt;
                  </span> */}
                  {this.state.pairAssetInfo}
                  {(
                    <div className="ui-my-pairInfo" onClick={() => this.openMySwapPoolDialog()}>
                      <div></div>
                      <div>{T('我添加的流动性')}</div>
                      <div>&gt;</div>
                    </div>
                  )}
                </Row>
              ) : (
                <div>
                  <div className="ui-pairInfo">
                    <div style={{ color: '#0C5453', fontSize: '12px', textAlign: 'center', margin: '10px 0 0 0' }}>{T('当前资金池流动性总量')}</div>
                    {this.state.pairAssetInfo}
                  </div>
                </div>
              )}

              <Button className="ui-swap-submit" type="primary" onClick={() => (this.state.bLiquidOp ? this.startAddLiquidity() : this.startSwapAsset())}>
                <font size="3">{this.state.bLiquidOp ? T('添加流动性').toLocaleUpperCase() : T('兑换').toLocaleUpperCase()}</font>
              </Button>
            </div>

            {/* <div style={styles.lastLine}>
              <Button text style={{ color: '#00c9a7' }} onClick={() => this.showAllPairs()}>
                <span>{T('所有交易对')} &gt;</span>
              </Button>
              <Button text style={{ color: '#00c9a7' }} onClick={() => this.showTxTable()}>
                <span>{T('交易记录')} &gt;</span>
              </Button>
              <Button text style={{ color: '#00c9a7' }} onClick={() => this.showMiningInfo()}>
                <span>{T('挖矿信息')} &gt;</span>
              </Button>
            </div> */}
          </div>
          {/* 
          <Divider direction='ver' style={{backgroundColor: '#272a2f'}}/>

          <Card style={{height: '400px', width: '450px', backgroundColor: '#1e2125', borderRadius:'20px', marginTop: '-100px'}}>

          </Card> */}
        </Row>

        <UiDialog2 className="ui-SwapDetail" visible={this.state.swapPoolDialogVisible} title={T('资金池详情')} onCancel={() => this.setState({ swapPoolDialogVisible: false })}>
          {this.state.pairAssetInfoData ? (
            <div className="ui-dialog-data">
              <div className="ui-SwapDetail-symbol">
                <div className="ui-SwapDetail-symbol-body">
                  <div>
                    <img src={this.state.pairAssetInfoData.firstAssetInfo.assetId === 0 ? oexTokenLogo : otherTokenLogo}></img>
                    <div className="ui-div1">{this.state.pairAssetInfoData.firstAssetInfo.symbol.toLocaleUpperCase()}</div>
                    <div className="ui-div2 ui-ell2">{this.state.pairAssetInfoData.firstAssetInfo.name}</div>
                  </div>
                </div>
                <div className="ui-SwapDetail-symbol-join">+</div>
                <div className="ui-SwapDetail-symbol-body">
                  <div style={{ float: 'right' }}>
                    <img src={this.state.pairAssetInfoData.secondAssetInfo.assetId === 0 ? oexTokenLogo : otherTokenLogo}></img>
                    <div className="ui-div1">{this.state.pairAssetInfoData.secondAssetInfo.symbol.toLocaleUpperCase()}</div>
                    <div className="ui-div2 ui-ell2">{this.state.pairAssetInfoData.secondAssetInfo.name}</div>
                  </div>
                </div>
              </div>

              <div className="ui-SwapDetail-total">
                <div style={{ color: '#0C5453', fontSize: '12px', textAlign: 'center', margin: '10px 0' }}>{T('流动池数量')}</div>
                {this.state.pairAssetInfo}
              </div>

              <div class="ui-SwapDetail-accountHeader">
                <div>{T('账户列表')}</div>
                <div>{T('账户数：')}45</div>
              </div>
              <div className="ui-SwapDetail-account">
                <img className="ui-before" src={PNG_ctTop} />
                <img className="ui-after" src={PNG_ctBottom} />
                <div>
                  <div class="ui-SwapDetail-acc">
                    <div>
                      <span>sadasd**sd</span>
                      <div>
                        23434.3434 <span className="ui-primary">OEX</span>
                      </div>
                    </div>
                    <div>
                      <span className="ui-primary">占比12.9%</span>
                      <div>
                        23434.3434 <span className="ui-primary">OEX</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            ''
          )}
        </UiDialog2>

        <UiDialog2 className="ui-MySwapDetail" visible={this.state.mySwapPoolDialogVisible} title={T('我的资金池')} onCancel={() => this.setState({ mySwapPoolDialogVisible: false })}>
          {this.state.pairAssetInfoData ? (
            <div className="ui-dialog-data">
              <div className="ui-MySwapDetail-account">
                <div>
                  {this.state.mySwapPoolDialogData.map((item) => {
                    if (item.firstAsset) {
                      return (
                        <div className="ui-MySwapDetail-acc" key={item.pairAddr}>
                          <div>
                            <span>
                              {item.firstAsset.symbol.toLocaleUpperCase()} / {item.secondAsset.symbol.toLocaleUpperCase()}
                            </span>
                            <div className="ui-primary">
                              {T('占比')}
                              {item.myPercent}%
                            </div>
                          </div>
                          <div key={2}>
                            <span className="ui-primary">
                            {T('您的LP')}:{item.bigRemoveNum.shiftedBy(-18).toString()} 
                            </span>
                            <div
                              onClick={() => this.outPoolDialogOpen(item)}
                              style={{ borderRadius: '10px', padding: '0 8px', backgroundColor: '#00c9a7', color: '#555', cursor: 'pointer', transform: 'transform: scale(0.9)' }}>
                              {T('退出流动性')}
                            </div>
                          </div>
                        </div>
                      );
                    } else {
                      return <div className="ui-MySwapDetail-acc ui-loading" key={item.key}></div>;
                    }
                  })}
                </div>
              </div>
            </div>
          ) : (
            ''
          )}
        </UiDialog2>

        <UiDialog3 className="ui-MySwapDetail-Body" title={T('退出流动性')} visible={this.state.myOutPoolDialogVisible} onCancel={() => this.setState({ myOutPoolDialogVisible: false })}>
          {this.state.myOutPoolDialogData ? (
            <div className="ui-dialog-data">
              <div className="ui-MySwapDetail-BodyContent">
                <div>
                  <span style={{ fontSize: '12px', color: '#5E768B', fontWeight: '400' }}>{T('LP数量').toLocaleUpperCase()}</span>
                  <input max={this.state.bigRemoveNum} min={0} value={this.state.outPoolAmount} onChange={this.outPoolAmountChange.bind(this)}></input>
                </div>
                <div style={{ fontSize: '12px', color: '#5E768B', marginTop: '10px', textAlign: 'right' }}>
                  {this.state.removedAmount0.shiftedBy(this.state.myOutPoolDialogData.firstAsset.decimals * -1).toFixed(6)
                  + ' ' +
                  this.state.myOutPoolDialogData.firstAsset.symbol.toLocaleUpperCase()}
                </div>
                <div style={{ fontSize: '12px', color: '#5E768B', marginTop: '10px', textAlign: 'right' }}>
                  {this.state.removedAmount1.shiftedBy(this.state.myOutPoolDialogData.secondAsset.decimals * -1).toFixed(6)
                  + ' ' +
                  this.state.myOutPoolDialogData.secondAsset.symbol.toLocaleUpperCase()}
                </div>
                <UiProgressControl
                  key={this.state.UiProgressControlKey}
                  style={{ marginTop: '26px' }}
                  value={this.state.outPoolValue}
                  onUpdate={(newVal) => this.updateOutPoolValue(newVal)}>
                </UiProgressControl>
                <div className="ui-submit-danger" onClick={() => this.myOutPoolSubmit()} style={{ marginTop: '70px' }}>
                  {T('退出流动池').toLocaleUpperCase()}
                </div>
              </div>
            </div>
          ) : (
            ''
          )}
        </UiDialog3>

        <UiDialog
          className="ui-SelectAsset"
          visible={this.state.assetSelectorDialogVisible}
          title={[<Iconfont key={2} icon="asset" primary></Iconfont>, T('选择通证').toLocaleUpperCase()]}
          header={
            <div className="ui-dialog-search">
              <Input
                autoFocus
                placeholder={T('通过地址/名称搜索通证')}
                innerBefore={<Icon type="search" size="xs" onClick={() => this.searchAsset()} />}
                value={this.state.assetContent}
                onChange={(v) => this.setState({ assetContent: v })}
                onPressEnter={() => this.searchAsset()}
              />
            </div>
          }
          onOk={this.onSelectAssetOK.bind(this)}
          onCancel={() => this.setState({ assetSelectorDialogVisible: false })}>
          <Row wrap justify="start" className="ui-dialog-data">
            {this.state.assetDisplayList.map((assetInfo) => assetInfo)}
          </Row>
        </UiDialog>

        <UiDialog4
          className="ui-MinerInfo"
          visible={this.state.minerInfoDialogVisible}
          title={[<Iconfont key={2} icon="wa" primary></Iconfont>, T('挖矿信息').toLocaleUpperCase()]}
          onOk={() => this.setState({ minerInfoDialogVisible: false })}
          onCancel={() => this.setState({ minerInfoDialogVisible: false })}>
          <MinerInfo></MinerInfo>
        </UiDialog4>

        <UiDialog
          className="ui-TokenApprove"
          visible={this.state.tokenApprovedDialogVisible}
          title={[<Iconfont key={2} icon="asset" primary></Iconfont>, T('授权操作').toLocaleUpperCase() + '--' + this.state.curApprovedAssetInfo.symbol]}
          onOk={() => this.state.nextStepFunc()}
          onCancel={() => this.setState({ tokenApprovedDialogVisible: false })}>
            <Row justify="center" align="center" style={{height: 150}}>
              {T('点击确认进行代币授权操作，授权成功后方可进行后续操作')} 
            </Row>
          
        </UiDialog>

        <Dialog
          style={{ width: '600px', padding: 0 }}
          visible={this.state.userRemovedLiquidVisible}
          title={T('输入待移除的流动性数值')}
          footerAlign="center"
          closeable="esc,mask,close"
          onOk={this.onInputRemovedLiquidOK.bind(this)}
          onCancel={() => this.setState({ userRemovedLiquidVisible: false })}
          onClose={() => this.setState({ userRemovedLiquidVisible: false })}>
          <Input
            autoFocus
            placeholder={this.state.maxLiquidTip + this.state.curPairInfo.userLiquid}
            style={{ width: '100%' }}
            innerBefore={T('流动性数值')}
            value={this.state.liquidToBeRemoved}
            onChange={(v) => this.setState({ liquidToBeRemoved: v })}
            onPressEnter={() => this.onInputRemovedLiquidOK()}
          />
        </Dialog>

        <Dialog
          style={{ width: '600px', padding: 0, color: 'white' }}
          visible={this.state.miningVisible}
          title={T('挖矿信息')}
          footerAlign="center"
          closeable="esc,mask,close"
          onOk={() => this.setState({ miningVisible: false })}
          onCancel={() => this.setState({ miningVisible: false })}
          onClose={() => this.setState({ miningVisible: false })}>
          <Row style={{ color: 'white', marginLeft: '10px', marginTop: '10px' }}>当前每区块挖矿量: {this.state.miningInfo.curMiningOEX} OEX</Row>
          <Row style={{ color: 'white', margin: '20px 0 0 10px', alignItems: 'center' }}>
            我可提取的挖矿量: {this.state.miningInfo.myHavestOEX} OEX
            <Button type="primary" style={{ marginLeft: '10px', borderRadius: '10px' }} onClick={() => this.startHarvest()}>
              提取
            </Button>
          </Row>
          <Row style={{ color: 'white', marginLeft: '10px', marginTop: '10px' }}>当前挖矿计划:</Row>
          <Row style={{ color: 'white', marginLeft: '10px', marginTop: '10px' }}>当前挖矿计划:</Row>
          {this.state.miningInfo.miningSettings.map((miningSetting, index) => {
            return (
              <Row key={index} style={{ color: 'white', marginLeft: '40px', marginTop: '10px' }}>
                阶段{index + 1}: 从区块高度{miningSetting.startBlockNumber}开始，每个区块产出: {new BigNumber(miningSetting.reward).shiftedBy(-18).toNumber()} OEX
              </Row>
            );
          })}
          <Row style={{ color: 'white', margin: '20px 0 0 10px', alignItems: 'center' }}>
            挖矿规则: <br />
          </Row>
          <Row style={{ color: 'white', margin: '10px 0 0 40px', alignItems: 'center' }}>
            1: 交易对必须包含OEX <br />
            2: 参与此交易对账号数必须达到7个 <br />
            3: 每个账号按照参与交易的OEX数量瓜分每个区块产出的OEX <br />
            4: 所有交易对共享每个区块产出的OEX <br />
            5: 产出的OEX来自基金会，并非额外增发
          </Row>
        </Dialog>
        <Dialog
          style={{ width: '400px', padding: 0 }}
          visible={this.state.txInfoVisible}
          title="发起交易"
          footerAlign="center"
          closeable="esc,mask,close"
          onOk={this.onTxConfirmOK.bind(this)}
          onCancel={() => this.setState({ txInfoVisible: false })}
          onClose={() => this.setState({ txInfoVisible: false })}>
          <Input
            autoFocus
            style={{ width: '100%' }}
            innerBefore="Gas单价"
            innerAfter="Gaoex"
            placeholder={'建议值:' + this.state.suggestionPrice}
            value={this.state.gasPrice}
            onChange={(v) => this.setState({ gasPrice: v })}
          />
          <div style={{ color: '#fff' }}>
            1Gaoex = 10<sup>-9</sup>oex = 10<sup>9</sup>aoex
          </div>

          <br />
          <Input style={{ width: '100%' }} innerBefore="Gas上限" value={this.state.gasLimit} onChange={(v) => this.setState({ gasLimit: v })} />
          <br />
          <br />
          <Input
            hasClear
            style={{ width: '100%' }}
            htmlType="password"
            onChange={(v) => this.setState({ password: v })}
            innerBefore={T('钱包密码')}
            size="medium"
            value={this.state.password}
            maxLength={20}
            hasLimitHint
            onPressEnter={this.onTxConfirmOK.bind(this)}
          />
        </Dialog>

        <UiDialog
          className="ui-pairList"
          visible={this.state.myTxInfoVisible}
          title={[<Iconfont key={2} icon="history" primary></Iconfont>, T('交易记录')]}
          onOk={() => this.setState({ myTxInfoVisible: false })}
          onCancel={() => this.setState({ myTxInfoVisible: false })}>
          <IceContainer className="ui-dialog-data">
            <div className="ui-pairList-tr"></div>
            <Table dataSource={this.state.txInfoList} hasBorder={false} language={T('zh-cn')} resizable>
              <Table.Column title={T('交易时间')} dataIndex="time" width={144} cell={txInfoColume.time} />
              <Table.Column title={T('交易哈希值')} dataIndex="txHash" width={200} cell={txInfoColume.txHash} />
              <Table.Column title={T('发起账号')} dataIndex="actionInfo" width={140} cell={txInfoColume.accountName} />
              <Table.Column title={T('操作类型')} dataIndex="actionInfo" width={140} cell={TUP(txInfoColume.typeName)} />
              <Table.Column title={T('状态')} dataIndex="status" width={110} cell={txInfoColume.status} />
              <Table.Column title={T('通证1')} dataIndex="actionInfo" width={110} cell={txInfoColume.processAssetInfo.bind(this, 0)} />
              <Table.Column title={T('通证2')} dataIndex="actionInfo" width={110} cell={txInfoColume.processAssetInfo.bind(this, 1)} />
            </Table>
          </IceContainer>
        </UiDialog>

        <UiDialog
          className="ui-pairList"
          visible={this.state.pairListVisible}
          title={[<Iconfont key={2} icon="swap" primary></Iconfont>, T('所有交易对')]}
          onOk={() => this.setState({ pairListVisible: false })}
          onCancel={() => this.setState({ pairListVisible: false })}>
          <IceContainer className="ui-dialog-data">
            <div className="ui-pairList-tr"></div>
            <Table fixedHeader={true} maxBodyHeight="484px" dataSource={this.state.pairList} hasBorder={false} language={T('zh-cn')} resizable>
              <Table.Column title={T('交易对')} dataIndex="firstAssetId" width={230} cell={this.displayAssetInfo.bind(this)} />
              <Table.Column title={T('当前流通量')} dataIndex="firstAssetNumber" width={260} cell={this.displayCurLiquid.bind(this)} />
              <Table.Column title={T('总交易量')} dataIndex="totalLiquidOfFirstAsset" width={410} cell={this.displayTotalLiquid.bind(this)} />
              <Table.Column title={T('操作')} dataIndex="totalLiquidOfFirstAsset" width={120} cell={this.startEX.bind(this)} />
            </Table>
          </IceContainer>
        </UiDialog>
      </div>
    );
  }
}

const styles = {
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: '100px',
  },
  card1: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    height: '620px',
    width: '420px',
    backgroundColor: '#fff',
    borderRadius: '36px',
    marginTop: '-100px',
    boxShadow: '0px 3px 6px rgba(0, 0, 0, 0.16)',
    position: 'relative',
  },
  lastLine: {
    display: 'flex',
    justifyContent: 'space-between',
    width: '100%',
    color: 'white',
    marginTop: '18px',
    padding: '0 10px',
    //flexDirection: 'row',
    //alignItems: 'center'
  },
  maxBtn: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '40px',
    flexShrink: 0,
    borderRadius: '10px',
    backgroundColor: '#3080FE',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0)',
  },
  select: {
    display: 'flex',
    alignItems: 'center',
    borderRadius: '10px',
    height: '100%',
    backgroundColor: '#272a2f',
    border: '0 solid rgba(255,255,255,0)',
  },
  assetAmounInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '5px 10px 0 10px',
  },
  amountInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: '100%',
  },
};

// 交易记录列数据渲染
const txInfoColume = {
  time: (value) => (
    <div style={{ fontSize: '12px' }}>
      <span style={{ color: '#141426' }}>{value.replace(/\ (.*)/, '').replace(/\//g, '-')}</span>
      <span style={{ marginLeft: '4px', color: '#8687A3' }}>{value.replace(/(.*)\ /, '')}</span>
    </div>
  ),
  txHash: (value) => (
    <a style={{ color: '#23C9A7', fontSize: '12px' }} target="_blank" className="blockNumber" href={'https://oexchain.com/#/Transaction?' + value}>
      {value.substr(0, 8) + '...' + value.substr(value.length - 6)}
    </a>
  ),
  accountName: (info) => <span style={{ color: '#141426', fontSize: '12px' }}>{info.accountName}</span>,
  typeName: (info) => <span style={{ color: '#141426', fontSize: '12px' }}>{T(info.typeName).toLocaleUpperCase()}</span>,
  status: (v) => (v == 0 ? <span style={{ color: '#FF5F6D', fontSize: '12px' }}>{T('失败')}</span> : <span style={{ color: '#00C9A7', fontSize: '12px' }}>{T('成功')}</span>),
  processAssetInfo: (assetNo, value, index, record) => {
    if (record.status == 0) return <span style={{ fontSize: '12px' }}>-</span>;
    if (value.typeId == 0) {
      // 添加流动性
      var assetAmount = assetNo == 0 ? value.inAssetInfo.amount : value.outAssetInfo.amount;
      assetAmount += ' ' + (assetNo == 0 ? value.inAssetInfo.assetInfo.symbol : value.outAssetInfo.assetInfo.symbol).toUpperCase();
      return <span style={{ fontSize: '12px' }}>{assetAmount}</span>;
    }
    if (value.typeId == 1) {
      // 移除流动性
      const actionOne = record.innerActions[0].action;
      const actionTwo = record.innerActions[1].action;
      if (!value.inAssetInfo) return null;
      if (!value.outAssetInfo) return null;
      const assetOneInfo = value.inAssetInfo.assetInfo;
      const assetTwoInfo = value.outAssetInfo.assetInfo;
      if (assetNo == 0) {
        if (actionOne.assetID == assetOneInfo.assetid) {
          return <span style={{ fontSize: '12px' }}>{new BigNumber(actionOne.value).shiftedBy(assetOneInfo.decimals * -1).toString() + ' ' + assetOneInfo.symbol.toUpperCase()}</span>;
        }
        return <span style={{ fontSize: '12px' }}>{new BigNumber(actionTwo.value).shiftedBy(assetOneInfo.decimals * -1).toString() + ' ' + assetOneInfo.symbol.toUpperCase()}</span>;
      } else {
        if (actionTwo.assetID == assetTwoInfo.assetid) {
          return <span style={{ fontSize: '12px' }}>{new BigNumber(actionTwo.value).shiftedBy(assetTwoInfo.decimals * -1).toString() + ' ' + assetTwoInfo.symbol.toUpperCase()}</span>;
        }
        return <span style={{ fontSize: '12px' }}>{new BigNumber(actionOne.value).shiftedBy(assetTwoInfo.decimals * -1).toString() + ' ' + assetTwoInfo.symbol.toUpperCase()}</span>;
      }
    }
    if (value.typeId == 2) {
      // 兑换
      const actionOne = record.innerActions[0].action;
      // const actionTwo = record.innerActions[1].action;
      var action = actionOne.value > 0 ? actionOne : record.innerActions[1].action;
      if (assetNo == 0) {
        return <span style={{ fontSize: '12px' }}>{value.inAssetInfo.amount + ' ' + value.inAssetInfo.assetInfo.symbol.toUpperCase()}</span>;
      } else {
        return (
          <span style={{ fontSize: '12px' }}>
            {new BigNumber(action.value).shiftedBy(value.outAssetInfo.assetInfo.decimals * -1).toString() + ' ' + value.outAssetInfo.assetInfo.symbol.toUpperCase()}
          </span>
        );
      }
    }
    if (value.typeId == 3) {
      // 提取挖矿
    }
  },
};
