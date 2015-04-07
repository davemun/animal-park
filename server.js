var express = require('express'),
    app = express(),
    path = require('path');

app.use(express.static(__dirname + '/public'));

app.get('/', function(req, res) {
  res.sendFile('./index.html');
});

app.listen(process.env.PORT || 3000);