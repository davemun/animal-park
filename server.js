var express = require('express'),
    app = express(),
    bodyParser = require('body-parser'),
    path = require('path');


app.use(express.static(__dirname + '/public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

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
app.post('/archive/start', function(req, res) {
  opentok.startArchive(req.body.sessionId, {name: req.body.username}, function(err, archive) {
    if (err) {
      console.log(err);
      res.status(500).send(err);
      return;
    }

    res.status(200).send(archive.id);

    // The id property is useful to save off into a database
    console.log("new archive:" + archive.id);
  });
});

app.post('/archive/stop', function(req, res) {
  opentok.stopArchive(req.body.archiveId, function(err, archive) {
    if (err) {
      console.log(err);
      res.status(500).send(err);
      return;
    }

    res.status(200).end();

    // The id property is useful to save off into a database
    console.log("Stopped archive:" + archive.id);
  });
});

app.post('/archive/status', function(req, res) {
  //if an archive video is available, store link in database
  if (req.body.status = "available") {
    db.archiveRequests[req.body.name][req.body.id] = req.body.url;
  }
});

app.get('/archive/list/:name', function(req, res) {
  //send back list of archives if it exists
  var list = db.archiveRequests[req.params.name] || {};
  res.send(list);
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

app.listen(process.env.PORT || 3000);
