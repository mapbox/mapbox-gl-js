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
            <table className='txt-s mb12'>
                <thead>
                    <tr className='bg-gray-faint'>
                        <th>SDK Support</th>
                        <td className='align-center'>Mapbox GL JS</td>
                        <td className='align-center'>Android SDK</td>
                        <td className='align-center'>iOS SDK</td>
                        <td className='align-center'>macOS SDK</td>
                    </tr>
                </thead>
                <tbody>
                    {entries(this.props).map(([key, entry], i) =>
                        <tr key={i}>
                            <td>{md(key)}</td>
                            <td className='align-center'>{this.support(entry, 'js')}</td>
                            <td className='align-center'>{this.support(entry, 'android')}</td>
                            <td className='align-center'>{this.support(entry, 'ios')}</td>
                            <td className='align-center'>{this.support(entry, 'macos')}</td>
                        </tr>
                    )}
                </tbody>
            </table>
        );
    }
}
