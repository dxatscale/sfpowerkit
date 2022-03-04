// src/components/plugins/index.js
import React, { PropTypes, Component } from 'react';
import classnames from 'classnames';

import './style.css';

export default class plugins extends Component {
    // static propTypes = {}
    // static defaultProps = {}
    // state = {}

    render() {
        const { className, ...props } = this.props;
        return (
            <div className={classnames('plugins', className)} {...props}>
                <h1>plugins</h1>
            </div>
        );
    }
}
