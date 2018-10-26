import React from 'react';
import entries from 'object.entries';
import md from './md';

export default class SDKSupportTable extends React.Component {
    support(support, sdk) {
        if (!support) return 'Not yet supported';
        support = support[sdk];
        if (support === undefined) return 'Not yet supported';
        return `>= ${support}`;
    }

    render() {
        return (
            <table className='micro fixed'>
                <thead>
                    <tr className='fill-light'>
                        <th>SDK Support</th>
                        <td className='center'>Mapbox GL JS</td>
                        <td className='center'>Android SDK</td>
                        <td className='center'>iOS SDK</td>
                        <td className='center'>macOS SDK</td>
                    </tr>
                </thead>
                <tbody>
                    {entries(this.props).map(([key, entry], i) =>
                        <tr key={i}>
                            <td>{md(key)}</td>
                            <td className='center'>{this.support(entry, 'js')}</td>
                            <td className='center'>{this.support(entry, 'android')}</td>
                            <td className='center'>{this.support(entry, 'ios')}</td>
                            <td className='center'>{this.support(entry, 'macos')}</td>
                        </tr>
                    )}
                </tbody>
            </table>
        );
    }
}
