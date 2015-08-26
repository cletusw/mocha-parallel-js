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
 * @param {Object} [options.env] - Optional environment variables to set on the child processes
 * @param {number} [options.concurrency=Number of CPUs/cores] - Optional max concurrent tests
 *   @see {@link https://github.com/mochajs/mocha/wiki/Using-mocha-programmatically#set-options}
 * @returns {Promise<{suites:Array}>} When all test have completed, resolves with the combined output
 */
function mochaParallel(files, options) {
  var concurrency = options.concurrency || os.cpus().length;

  console.log();

  var startDateTime = new Date();

  return Promise.all(files.map(throat(concurrency, function (file) {
    return test(file, options.setup, options.mochaOptions, options.env);
  }))).then(function (results) {
    var elapsedTimeInMs = new Date() - startDateTime;
    var rootSuite = {
      root: true,
      startDateTime: startDateTime,
      elapsedTimeInMs: elapsedTimeInMs,
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

function test(file, setup, mochaOptions, env) {
  return new Promise(function (resolve, reject) {
    var suites;
    var runner = fork(__dirname + '/runner.js', {
      env: env,
      silent: true
    });

    runner.on('error', function (error) {
      console.error('Error executing file', file);
    });

    runner.on('message', function (fileRootSuite) {
      suites = retrocycle(fileRootSuite).suites;
    });

    // Buffer stdout to avoid intermixing with other forks
    var output = [];
    function bufferOutput(data) {
      output.push(data);
    }
    runner.stdout.on('data', bufferOutput);
    runner.stderr.on('data', bufferOutput);

    runner.on('close', function () {
      if (suites) {
        console.log(output.join(''));

        return resolve(suites);
      }
      else {
        return resolve([]);
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
