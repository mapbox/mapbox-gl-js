// @flow
//
const exported = {
    getEntriesByName: (url: string) => {
        if (performance && performance.getEntriesByName)
            return performance.getEntriesByName(url);
        else
            return false;
    }
};

export default exported;
