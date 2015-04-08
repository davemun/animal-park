//===========================================================================//
//                      Welcome to TokBox Animal Park                        //
//===========================================================================//


var AnimalPark = function () {
  this.username = "";
  this.apiKey = "45200812";
  this.sessionId = "";
  this.archiveId;
  this.session = null;
  this.publisher;
  this.subscribers = {};
  this.onStage = false;
  this.currentTribute;
  this.userVotes = {};
  this.voteTallies = {};
  this.topFour = [
                  {animal: undefined, votes: 0},
                  {animal: undefined, votes: 0},
                  {animal: undefined, votes: 0},
                  {animal: undefined, votes: 0}
                 ];
  this.heartbeat = false;
}


var AP = new AnimalPark();

//===========================================================================//
//                        Splash Page Systems                                //
//===========================================================================//

$('.introDialog button').click(function () {
  if ( $('.introDialog input').val() ) {
    //Check to see if username already taken
      //Used by vote counting and archiving naming
    var usernameIsOccupied,
        tempName = $('.introDialog input').val();

    //===========================//    
    //   Username verification   //
    //===========================//    
    $.ajax({
      type: "POST",
      url: "/username",
      //Sanitize/more importantly case normalize username before we store in server
      //Clientside storage of name retains case but server side is agnostic
      data: {username: escape(tempName).toLowerCase()},
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

    //===========================//    
    //   Session/Token Requests  //
    //===========================//    

    //Ask server for sessionId and token  
    $.ajax({
      type: "POST",
      url: "/start",
      data: {username: AP.username},
      success: function (data) {
      AP.sessionId = data.sessionId,
      token = data.token;

    //===========================//    
    //     Session Generation    //
    //===========================//    

      //Create session object with server generated credentials
      AP.session = OT.initSession(AP.apiKey, AP.sessionId);
      //Usability alias
      var session = AP.session;

    //===========================//    
    //  Session Event Listeners  //
    //===========================//    

      //Event listener to add other publishers
      session.on("streamCreated", function (event) {
        //Generate placeholder div to swap with webcam
        $('<div></div>').attr('id', event.stream.name+'Video').css({"display": "inline-block"}).appendTo('.audience');

        var subscriber = session.subscribe(event.stream, event.stream.name+"Video", {name:event.stream.name});
        //Store subscriber for later access
        AP.subscribers[event.stream.name] = subscriber;
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

    //Listen for tributes to the games, and bring them to the center
    session.on("signal:tribute", function (event) {
      if (event.data.username === AP.username) {
        //You volunteered!
        var tribute = $('#webcam');
        AP.onStage = true;
      } else {
        //Relocate publisher video to broadcast element div
        var tribute = $('#'+event.data.username+'Video');  
        //Unrestrict framerate
        AP.subscribers[event.data.username].restrictFrameRate(false);     
      }

      tribute.appendTo('#broadcaster').css({"height": "63vh", "width": "40vw", "left": "0px", "top": "0px"});
      AP.currentTribute = event.data.username;
    });

    //Listen for when tributes want to end
    session.on("signal:tributeEnd", function (event) {
      if (event.data.username === AP.username) {
        var tribute = $('#webcam');
        tribute.appendTo('.webcamContainer').removeAttr('style').css({"height": "198px", "width": "264px", "position": "fixed", "top": "0px", "right": "0px", "z-index": 20}); 
        AP.onStage = false;
      } else {
        //Relocate publisher video to broadcast element div
        var tribute = $('#'+event.data.username+'Video');   
        tribute.appendTo('.audience').css({"height": "100%", "width": "264px"});
        //Re-restrict framerate
        AP.subscribers[event.data.username].restrictFrameRate(true);
      }
      AP.currentTribute = undefined;      
    });

      //Connect to session
      session.connect(token, function(error) {
          var publisher = OT.initPublisher('webcam', {name: AP.username});
          //Store publisher for later access
          AP.publisher = publisher;
          session.publish(publisher);
          //Hide button
          $('#broadcast').hide();
      });

//===========================================================================//
//                          HeartBeat Systems                                //
//===========================================================================//

      //Heartbeat system to update server on username availablity
      var heartbeatSender,
          heartbeatCheckTimer;

      function heartbeat () {
        $.post('/heartbeat', {username: AP.username}, function () {
          AP.heartbeat = true;
        });
      }
      //Send it every 2 seconds, and server responds instantly.
      //Every 10 seconds if no heartbeats reset timer, client disconnects
      //itself from session and server will also update username availability.

      //Resets indicator to false every 10 seconds. Every 2 seconds a heartbeat
      //has a chance to set indicator to true before 10 secs runs out.
      //If still false in 10 seconds, client DCed, server also has a timer and will
      //independently update username availability.
      //User will also attempt to manually disconnect from session - this probably 
      //creates more problems than anything else, but its a sample app - it's an
      //excuse to use manual session disconnect events.
      function heartbeatCheck () {
        if (AP.heartbeat = false) {
          //Failed check
          session.disconnect();
          clearInterval(heartbeatSender);
          clearInterval(heartbeatCheckTimer);
        }
        //Passed check, reset to false, and wait 10s
        AP.heartbeat = false;
      }

      //Initial is-connected value to false
      AP.heartbeat = false;
      //Check again in 10s, send update every 2s
      heartbeatSender = setInterval(heartbeat, 2000),
      heartbeatCheckTimer = setInterval(heartbeatCheck, 10000);
    }
  });


//I should probably re-do the structure here.
  } else {

    //If they didnt enter a username, blink a message
    var alertMsg = $('<div>Please enter your name!</div>');
    $('.introDialog').append(alertMsg);
    alertMsg.fadeOut(2000, function() { $(this).remove(); });

  }

});

//===========================================================================//
//                          Voting Functions                                 //
//===========================================================================//


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

//===========================================================================//
//                   Tribute Volunteer Functions                             //
//===========================================================================//

$('#tribute').click(function () {
  //You're already on stage, or someone else is on stage
  if (AP.onStage) {
    return;
  } else if (AP.currentTribute !== undefined) {
    console.log("Wait your turn! Someone's already onstage.")
    return;
  }
  var tributeObj = {username: AP.username}
  AP.session.signal({data: tributeObj, type:"tribute"}, function (err) {
    if (err) {
      console.log("signal error (" + error.code + "): " + error.message);
    } else {
      console.log("signal sent.");
    }    
  });
});

$('#done').click(function () {
  //Already off stage, nowhere to go
  if (!AP.onStage) {
    return;
  }
  var tributeObj = {username: AP.username}
  AP.session.signal({data: tributeObj, type:"tributeEnd"}, function (err) {
    if (err) {
      console.log("signal error (" + error.code + "): " + error.message);
    } else {
      console.log("signal sent.");
    }    
  });
});

//===========================================================================//
//                          Archiving Functions                              //
//===========================================================================//

$('#startarchive').click(function() {
  $.ajax("http://localhost:3000/archive/start/"+AP.sessionId, {
     type: "POST",
     statusCode: {
        200: function (response) {

           AP.archiveId = response;
           
           $('#message').text('Broadcast is archiving!');
           setTimeout(function () {
             $('#message').text('');
           }, 2000);
        },
        500: function (response) {
           $('#message').text('Error while attempting to archive!');
           setTimeout(function () {
             $('#message').text('');
           }, 2000);
        }
     }
  });
});

$('#stoparchive').click(function() {
    $.ajax("http://localhost:3000/archive/stop/"+AP.archiveId, {
       type: "POST",
       statusCode: {
          200: function (response) {
             $('#message').text('Broadcast archive stopped!');
             setTimeout(function () {
               $('#message').text('');
             }, 2000);

          },
          500: function (response) {
             $('#message').text('Error while attempting to stop archive!');
             setTimeout(function () {
               $('#message').text('');
             }, 2000);
          }
       }
    });
});

//===========================================================================//
//                         Screenshot Functions                              //
//===========================================================================//

$('#screenshot').click(function() {
  var screenTarget;

  //Check if there is anyone to screenshot
  if (!AP.currentTribute) {
   $('#message').text('There\'s noone to screenshot!');
   setTimeout(function () {
     $('#message').text('');
   }, 2000);   
   return;
  }

  //Check if you are screenshotting yourself
  else if (AP.onStage) {
    screenTarget = AP.publisher;    
  } else {
    screenTarget = AP.subscribers[AP.currentTribute];
  }
  //Otherwise screenshot other subscriber
  var imgData = screenTarget.getImgData();
  var img = document.createElement("img");
  img.setAttribute("src", "data:image/png;base64," + imgData); 

  // Replace with the parent DIV for the img
  document.getElementById("screenshots").appendChild(img);
});

