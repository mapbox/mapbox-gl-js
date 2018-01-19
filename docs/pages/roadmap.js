import React from 'react';
import PageShell from '../components/page_shell';
import LeftNav from "../components/left_nav";
import TopNav from "../components/top_nav";

const meta = {
    title: 'Mapbox GL JS Roadmap',
    description: '',
    pathname: '/roadmap'
};

const roadmap = {
    "updated_at": "November 25, 2017",
    "roadmap_items": [
        {
            "term": "Active",
            "description": "Things actively being built right now.",
            "items": [
                {
                    "name": "Client-side hillshade rendering",
                    "issues": [
                        "3730",
                        "4701"
                    ]
                }
            ]
        },
        {
            "term": "Upcoming",
            "description": "Things we hope to start building in the next several months.",
            "items": [
                {
                    "name": "Property aggregation on clustered features",
                    "issues": [
                        "2412"
                    ]
                },
                {
                    "name": "Custom source type API",
                    "project": 2
                },
                {
                    "name": "Ray picking for extrusion layers",
                    "issues": [
                        "3122"
                    ]
                },
                {
                    "name": "Component based style composition",
                    "issues": [
                        "4225"
                    ]
                }
            ]
        }
    ]
};

export default class extends React.Component {
    render() {
        return (
            <PageShell meta={meta}>
                <LeftNav>
                    <div className='pad2'>
                        <p className='icon time'>Last updated: {roadmap.updated_at}</p>
                        <p className="small"><span className="icon point roadmap-project"/> indicates a
                            project on GitHub</p>
                    </div>
                </LeftNav>

                <div className='limiter clearfix'>
                    <TopNav current='roadmap'/>

                    <div className='contain margin3 col9'>
                        <style>{`
                        .roadmap-block {
                            margin: 10px;
                            box-sizing:border-box;
                            -moz-box-sizing:border-box;
                            -webkit-box-sizing:border-box;
                        }
                        code a {
                            color: #fbb03b;
                        }
                        .roadmap-project {
                            color: #8a8acb;
                        }
                        `}</style>

                        <div className='pad2y col12'>
                            <div className='pad1 contain space-bottom2'>
                                <h1 className='space-bottom2'>
                                    Mapbox GL JS Roadmap
                                </h1>
                                <p className='prose'>The GL JS team is focused on making our priorities transparent and
                                    reliable. Below is a list of which major projects and features are currently in
                                    active development, upcoming, or we are thinking about long-term. Each item includes
                                    links to the relevant issues and pull requests on GitHub.</p>
                                <p className='prose'>This roadmap is updated weekly on Tuesdays. The roadmap does not
                                    include bug fixes, and features that take less than a day to develop. Due to the
                                    pace at which GL JS is being developed, we are unable to confidently estimate which
                                    release version a feature will ship with.</p>
                            </div>

                            <div className='col12'>
                                {roadmap.roadmap_items.map((r, i) =>
                                    <div key={i} className='col6'>
                                        <div className='roadmap-block fill-white prose keyline-all'>
                                            <div className='pad2'>
                                                <h2 style={{"margin-bottom": 0}}>{r.term}</h2>
                                                <small className="quiet">{r.description}</small>
                                            </div>
                                            {r.items.map((item, i) =>
                                                <div key={i} className='pad2x pad1y keyline-top'>
                                                    {item.project && <span className="icon point roadmap-project fr"/>}
                                                    {item.name}
                                                    <div className="space-top">
                                                        {item.issues && item.issues.map((issue, i) =>
                                                            <code key={i}><a target="_blank" className="roadmap-issue"
                                                                href={`https://github.com/mapbox/mapbox-gl-js/issues/${issue}`}>#{issue}</a></code>)}
                                                        {item.project &&
                                                        <code><a target="_blank"
                                                            href={`https://github.com/mapbox/mapbox-gl-js/projects/${item.project}`}>project#{item.project}</a></code>}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </PageShell>
        );
    }
}
