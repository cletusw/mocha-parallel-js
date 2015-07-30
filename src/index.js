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
 * var mochaOptions = {
 *   reporter: 'tap',
 *   timeout: 10e3
 * };
 * mochaParallel(files, mochaOptions, function(rootSuite) {
 *   console.log('ALL DONE');
 *   console.log(rootSuite.suites);
 * });
 *
 * @param {string[]} files - Array of tests' filenames
 * @param {string} [setup] - Optional file to be run before each test file
 * @param {Object} [mochaOptions] - Optional options to pass to Mocha's JS API
 *   @see {@link https://github.com/mochajs/mocha/wiki/Using-mocha-programmatically#set-options}
 * @param {mochaParallelCallback} callback - Called when all test have completed
 */
function mochaParallel(files, setup, mochaOptions, callback) {
  if (arguments.length === 2) {
    callback = arguments[1];
    setup = undefined;
    mochaOptions = undefined;
  }
  else if (arguments.length === 3) {
    callback = arguments[2];
    if (typeof arguments[1] === 'string') {
      mochaOptions = undefined;
    }
    else {
      mochaOptions = arguments[1];
      setup = undefined;
    }
  }

  var forks = files.length;
  var rootSuite = {
    root: true,
    suites: []
  };

  console.log();

  files.forEach(function (file) {
    var runner = fork(__dirname + '/runner.js', { silent: true });

    runner.stderr.pipe(process.stderr);

    runner.on('error', function (error) {
      console.error('Error executing file', file);
    });

    runner.on('message', function (fileRootSuite) {
      fileRootSuite = retrocycle(fileRootSuite);
      fileRootSuite.suites.forEach(function (suite) {
        suite.parent = rootSuite;
        rootSuite.suites.push(suite);
      });
    });

    // Buffer stdout to avoid intermixing with other forks
    var stdout = [];
    runner.stdout.on('data', function (data) {
      stdout.push(data);
    });

    runner.on('close', function () {
      console.log(stdout.join(''));

      forks--;
      if (!forks) {
        callback(rootSuite);
      }
    });

    // Begin testing
    runner.send({
      file: file,
      setup: setup,
      options: mochaOptions
    });
  });
}
