var express = require('express'),
    app = express(),
    https = require('https'),
    fs = require('fs'),
    bodyParser = require('body-parser'),
    path = require('path');


app.use(express.static(__dirname + '/public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// This line is from the Node.js HTTPS documentation.
var options = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
};

app.get('/', function(req, res) {
  res.sendFile('./index.html');
});

//Data store to hold usernames
var db = {};
db.usernames = {};
db.heartbeats = {};
db.archiveRequests = {};

var OpenTok = require('opentok'),
  apiKey = '45200812',
  apiSecret = 'a6ab795cda0110e7974dd5153098d02d68470a7a',
    opentok = new OpenTok(apiKey, apiSecret),
    sessionId,
    archiveId,
    session = opentok.createSession({mediaMode:"routed"}, function(error, session) {
    if (error) {
      console.log("Error creating session:", error)
    } else {
      sessionId = session.sessionId;
      console.log("Session ID: " + sessionId);
    }

    //  Use the role value appropriate for the user:
    var tokenOptions = {};
    tokenOptions.role = "publisher";
 
    // Generate a token.
    token = opentok.generateToken(sessionId, tokenOptions);
    console.log(token);
  });

app.post('/start', function(req, res) {
  //Here we have access to req.body.username, set an alias
  var username = escape(req.body.username).toLowerCase();

  var data = {
              sessionId: sessionId,
              token: token
             };
  res.send(data);

  var heartbeatCheckTimer;
  //Initiate heartbeat checks for this client
  function heartbeatChecks () {
    //If fail heartbeat check update username to available
    if (db.heartbeats[username] === false) {
      db.usernames[username] = undefined;
      //Stop checking for heartbeat
      clearInterval(heartbeatCheckTimer);
      console.log('HB failed from '+username);
      console.log(JSON.stringify(db.usernames));
    }
    //Passed check, reset to false, wait 10s
    db.heartbeats[username] = false;
  }

  //Initial is-connected value to false
  db.heartbeats[username] = false;
  //Check in 10 seconds, and from then on, if client connected
  //By then a heartbeat should have reset it to true
  heartbeatCheckTimer = setInterval(heartbeatChecks, 10000);
});

//Archiving functions
app.post('/archive/start/:sessionId', function(req, res) {
  opentok.startArchive(req.params.sessionId, {name: req.body.username+'\'s Animal Side'}, function(err, archive) {
    if (err) {
      console.log(err);
      res.status(500);
      res.send(err);
      return;
    }

    db.archiveRequests[archive.id] = req.body.username;
    res.send(archive.id);

    // The id property is useful to save off into a database
    console.log("new archive:" + archive.id);
  });
});

app.post('/archive/stop/:archiveId', function(req, res) {
  opentok.stopArchive(req.params.archiveId, function(err, archive) {
    if (err) {
      console.log(err);
      res.status(500);
      res.send(err);
      return;
    }

    res.send();

    // The id property is useful to save off into a database
    console.log("Stopped archive:" + archive.id);
  });
});

app.post('/archive/status', function(req, res) {
  req.body.status
});

//Username verification functions
app.post('/username', function(req, res) {
  var usernameIsUsed = true;
  if (db.usernames[req.body.username] === undefined) {
    usernameIsUsed = false;
    db.usernames[req.body.username] = true;
  }
  res.send({isAlreadyUsed: usernameIsUsed});
});

//Heartbeat functions
app.post('/heartbeat', function(req, res) {
  var username = escape(req.body.username).toLowerCase();
  db.heartbeats[username] = true;
  res.send();
});

//app.listen(process.env.PORT || 3000);

// Create an HTTP service.
//http.createServer(app).listen(process.env.PORT || 80);
// Create an HTTPS service identical to the HTTP service.
https.createServer(options, app).listen(process.env.PORT);
