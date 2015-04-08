var AnimalPark = function () {
  this.username = "";
  this.apiKey = "45200812";
  this.sessionId = "";
  this.session = null;
  this.userVotes = {};
  this.voteTallies = {};
  this.topFour = [
                  {animal: undefined, votes: 0},
                  {animal: undefined, votes: 0},
                  {animal: undefined, votes: 0},
                  {animal: undefined, votes: 0}
                 ];
}

var AP = new AnimalPark();

$('.introDialog button').click(function () {
  if ( $('.introDialog input').val() ) {
    //Check to see if username already taken
      //Used by vote counting and archiving naming
    var usernameIsOccupied;

    $.ajax({
      type: "POST",
      url: "/username",
      //Sanitize/more importantly case normalize username before we store in server
      //Clientside storage of name retains case but server side is agnostic
      data: {username: escape(AP.username).toLowerCase()},
      success: function (data) {
        usernameIsOccupied = data.isAlreadyUsed;
        //If username in use
        if (data.isAlreadyUsed) {
          //Blink message to ask for new name
          var alertMsg = $('<div>Already in use! Please try a new name!</div>');
          $('.introDialog').append(alertMsg);
          alertMsg.fadeOut(2000, function() { $(this).remove(); });
        }
      },
      async: false
    });

    //Don't start app if username is already in use
    if (usernameIsOccupied) {
      return;
    }

    //If there is a valid username, transition to main app
    AP.username = escape($('.introDialog input').val());
    $('.introDialog input').val("");
    $('.splash').fadeOut(2000, function() { $(this).remove(); });
    //Ask server for sessionId and token  
    $.ajax({
      type: "POST",
      url: "/start",
      data: {username: AP.username},
      success: function (data) {
      AP.sessionId = data.sessionId,
      token = data.token;

      //Create session object with server generated credentials
      AP.session = OT.initSession(AP.apiKey, AP.sessionId);
      //Usability alias
      var session = AP.session;

      //Event listener to add other publishers
      session.on("streamCreated", function (event) {
        //Generate placeholder div to swap with webcam
        $('<div></div>').attr('id', event.stream.name+'Video').css({"display": "inline-block"}).appendTo('.audience');

        var subscriber = session.subscribe(event.stream, event.stream.name+"Video", {name:event.stream.name});
        //Let's restrict audience frame rates since we just want their general reactions, not hi-fi vid
        subscriber.restrictFrameRate(true);

        $('#'+event.stream.name+'Video').css({"height":"100%"});
      });

      //Event listener to get votes from other publishers
      session.on("signal:vote", function (event) {
        console.log("Signal sent from connection " + event.from.id);
        // Process the vote.

        //First sanitize and normalize inputs.
        var vote = escape(event.data.vote).toLowerCase(),
            username = escape(event.data.vote);

        //If user already voted, change their vote to other animal
        if (AP.userVotes[username]) {
          //Get original animal
          var oldAnimal = AP.userVotes[username];

          //If voting for same animal, no change, and return.
          if (oldAnimal === vote) {
            return;
          }

          //Subtract original vote from total of that animal
          AP.voteTallies[oldAnimal] = AP.voteTallies[oldAnimal] - 1;
        }
        //Store new vote
        AP.userVotes[username] = vote;
        //Increase new animal tally
        AP.voteTallies[vote] = AP.voteTallies[vote] ? AP.voteTallies[vote] + 1 : 1;

        //If animal can be in top four, overwrite one with lesser count
        for (var i = 0; i < AP.topFour.length; i++) {
          //If already in top four, check if can move up a rank
          if (AP.topFour[i].animal === vote) {
            AP.topFour[i].votes = AP.topFour[i].votes + 1;
            //Swap with rank above if needed
            if (i !== 0 && AP.topFour[i-1].votes < AP.topFour[i].votes ) {
              var temp = AP.topFour[i-1];
              AP.topFour[i-1] = AP.topFour[i];
              AP.topFour[i] = temp;
            }
            break;
          }

          if (AP.topFour[i].votes < AP.voteTallies[vote]) {
            AP.topFour[i] = {
                              votes: AP.voteTallies[vote],
                              animal: vote
                            };
            break;
          }
        }
      });

      //Connect to session
      session.connect(token, function(error) {
          var publisher = OT.initPublisher('webcam', {name: AP.username});
          session.publish(publisher);
          //Hide button
          $('#broadcast').hide();
      });
    }
  });

  } else {

    //If they didnt enter a username, blink a message
    var alertMsg = $('<div>Please enter your name!</div>');
    $('.introDialog').append(alertMsg);
    alertMsg.fadeOut(2000, function() { $(this).remove(); });

  }

});

$('#guess button').click(function () {
  var guessString = $('#guess input').val();
  var voteObj = {vote: guessString, username: AP.username};

  if (guessString) {

    $('#guess input').val("");
    AP.session.signal({data: voteObj, type:"vote"}, function (err) {
        if (err) {
          console.log("signal error (" + error.code + "): " + error.message);
        } else {
          console.log("signal sent.");
        }
    });    
  }

});
