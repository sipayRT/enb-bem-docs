var path = require('path'),
    naming = require('bem-naming'),
    vow = require('vow'),
    vfs = require('enb/lib/fs/async-fs'),
    scanner = require('enb-bem-pseudo-levels/lib/level-scanner'),
    configurator = require('./node-configurator'),
    deps = require('enb-bem/lib/deps/deps');

module.exports = function (helper, exampleTaskName, exampleChannel) {
    return {
        configure: function (options) {
            options || (options = {});
            options.exampleSets || (options.exampleSets = []);
            options.docSuffixes || (options.docSuffixes = ['md', 'wiki']);
            options.docI18NSuffixes = options.langs ? buildI18NSuffixes(options.docSuffixes, options.langs) : [];
            options._examples = [];

            this._dependOnExamples(options);
            this._buildPseudoLevels(options);
            this._configureNodes(options);
        },

        _buildPseudoLevels: function (options) {
            var root = helper.getRootPath(),
                dstpath = path.resolve(root, options.destPath),
                levels = options.levels.map(function (level) {
                    return (typeof level === 'string') ? { path: level } : level;
                });

            helper.prebuild(function (magic) {
                return scanner.scan(levels)
                    .then(function (files) {
                        var nodes = {};

                        files.forEach(function (file) {
                            var ext = path.extname(file.name);

                            if (options.docSuffixes.indexOf(file.suffix) !== -1 ||
                                options.docI18NSuffixes.indexOf(file.suffix) !== -1 ||
                                ext === '.js'
                            ) {
                                var bemname = file.name.split('.')[0],
                                    block = naming.parse(bemname).block,
                                    node = path.join(options.destPath, block);

                                if (magic.isRequiredNode(node)) {
                                    nodes[node] = true;
                                    magic.registerNode(node);
                                }
                            }
                        });

                        return vow.all(Object.keys(nodes).map(function (node) {
                            var basename = path.basename(node),
                                dirname = path.join(dstpath, basename),
                                bemdeclFilename = path.join(dirname, basename + '.bemdecl.js'),
                                notation = naming.parse(basename),
                                dep = { block: notation.block },
                                bemdeclSource;

                            notation.elem && (dep.elem = notation.elem);

                            if (notation.modName) {
                                dep.mod = notation.modName;
                                dep.val = notation.modVal;
                            }

                            bemdeclSource = 'exports.blocks = ' + JSON.stringify(deps.toBemdecl([dep])) + ';';

                            return vfs.makeDir(dirname)
                                .then(function () {
                                    return vfs.write(bemdeclFilename, bemdeclSource, 'utf-8');
                                });
                        }));
                    });
            });
        },

        _configureNodes: function (options) {
            var exampleSets = options.exampleSets;

            if (exampleSets && exampleChannel) {
                exampleChannel.on('examples', function (scope, items) {
                    if (exampleSets.indexOf(scope) !== -1) {
                        options._examples = options._examples.concat(items);
                    }
                });

                exampleChannel.on('inline-examples', function (scope, items) {
                    if (exampleSets.indexOf(scope) !== -1) {
                        options._examples = options._examples.concat(items);
                    }
                });
            }

            helper.configure(function (projectConfig) {
                configurator.configure(projectConfig, options);
            });
        },

        _dependOnExamples: function (options) {
            helper.prebuild(function (magic) {
                var defer = vow.defer();

                if (exampleChannel) {
                    var requiredTargets = magic.getRequiredTargets(),
                        exampleSets = [],
                        hasExampleSets = true,
                        hasDocSet = false,
                        runInMagicTask = helper._state === 'run';

                    requiredTargets && requiredTargets.forEach(function (target) {
                        options.exampleSets.forEach(function (exampleSet) {
                            (target.indexOf(exampleSet) !== -1) && (exampleSets.push(exampleSet));
                        });
                        (target.indexOf(options.destPath) !== -1) && (hasDocSet = true);
                    });

                    options.exampleSets.forEach(function (exampleSet) {
                        (exampleSets.indexOf(exampleSet) === -1) && (hasExampleSets = false);
                    });

                    // Запускаем таск сборки примеров, если он не был запущен пользователем явно или через мета таск
                    // с аргументами, переданными в `options.exampleSets`
                    if ((!runInMagicTask || (runInMagicTask && hasDocSet && !hasExampleSets)) &&
                        options.exampleSets &&
                        options.exampleSets.length
                    ) {
                        var makePlatform = helper._taskConfig.getMakePlatform();

                        makePlatform.buildTask(exampleTaskName, options.exampleSets);
                    }

                    exampleChannel.on('prebuild', function () {
                        defer.resolve();
                    });
                } else {
                    defer.resolve();
                }

                return defer.promise();
            });
        }
    };
};

function buildI18NSuffixes(suffixes, langs) {
    var res = [];

    suffixes.map(function (suffix) {
        langs.forEach(function (lang) {
            res.push([lang, suffix].join('.'));
        });
    });

    return res;
}
