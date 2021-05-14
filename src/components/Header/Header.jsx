/* eslint-disable prefer-template */
/* eslint jsx-a11y/no-noninteractive-element-interactions:0 */
import React, { PureComponent } from 'react';
import { Icon, Select, Dialog, Feedback, Grid } from '@icedesign/base';
import Layout from '@icedesign/layout';
import StyledMenu, { Item as MenuItem, SubMenu } from '@icedesign/styled-menu';

import { Input, Button, Balloon } from '@alifd/next';
import cookie from 'react-cookies';
import axios from 'axios';
import { createHashHistory } from 'history';
import cx from 'classnames';
import copy from 'copy-to-clipboard';
import { Link } from 'react-router-dom';
import * as oexchain from 'oex-web3';
import { ethers } from 'ethers';
import EthCrypto, { sign } from 'eth-crypto';
import * as ethUtil from 'ethereumjs-util';
import { headerMenuConfig } from '../../menuConfig';
import Logo from '../Logo';
import * as utils from '../../utils/utils';
import * as constant from '../../utils/constant';
import { T, setLang } from '../../utils/lang';
import eventProxy from '../../utils/eventProxy';
import Web3 from 'web3';
import BigNumber from 'bignumber.js';
import './scss/ui.scss';
import { Iconfont } from '../Ui/iconfont';
import { UiDialog } from '../Ui/UiDialog';
import HireMiner from '../../components/HireMiner';
import SwapMiner from '../../components/SwapMiner';
import { UiDialog4 } from '../../components/Ui/UiDialog4';

// import { BigNumber } from 'ethers/utils';
const { Row } = Grid;
export const history = createHashHistory();
const keyMap = { dashboard: '0', Block: '1', Transaction: '2', assetOperator: '3', contractDev: '4', producerList: '5' };
const PNG_lang_en = require('./images/en.png');
const PNG_lang_ch = require('./images/ch.png');
const logo_img = require('./images/logo_s.png');

export default class Header extends PureComponent {
  constructor(props) {
    super(props);
    const nodeInfoCookie = cookie.load('nodeInfo');
    const defaultLang = cookie.load('defaultLang');

    let nodeInfo = nodeInfoCookie;
    if (utils.isEmptyObj(nodeInfo)) {
      nodeInfo = constant.mainNetRPCHttpsAddr;
    }
    const account = utils.getDataFromFile(constant.AccountObj);

    var upAccountId = 0;
    const index = window.location.href.indexOf('?id=');
    if (index > -1) upAccountId = parseInt(window.location.href.substr(index + 4));

    this.state = {
      web3: null,
      upAccountId,
      txInfoVisible: false,
      current: keyMap[props.location.pathname.substr(1)],
      nodeConfigVisible: false,
      accountConfigVisible: false,
      spreadInfoDialogVisible: false,

      swapMinerDialogVisible: false,
      hireMinerDialogVisible: false,

      walletBtnInfo: '连接钱包',
      ethAccount: '',
      account: account,
      accountName: account != null ? account.accountName : '',
      privateKey: '',
      password: '',
      nodeInfo,
      chainId: 0,
      sysTokenID: 0,
      callbackFunc: null,
      customNodeDisabled: true,
      spreadInfo: { yourUrl: account == null ? '登录账户后才能生成您的推广链接' : 'https://oexswap.com?id=' + account.accountID, downAccountNum: 0, downAccountNames: [], totalReward: 0 },
      languages: [
        { value: 'ch', label: '中文' },
        { value: 'en', label: 'English' },
      ],
      curLang: defaultLang == null || defaultLang == 'ch' ? 'English' : '中文',
      defaultLang,
      nodes: [
        { value: constant.mainNet1RPCHttpsAddr, label: T('主网1：') + constant.mainNet1RPCHttpsAddr },
        { value: constant.mainNet2RPCHttpsAddr, label: T('主网2：') + constant.mainNet2RPCHttpsAddr },
        { value: 'others', label: T('自定义') },
      ],
    };
    setLang(this.state.defaultLang);
  }
  componentDidMount = async () => {
    // eventProxy.on('importAccountInfo', () => {
    //   this.setState({ accountConfigVisible: true });
    // });
    // if (this.state.accountName == '') {
    //   this.setState({ accountConfigVisible: true });
    // }
    this.initMetamaskNetwork();
  };

  componentWillReceiveProps(nextProps) {
    this.setState({ current: keyMap[nextProps.location.pathname.substr(1)] });
  }

  openSetDialog = () => {
    this.setState({ nodeConfigVisible: true });
  };
  handleNodeInfoChange = (v) => {
    this.state.nodeInfo = v;
  };
  onChangeLanguage = () => {
    let languageType = 'ch';
    if (this.state.curLang == 'English') {
      languageType = 'en';
    }
    cookie.save('defaultLang', languageType, { path: '/', maxAge: 3600 * 24 * 360 });
    setLang(languageType);
    history.go(0);
    //    history.push('/');
  };
  onChangeNode = (type, value) => {
    cookie.save('defaultNode', value, { path: '/', maxAge: 3600 * 24 * 360 });
    this.setState({ customNodeDisabled: value != 'others', nodeInfo: value });
  };
  onConfigNodeOK = async () => {
    const nodeInfo = this.state.nodeInfo.indexOf('http://') == 0 || this.state.nodeInfo.indexOf('https://') == 0 ? this.state.nodeInfo : 'http://' + this.state.nodeInfo;
    cookie.save('nodeInfo', nodeInfo, { path: '/', maxAge: 3600 * 24 * 360 });
    axios.defaults.baseURL = nodeInfo;
    await oexchain.utils.setProvider(nodeInfo);
    const chainConfig = await oexchain.oex.getChainConfig(false);
    this.setState({ nodeConfigVisible: false, nodeInfo, chainId: chainConfig.chainId });
    //location.reload(true);
  };

  onConfigAcountOK = () => {
    const { accountName, privateKey, password } = this.state;
    if (!ethUtil.isValidPrivate(Buffer.from(utils.hex2Bytes(privateKey)))) {
      Feedback.toast.error(T('无效私钥！'));
      return;
    }
    oexchain.account.getAccountByName(accountName).then((account) => {
      if (account != null) {
        const accountPublicKey = account['authors'][0]['owner'];
        var publicKey = EthCrypto.publicKeyByPrivateKey(privateKey);
        publicKey = utils.getPublicKeyWithPrefix(publicKey);
        if (accountPublicKey != publicKey) {
          Feedback.toast.error(T('账号同此私钥不匹配！'));
          return;
        }
        Feedback.toast.success(T('开始导入账户'));
        let wallet = new ethers.Wallet(privateKey);
        wallet
          .encrypt(password, null)
          .then((keystore) => {
            keystore = JSON.parse(keystore);
            keystore['publicKey'] = publicKey;
            utils.storeDataToFile(constant.AccountObj, account);
            utils.storeDataToFile(constant.KeyStore, keystore);
            Feedback.toast.success(T('成功导入账户'));
            this.setState({ accountConfigVisible: false, privateKey: '', password: '' });
            //
            if (this.state.upAccountId > 0) {
              oexchain.account.getAccountById(this.state.upAccountId).then((upAccount) => {
                if (upAccount != null) {
                  this.processUpAccount(account.accountID, privateKey).then((txhash) => {
                    console.log(txhash);
                    location.reload(true);
                  });
                } else {
                  location.reload(true);
                }
              });
            } else {
              location.reload(true);
            }
          })
          .catch((error) => Feedback.toast.error(T('账户导入失败')));
      } else {
        Feedback.toast.error(T('账户不存在'));
      }
    });
  };

  processUpAccount = async (accountId, privateKey) => {
    return this.getUpAccount(accountId).then((upAccountId) => {
      if (upAccountId == 0) {
        const gasInfo = { gasPrice: '0x' + new BigNumber(100).shiftedBy(9).toString(16), gasLimit: '0x' + new BigNumber(1000000).toString(16) };
        return this.registerUpAccount(gasInfo, privateKey);
      }
    });
  };

  handleAccountNameChange = (v) => {
    this.setState({ accountName: v });
  };

  handlePrivateKeyChange = (v) => {
    this.setState({ privateKey: v });
  };

  handlePasswordChange = (v) => {
    this.setState({ password: v });
  };

  handleUpAccountNameChange = (v) => {
    this.setState({ upAccountName: v });
  };

  handleClick = (e) => {
    this.setState({
      current: e.key,
    });
  };

  initMetamaskNetwork = async () => {
    if (!window.ethereum && !window.web3) { //用来判断你是否安装了metamask
      Feedback.toast.error('请安装MetaMask');
    } else {
      if (window.ethereum) {
        try {
          // 请求用户授权
          await window.ethereum.enable();
          ethereum.on('chainChanged', (chainId) => {
            history.go(0);
          });
          ethereum.on('accountsChanged', (chainId) => {
            history.go(0);
          });
          if (window.ethereum.networkVersion != '56' && window.ethereum.networkVersion != '128') {
            Feedback.toast.error("请将MetaMask连接到BSC或Heco网络，否则您无法正常使用本网站");
          } else {
            this.state.chainId = window.ethereum.networkVersion;
            this.state.web3 = new Web3(window.ethereum);
            this.state.web3.eth.getAccounts().then(accounts => {
              const simpleAccount = accounts[0].substr(0, 6) + '...' + accounts[0].substr(accounts[0].length - 3);
              eventProxy.trigger('web3Inited', {web3: this.state.web3, chainId: this.state.chainId, accountAddr: accounts[0]});
              this.setState({ethAccount: accounts[0], walletBtnInfo: simpleAccount});
            });
            //history.go(0);
          }
        } catch (error) {
          // 用户不授权时
          Feedback.toast.error("MetaMask授权失败，会导致您无法正常使用本网站");
          return;
        }        
      }     
    }
  }

  manageAccount = () => {
    this.initMetamaskNetwork();    
  };

  copyValue = (value) => {
    copy(value);
    Feedback.toast.success(T('已复制到粘贴板'));
  };

  showMiningInfo() {
    eventProxy.trigger('showMiningInfo');
  }

  render() {
    const defaultTrigger = (
      <Button text type="normal" style={{ color: '#808080', marginRight: '30px' }} onClick={this.openSetDialog.bind(this)}>
        <Iconfont style={{ marginRight: '8px', fontSize: '16px' }} icon="node" primary />
        {T('设置接入节点')}
      </Button>
    );
    const accountBtnTrigger = (
      <Button text type="normal" style={{ color: '#808080', marginRight: '30px' }} onClick={this.manageAccount.bind(this)}>
        <Iconfont icon="account" style={{ marginRight: '8px', fontSize: '16px' }} primary></Iconfont>
        {T(this.state.walletBtnInfo)}
      </Button>
    );
    const { isMobile, theme, width, className, style, location } = this.props;
    const { pathname } = location;

    return (
      <header theme={theme} className={cx('ui-layout-header')}>
        <Logo />
        <div className="ui-layout-header-menu">
          {/* <div className="ui-header-btn" style={{ marginRight: '30px' }} onClick={() => this.showMiningInfo()}>
            <Iconfont icon="wa"></Iconfont>
            <span>{T('挖矿信息')}</span>
            <Iconfont icon="hot"></Iconfont>
          </div> */}
          {/* <div className="ui-header-btn" style={{ marginRight: '114px' }} onClick={() => this.showMiningInfo()}>
            <Iconfont icon="wa"></Iconfont>
            <span>雇佣挖矿</span>
            <Iconfont icon="hot"></Iconfont>
          </div> */}
          {/* <Balloon trigger={defaultTrigger} closable={false} style={{ color: '#5e768b' }}>
            {T('当前连接的节点')}:{this.state.nodeInfo}, ChainId:{this.state.chainId}
          </Balloon> */}
          <Balloon trigger={accountBtnTrigger} closable={false} style={{ color: '#5e768b' }}>
            {T('当前网络')}:{this.state.chainId == 56 ? 'BSC' : (this.state.chainId == 128 ? 'Heco' : '未知')}
          </Balloon>
          {/* <Button text type="normal" style={{ color: '#00C9A7', marginRight: '50px' }} onClick={() => this.setState({ spreadInfoDialogVisible: true })}>
            <Iconfont icon="gift" style={{ marginRight: '8px', fontSize: '16px' }} primary></Iconfont>
            {T('邀请奖励')}
          </Button> */}
          {/* <Button text type="normal" style={{ color: '#808080', marginLeft: '30px' }} onClick={this.onChangeLanguage.bind(this)}>
            {this.state.curLang}
          </Button> */}

          {/* {this.state.defaultLang == null || this.state.defaultLang == 'ch' ? (
            <img src={PNG_lang_en} style={{ position: 'relative', top: '3px', cursor: 'pointer' }} onClick={this.onChangeLanguage.bind(this)}></img>
          ) : (
            <img src={PNG_lang_ch} style={{ position: 'relative', top: '3px', cursor: 'pointer' }} onClick={this.onChangeLanguage.bind(this)}></img>
          )} */}

          <UiDialog4
            className="ui-SwapMiner"
            visible={this.state.swapMinerDialogVisible}
            title={[<Iconfont key={2} icon="wa" primary></Iconfont>, T('交易挖矿').toLocaleUpperCase()]}
            onOk={() => this.setState({ swapMinerDialogVisible: false })}
            onCancel={() => this.setState({ swapMinerDialogVisible: false })}>
            <SwapMiner></SwapMiner>
          </UiDialog4>
          <UiDialog4
            className="ui-HireMiner"
            visible={this.state.hireMinerDialogVisible}
            title={[<Iconfont key={2} icon="wa" primary></Iconfont>, T('雇佣挖矿').toLocaleUpperCase()]}
            onOk={() => this.setState({ hireMinerDialogVisible: false })}
            onCancel={() => this.setState({ hireMinerDialogVisible: false })}>
            <HireMiner></HireMiner>
          </UiDialog4>

          <UiDialog
            className="ui-nodeInfo"
            visible={this.state.nodeConfigVisible}
            title={T('配置需连接的节点')}
            onOk={this.onConfigNodeOK.bind(this)}
            onCancel={() => this.setState({ nodeConfigVisible: false })}>
            <div className="ui-dialog-data">
              <Select
                language={T('zh-cn')}
                style={{ width: 400 }}
                placeholder={T('选择节点')}
                onChange={this.onChangeNode.bind(this, 'nodeInfo')}
                value={this.state.nodeInfo}
                defaultValue={constant.mainNet1RPCHttpsAddr}
                dataSource={this.state.nodes}
              />
              <br />
              <br />
              <Input
                hasClear
                disabled={this.state.customNodeDisabled}
                onChange={this.handleNodeInfoChange.bind(this)}
                style={{ width: 400 }}
                innerBefore="RPC URL"
                size="medium"
                defaultValue={this.state.nodeInfo}
                maxLength={150}
                hasLimitHint
              />
            </div>
          </UiDialog>

          <Dialog
            language={T('zh-cn')}
            visible={this.state.accountConfigVisible}
            title={T('导入账号信息')}
            footerActions="ok"
            footerAlign="center"
            closeable="true"
            onOk={this.onConfigAcountOK.bind(this)}
            onCancel={() => this.setState({ accountConfigVisible: false })}
            onClose={() => this.setState({ accountConfigVisible: false })}>
            <Input
              hasClear
              onChange={this.handleAccountNameChange.bind(this)}
              style={{ width: 300 }}
              innerBefore={T('账号')}
              size="medium"
              value={this.state.accountName}
              maxLength={32}
              hasLimitHint
            />
            <br />
            <br />
            <Input
              hasClear
              onChange={this.handlePrivateKeyChange.bind(this)}
              style={{ width: 300 }}
              innerBefore={T('私钥')}
              size="medium"
              defaultValue={this.state.privateKey}
              maxLength={66}
              hasLimitHint
            />
            <br />
            <br />
            <Input
              htmlType="password"
              hasClear
              onPressEnter={this.onConfigAcountOK.bind(this)}
              onChange={this.handlePasswordChange.bind(this)}
              style={{ width: 300 }}
              innerBefore={T('密码')}
              size="medium"
              defaultValue={this.state.password}
              maxLength={30}
              hasLimitHint
            />
          </Dialog>
          <Dialog
            style={{ width: '600px', padding: 0, color: 'white' }}
            visible={this.state.spreadInfoDialogVisible}
            title={T('推广信息')}
            footerAlign="center"
            closeable="esc,mask,close"
            onOk={() => this.setState({ spreadInfoDialogVisible: false })}
            onCancel={() => this.setState({ spreadInfoDialogVisible: false })}
            onClose={() => this.setState({ spreadInfoDialogVisible: false })}>
            <Row style={{ color: '#999', marginLeft: '10px', marginTop: '10px', alignItems: 'center' }}>
              {T('您的推广链接')}: {this.state.spreadInfo.yourUrl}
              <Button type="primary" style={{ marginLeft: '10px', borderRadius: '10px' }} onClick={() => this.copyValue(this.state.spreadInfo.yourUrl)}>
                {T('复制')}
              </Button>
            </Row>
            <Row style={{ color: 'white', margin: '20px 0 0 10px', alignItems: 'center' }}>总推广用户数: {this.state.spreadInfo.downAccountNum}</Row>
            <Row style={{ color: 'white', marginLeft: '20px', marginTop: '10px' }}>{this.state.spreadInfo.downAccountNames.map((name) => name + ', ')}</Row>

            <Row style={{ color: 'white', margin: '20px 0 0 10px', alignItems: 'center' }}>推广奖励: {this.state.spreadInfo.totalReward}</Row>
          </Dialog>
        </div>
      </header>
    );
  }
}
