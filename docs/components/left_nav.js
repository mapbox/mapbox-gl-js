import React from 'react';

export default class extends React.Component {
    render() {
        return (
            <div className='docnav hide-mobile'>
                <div className='limiter'>
                    <div className='col3 contain'>
                        <nav className='scroll-styled quiet-scroll small'>
                            {this.props.children}
                        </nav>
                    </div>
                </div>
            </div>
        );
    }
}
