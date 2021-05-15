import React, { Component } from 'react';
import { Dialog, Select } from '@icedesign/base';
import { Input, Button, Table, Grid, Checkbox, Collapse, Message, Icon, Balloon, Divider } from '@alifd/next';
import * as ethers from 'ethers';
import BigNumber from 'bignumber.js';
import cx from 'classnames';

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
import eventProxy from '../../utils/eventProxy';

const { Row, Col } = Grid;
const PNG_max = require('./images/max.png');
const PNG_transfer = require('./images/transfer.png');


export default class Swap extends Component {
  static displayName = 'Swap';

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
    eventProxy.on('web3Inited', web3Info => {
      this.state.web3 = web3Info.web3;
      const usedPairsInfo = localStorage.getItem('usedPairsInfo');
      if (usedPairsInfo == null) {
        this.state.usedPairsInfo[web3Info.chainId] = {};
      } else {
        this.state.usedPairsInfo = JSON.parse(usedPairsInfo);
      }
      
      this.setState({chainId: web3Info.chainId, accountAddr: web3Info.accountAddr});
      this.getDefaultAssets();
      eventProxy.trigger("updateBroswerURL", this.state.broswerInfo[web3Info.chainId]);
    });
    eventProxy.on('txStatus', txStatus => {
      this.state.txStatus = txStatus;
    });

    this.state.timer = setInterval(this.updatePool.bind(this), 5000);
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
      if (!info.selectAssetInfo || !info.assetid) continue;
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
    const { usedPairsInfo, chainId, accountAddr, feeRate, WETH } = this.state;
    if (fromInfo.selectAssetInfo != null && toInfo.selectAssetInfo != null) {
      const fromAssetId = fromInfo.selectAssetInfo.assetid == '0' ? WETH.assetid : fromInfo.selectAssetInfo.assetid;
      const toAssetId = toInfo.selectAssetInfo.assetid == '0' ? WETH.assetid : toInfo.selectAssetInfo.assetid;
      //const path = await this.findBestSwapPath(new BigNumber(1).shiftedBy(18), fromAssetId, toAssetId);
      const curPairInfo = await this.getPairByAssetId(fromAssetId, toAssetId);
      if (curPairInfo.exist) {
        if (usedPairsInfo[chainId][curPairInfo.pairAddr] == null) {
          usedPairsInfo[chainId][curPairInfo.pairAddr] = {
                                                            firstAsset: (fromInfo.selectAssetInfo.assetid == '0' ? WETH : fromInfo.selectAssetInfo), 
                                                            secondAsset: (toInfo.selectAssetInfo.assetid == '0' ? WETH : toInfo.selectAssetInfo)};
          localStorage.setItem('usedPairsInfo', JSON.stringify(usedPairsInfo));
        }
        const totalLiquid = await ERC20Util.totalSupply(curPairInfo.pairAddr);
        const userLiquid = await ERC20Util.getBalance(curPairInfo.pairAddr, accountAddr);
        curPairInfo.totalLiquid = totalLiquid.multipliedBy(100);
        curPairInfo.userLiquid = userLiquid.multipliedBy(100);
        curPairInfo.myPercent = userLiquid.dividedBy(totalLiquid).multipliedBy(100).toFixed(2);
        curPairInfo.feeAmount = new BigNumber(fromInfo.value).multipliedBy(feeRate).shiftedBy(-3).toFixed(6).toString().replace(/(?:\.0*|(\.\d+?)0+)$/,'$1');
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
        // Notification.displayWarningInfo('交易路径不存在，无法交易');
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
            imgExist ? <img src={this.state.logoInfo[this.state.chainId] + (assetInfo.assetid == '0' ? assetInfo.logoAddr : assetInfo.assetid).toLowerCase() + '.png'}/>
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


  updateLiquidityInfo = async () => {
    // const { fromInfo, toInfo } = this.state;
    // if (fromInfo.selectAssetInfo == null || toInfo.selectAssetInfo == null) return;

    const mySwapPoolDialogData = [];
    this.state.mySwapPoolDialogData = [];
    this.setState({ mySwapPoolDialogData: [] });
    console.log(this.state.usedPairsInfo)
    for (var pairAddr in this.state.usedPairsInfo[this.state.chainId]) {
      const usedPair = this.state.usedPairsInfo[this.state.chainId][pairAddr];
      console.log(pairAddr, usedPair)
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
        console.log(data)
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
