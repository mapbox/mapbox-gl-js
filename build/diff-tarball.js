const packlist = require('npm-packlist')
const npmContent = require('list-npm-contents');

npmContent('mapbox-gl').then(function(last_version_files) {
    packlist({ path: '.' }).then(function(new_version_files) {
        new_version_files = new_version_files.map(file => file.replace(/\/\/+/g, '/'));
        let diff_new = new_version_files.filter(x => !last_version_files.includes(x));
        let diff_last = last_version_files.filter(x => !new_version_files.includes(x));
        console.log(`${diff_new.length} files are about to be added in the new tarball`)
        diff_new.forEach(file => {
            console.log('+', file);
        });
        console.log(`${diff_last.length} files are about to be deleted in the new tarball`)
        diff_last.forEach(file => {
            console.log('-', file);
        });
    });
});