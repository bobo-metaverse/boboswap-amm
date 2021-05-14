import React, { PureComponent } from 'react';
import Layout from '@icedesign/layout';
import { Link } from 'react-router-dom';
import cx from 'classnames';
import './ui.scss';

const PNG_f = require('./images/f.png');
const PNG_logo = require('./images/logo.png');
const PNG_ten = require('./images/t.en.png');
const PNG_tzh = require('./images/t.zh.png');
const PNG_t = require('./images/t.png');

export default class Footer extends PureComponent {
  render() {
    const { className, style } = this.props;
    return (
      <Layout.Footer className={cx('ui-layout-footer', className)} style={style}>
        <div className="ui-layout-footer-body">
          <div className="ui-footer">
            <a href="/" style={{ fontSize: '16px', color: '#5E768B', fontWeight: 'bold' }}>
            Defender Swap
            </a>
            <a style={{ right: 56 * 3 + 'px' }} href="http://t.me/">
              <img src={PNG_tzh} />
            </a>
            <a style={{ right: 56 * 2 + 'px' }} href="http://t.me/">
              <img src={PNG_ten} />
            </a>
            <a style={{ right: 56 * 1 + 'px' }} href="https://www.facebook.com/">
              <img src={PNG_f} />
            </a>
            <a style={{ right: '10px' }} href="https://twitter.com/">
              <img src={PNG_t} />
            </a>
          </div>
        </div>
        <div className="uilayout-copyright">
          <span>© 2019 Theme designed by defender.com</span>
          <span className="line">|</span>
          <span>备案号:xxx-xxx</span>
          <span className="line">|</span>
          <span>defender@gmail.com</span>
        </div>
      </Layout.Footer>
    );
  }
}
