var path = require('path');
var vow = require('vow');
var vfs = require('enb/lib/fs/async-fs');
var dropRequireCache = require('enb/lib/fs/drop-require-cache');
var asyncRequire = require('enb/lib/fs/async-require');

module.exports = require('enb/lib/build-flow').create()
    .name('data-json')
    .target('target', '?.data.json')
    .useSourceFilename('metaFile', '?.meta.json')
    .builder(function (metaFile) {
        var node = this.node;
        var nodeDir = node.getDir();
        var rootDir = node.getRootDir();
        var name = path.basename(nodeDir);
        var dataByLangs = {};

        dropRequireCache(require, metaFile);

        return asyncRequire(metaFile)
            .then(function (meta) {
                return vow.all(Object.keys(meta.dochtmlFiles).map(function (lang) {
                    var dochtmlFilename = meta.dochtmlFiles[lang];
                    var dochtmlTarget = path.relative(nodeDir, dochtmlFilename);
                    var data = {
                        name: name,
                        examples: [{
                            content: meta.examples.map(function (filename) {
                                var node = path.relative(rootDir, filename);
                                var target = path.basename(node) + '.' + lang;

                                return {
                                    url: path.join(node, target)
                                };
                            })
                        }]
                    };

                    dataByLangs[lang] = data;

                    return node.requireSources([dochtmlTarget])
                        .then(function () {
                            return vfs.read(dochtmlFilename, 'utf-8');
                        })
                        .then(function (source) {
                            data.description = [{
                                content: source
                            }];
                        });
            }))
            .then(function () {
                return JSON.stringify(dataByLangs);
            });
        });
    })
    .createTech();