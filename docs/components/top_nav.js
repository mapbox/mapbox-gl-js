import React from 'react';
import {prefixUrl} from '@mapbox/batfish/modules/prefix-url';

export default class extends React.Component {
    render() {
        return (
            <div className='pad2y'>
                <nav className='contain margin3 col9 fill-gradient space-bottom round small'>
                    <div className='col3 dark round-left keyline-right pad1 center truncate'>
                        <div className='pad0y'>
                            <span className='icon gl fill-lighten0 dot inline pad0'/> Mapbox GL JS
                        </div>
                    </div>
                    <div className='col9 dark tabs mobile-cols pad1'>
                        <a href={prefixUrl('/api')} className={`col3 truncate ${this.props.current === 'api' && 'active'}`}>API</a>
                        <a href={prefixUrl('/style-spec')} className={`col3 truncate ${this.props.current === 'style-spec' && 'active'}`}>Style Specification</a>
                        <a href={prefixUrl('/examples')} className={`col3 truncate ${this.props.current === 'examples' && 'active'}`}>Examples</a>
                        <a href={prefixUrl('/plugins')} className={`col3 truncate ${this.props.current === 'plugins' && 'active'}`}>Plugins</a>
                    </div>
                </nav>
            </div>
        );
    }
}
