import React from 'react';
import PropTypes from 'prop-types';
import TabList from '@mapbox/mr-ui/tab-list';
import { listTabs } from '../util/list-tabs';
import listSubfolders from '@mapbox/batfish/data/list-subfolders'; // eslint-disable-line import/no-unresolved

class TopNavTabs extends React.Component {
    render() {
        const { props } = this;
        // Determine the contents and style of the TopNavTabs
        const allTabs = listTabs(listSubfolders);
        return <TabList items={allTabs} activeItem={props.activeTab} />;
    }
}

TopNavTabs.propTypes = {
    activeTab: PropTypes.string.isRequired,
};

export default TopNavTabs;
