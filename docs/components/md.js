import remark from 'remark';
import reactRenderer from 'remark-react';

export default function md(str) {
    return remark().use(reactRenderer).processSync(str).contents;
}
