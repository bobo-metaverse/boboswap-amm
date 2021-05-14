import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { ConnectedRouter } from 'react-router-redux';
import { createBrowserHistory } from 'history';
import { Feedback } from '@icedesign/base';
import './data/app';

// 载入默认全局样式 normalize 、.clearfix 和一些 mixin 方法等
import '@icedesign/base/reset.scss';

import router from './router';
import configureStore from './configureStore';
import cookie from 'react-cookies';
import { setLang } from './utils/lang';

const defaultLang = cookie.load('defaultLang');
if (defaultLang != null) {
  setLang(defaultLang);
}

// Create redux store with history
const initialState = {};
const history = createBrowserHistory();
const store = configureStore(initialState, history);
const ICE_CONTAINER = document.getElementById('ice-container');

if (!window.localStorage) {
  Feedback.toast.warn(T('请升级浏览器，当前浏览器无法保存交易结果'));
}
if (!ICE_CONTAINER) {
  throw new Error('当前页面不存在 <div id="ice-container"></div> 节点.');
}

ReactDOM.render(
  <Provider store={store}>
    <ConnectedRouter history={history}>{router()}</ConnectedRouter>
  </Provider>,
  ICE_CONTAINER
);
