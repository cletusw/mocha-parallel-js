var retrocycle = require('cycle').retrocycle;
var fork = require('child_process').fork;

exports = module.exports = mochaParallel;

/**
 * Callback definition for mochaParallel
 *
 * @callback mochaParallelCallback
 * @param {object} rootSuite - An integer.
 */

/**
 * Runs the specified Mocha test files in parallel
 *
 * @example
 * var files = [ 'test1.js', 'test2.js' ];
 * var options = {
 *   setup: 'setup.js',
 *   mochaOptions: {
 *     reporter: 'tap',
 *     timeout: 10e3
 *   }
 * };
 * mochaParallel(files, options, function(rootSuite) {
 *   console.log('ALL DONE');
 *   console.log(rootSuite.suites);
 * });
 *
 * @param {string[]} files - Array of tests' filenames
 * @param {Object} options
 * @param {string} [options.setup] - Optional file to be run before each test file
 * @param {Object} [options.mochaOptions] - Optional options to pass to Mocha's JS API
 *   @see {@link https://github.com/mochajs/mocha/wiki/Using-mocha-programmatically#set-options}
 * @param {mochaParallelCallback} callback - Called when all test have completed
 */
function mochaParallel(files, options, callback) {
  var forks = files.length;
  var rootSuite = {
    root: true,
    suites: []
  };

  console.log();

  files.forEach(function (file) {
    var suites;
    var runner = fork(__dirname + '/runner.js', { silent: true });

    runner.stderr.pipe(process.stderr);

    runner.on('error', function (error) {
      console.error('Error executing file', file);
    });

    runner.on('message', function (fileRootSuite) {
      suites = retrocycle(fileRootSuite).suites;
    });

    // Buffer stdout to avoid intermixing with other forks
    var stdout = [];
    runner.stdout.on('data', function (data) {
      stdout.push(data);
    });

    runner.on('close', function () {
      console.log(stdout.join(''));

      suites.forEach(function (suite) {
        suite.parent = rootSuite;
        rootSuite.suites.push(suite);
      });

      forks--;
      if (!forks) {
        return callback(rootSuite);
      }
    });

    // Begin testing
    runner.send({
      file: file,
      setup: options.setup,
      options: options.mochaOptions
    });
  });
}
