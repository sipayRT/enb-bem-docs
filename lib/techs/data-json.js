var path = require('path'),
    vow = require('vow'),
    vfs = require('enb/lib/fs/async-fs'),
    dropRequireCache = require('enb/lib/fs/drop-require-cache'),
    asyncRequire = require('enb/lib/fs/async-require');

module.exports = require('enb/lib/build-flow').create()
    .name('data-json')
    .target('target', '?.data.json')
    .defineOption('langs', [])
    .useSourceFilename('metaFile', '?.meta.json')
    .builder(function (metaFile) {
        var node = this.node,
            langs = this._langs,
            nodeDir = node.getDir(),
            name = path.basename(nodeDir),
            dataByLangs = {};

        dropRequireCache(require, metaFile);

        return asyncRequire(metaFile)
            .then(function (meta) {
                if (langs && langs.length) {
                    return vow.all(langs.map(function (lang) {
                        var dochtmlFilename = node.resolvePath(node.unmaskTargetName('?.' + lang + '.doc.html')),
                            dochtmlTarget = path.relative(nodeDir, dochtmlFilename),
                            data = {
                                name: name,
                                examples: meta.examples
                            };

                        dataByLangs[lang] = data;

                        return node.requireSources([dochtmlTarget])
                            .then(function () {
                                return vfs.read(dochtmlFilename, 'utf-8');
                            })
                            .then(function (source) {
                                data.description = source;
                            });
                    }))
                    .then(function () {
                        return JSON.stringify(dataByLangs);
                    });
                } else {
                    var dochtmlFilename = meta.dochtmlFiles[0],
                        dochtmlTarget = path.relative(nodeDir, dochtmlFilename),
                        data = {
                            name: name,
                            examples: meta.examples
                        };

                    return node.requireSources([dochtmlTarget])
                        .then(function () {
                            return vfs.read(dochtmlFilename, 'utf-8');
                        })
                        .then(function (source) {
                            data.description = source;
                        })
                        .then(function () {
                            return JSON.stringify(data);
                        });
                }
            });
    })
    .createTech();
