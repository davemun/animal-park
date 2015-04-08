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
  //Here we have access to req.body.username
  //Store it in a db somewhere?
  var data = {
              sessionId: sessionId,
              token: token
             };
  res.send(data);
});

//Archiving functions
app.post('/archive/start/:sessionId', function(req, res) {
  opentok.startArchive(req.params.sessionId, function(err, archive) {
    if (err) {
      console.log(err);
      res.status(500);
      res.send(err);
      return;
    }

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

//Username verification functions
app.post('/username', function(req, res) {
  var usernameIsUsed = true;
  if (!db[req.body.username]) {
    usernameIsUsed = false;
    db[req.body.username] = true;
  }
  res.send({isAlreadyUsed: usernameIsUsed});
});

app.listen(process.env.PORT || 3000);