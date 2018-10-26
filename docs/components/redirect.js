import React from 'react';

export default function (target) {
    return class extends React.Component {
        componentDidMount() {
            window.location.href = typeof target === 'function' ? target() : target;
        }

        render() {
            return null;
        }
    };
}
