var retrocycle = require('cycle').retrocycle;
var fork = require('child_process').fork;
var Promise = require('es6-promise').Promise;
var os = require('os');
var throat = require('throat');

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
 * mochaParallel(files, options).then(function(rootSuite) {
 *   console.log('ALL DONE');
 *   console.log(rootSuite.suites);
 * });
 *
 * @param {string[]} files - Array of tests' filenames
 * @param {Object} options
 * @param {string} [options.setup] - Optional file to be run before each test file
 * @param {Object} [options.mochaOptions] - Optional options to pass to Mocha's JS API
 * @param {number} [options.concurrency=Number of CPUs/cores] - Optional max concurrent tests
 *   @see {@link https://github.com/mochajs/mocha/wiki/Using-mocha-programmatically#set-options}
 * @returns {Promise<{suites:Array}>} When all test have completed, resolves with the combined output
 */
function mochaParallel(files, options) {
  var concurrency = options.concurrency || os.cpus().length;

  console.log();

  return Promise.all(files.map(throat(concurrency, function (file) {
    return test(file, options);
  }))).then(function (results) {
    var rootSuite = {
      root: true,
      suites: results.reduce(function (a, b) {
        // Flatten
        return a.concat(b);
      })
    };

    // Update parent link to point to new rootSuite
    rootSuite.suites.forEach(function (suite) {
      suite.parent = rootSuite;
    });

    return rootSuite;
  });
}

function test(file, options) {
  return new Promise(function (resolve, reject) {
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

      return resolve(suites);
    });

    // Begin testing
    runner.send({
      file: file,
      setup: options.setup,
      options: options.mochaOptions
    });
  });
}
