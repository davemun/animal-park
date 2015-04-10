var https = require('https');
var fs = require('fs');

// This line is from the Node.js HTTPS documentation.
var options = {
  key: fs.readFileSync('server.crt', 'utf8'),
  cert: fs.readFileSync('server.key', 'utf8')
};

// console.log(fs.readFileSync('server.key', 'utf8'));
// console.log(fs.readFileSync('server.crt', 'utf8'));

// app.get('/', function (req, res) {
//   res.sendFile(__dirname+'/public/index.html');
// });

var port = process.env.PORT || 3000;

https.createServer(options, function (req, res) {
  res.writeHead(200);
  res.end("hello world\n");
}).listen(port);

console.log('process listening at: '+port);
