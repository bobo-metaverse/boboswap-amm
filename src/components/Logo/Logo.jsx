import React, { PureComponent } from 'react';
import { Link } from 'react-router-dom';
import { T } from '../../utils/lang';
import { Iconfont } from '../Ui/iconfont';

const logo_img = require('./images/logo_s.png');

export default class Logo extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      networkType: T('私网'),
    };
  }
  componentDidMount = () => {
    
  };
  render() {
    return (
      <Link to="/" className="logo">
        {/* <Iconfont icon="oex" primary></Iconfont>*/}
        <div to="/" className="logo-text">
          <img src={logo_img} style={{ width: '40px', height: '40px' }}></img>
          SwapUni
        </div> 
        
      </Link>
    );
  }
}
