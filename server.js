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
db.endpointTest = [];

var OpenTok = require('opentok'),
  archiveMode = 'individual', //['individual', 'composed']
  logins = { 
            keys: {composed: process.env.APIKEY, individual: process.env.INDIVIDUALARCHIVE_APIKEY},
            secrets : {composed: process.env.APIKEY, individual: process.env.INDIVIDUALARCHIVE_APISECRET}
           },
  apiKey = logins.keys[archiveMode],
  apiSecret = logins.secrets[archiveMode],
  opentok = new OpenTok(apiKey, apiSecret),
  sessionId,
  token,
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
              token: token,
              apiKey: apiKey
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
  opentok.startArchive(req.body.sessionId, {name: req.body.username, outputMode: 'individual'}, function(err, archive) {
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
  if (req.body.status === "available" || req.body.status === "uploaded") {
    //initialize container for user if not already there
    db.archiveRequests[req.body.name] = db.archiveRequests[req.body.name] || {};
    db.archiveRequests[req.body.name][req.body.id] = req.body.url;
  }
  res.end();
});

app.post('/archive/delete', function(req, res) {
  //if an archive video is available, store link in database
  opentok.deleteArchive(req.body.archiveId, function(err) {
    if (err) {
      console.log(err);
      res.status(500).send(err);
      return;
    }

    db.archiveRequests[req.body.username][req.body.archiveId] = undefined;
    res.status(200).end();

    // The id property is useful to save off into a database
    console.log("Deleted archive:" + req.body.archiveId);
  });
  res.end();
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

//Testbed endpoint verification
app.post('/endpointTest', function(req, res) {
  db.endpointTest.push(req.body);
  res.end();
});

app.get('/endpointTest', function(req, res) {
  res.send(JSON.stringify(db.endpointTest));
});

//Heartbeat functions
app.post('/heartbeat', function(req, res) {
  var username = escape(req.body.username).toLowerCase();
  db.heartbeats[username] = true;
  res.end();
});

app.listen(process.env.PORT || 3000);
