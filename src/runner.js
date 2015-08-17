var Mocha = require('mocha');
var decycle = require('cycle').decycle;

process.on('message', function (data) {
  'useColors' in data.options || (data.options.useColors = true);
  var mocha = new Mocha(data.options);

  mocha.addFile(data.file);
  data.setup && mocha.addFile(data.setup);

  console.log(data.file);

  mocha.run(function() {
    process.exit(0);
  }).on('suite end', function (suite) {
    if (suite.root) {
      process.send(decycle(suite));
    }
  });
});
