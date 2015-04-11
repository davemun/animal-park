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
  this.totalVotes = 0;
  this.topFour = [
                  {animal: "None", votes: 0},
                  {animal: "None", votes: 0},
                  {animal: "None", votes: 0},
                  {animal: "None", votes: 0}
                 ];
  this.hasVotedThisRound = false;
  this.heartbeat = false;
}


var AP = new AnimalPark();

var serverAddress = "animalpark.herokuapp.com";
// var serverAddress = "localhost:3000";

//===========================================================================//
//                         Helper Functions                                  //
//===========================================================================//

//Display a temporary message in the #messageContainer.
function flashMessage (msgText, targetEl, removeTime, fadeTime, callback) {
  var message = $('<div></div').text(msgText).addClass('message');

  //Message display are defaults to a #messageContainer element
  targetEl = $(targetEl).length == 0 ? $('#messageContainer') : $(targetEl);

  //message defaults to blank string
  message = message || '';

  //defaults to start fade after 1s
  removeTime = removeTime || 1000;

  //defaults to 1s fade
  fadeTime = fadeTime || 1000;

  //defaults to remove itself from DOM
  callback = callback || function () { $(this).remove(); };

  targetEl.append(message);

  setTimeout(function () {
    message.fadeOut(fadeTime, callback);
  }, removeTime);

  //Return jquery message object for chaining
  return message;
}

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
          flashMessage('Already in use! Please try a new name!', '.introDialog');
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

    //===========================//    
    //   Vote->Ranking Handler   //
    //===========================//

      //Event listener to get votes from other publishers
      session.on("signal:vote", function (event) {
        console.log("Signal sent from connection " + event.from.id);
        // Process the vote.

        //First sanitize and normalize inputs.
        var vote = escape(event.data.vote).toLowerCase(),
            username = escape(event.data.username);

        //If user already voted, ignore
        if (AP.userVotes[username]) {
          return;
        }

        //Otherwise store their vote and update rankings
        var newTally = (AP.userVotes[event.data.vote] === undefined) ? 1 : AP.userVotes[event.data.vote] + 1;
        AP.userVotes[event.data.vote] = newTally;
        AP.totalVotes = AP.totalVotes + 1;

        //Slow hack to get ranking working
        var inTopFour = false;

        AP.topFour.forEach(function (rankObj) {
          if (rankObj.animal === event.data.vote) {
            inTopFour = true;
            rankObj.votes = rankObj.votes + 1;
          }
        });

        //Check if new vote count puts in top four
        if (!inTopFour) {
          for (var i = AP.topFour.length-1; i >= 0; i--) {
            if (AP.userVotes[event.data.vote] > AP.topFour[i].votes) {
              AP.topFour[i] = {animal: event.data.vote, votes: AP.userVotes[event.data.vote]};
              break;
            }
          }
        }

        //Update voting bars on front end display
        var rankOnePercent = Math.floor( (AP.topFour[0].votes / AP.totalVotes) * 100 ),
            rankTwoPercent = Math.floor( (AP.topFour[1].votes / AP.totalVotes) * 100 ),
            rankThreePercent = Math.floor( (AP.topFour[2].votes / AP.totalVotes) * 100 ),
            rankFourPercent = Math.floor( (AP.topFour[3].votes / AP.totalVotes) * 100 );

        $('#rankOne').attr("aria-valuenow", rankOnePercent).text(AP.topFour[0].animal + ' ' + rankOnePercent +  '%').css({"width": ""+rankOnePercent+"%"});
        $('#rankTwo').attr("aria-valuenow", rankTwoPercent).text(AP.topFour[1].animal + ' ' + rankTwoPercent +  '%').css({"width": ""+rankTwoPercent+"%"});
        $('#rankThree').attr("aria-valuenow", rankThreePercent).text(AP.topFour[2].animal + ' ' + rankThreePercent +  '%').css({"width": ""+rankThreePercent+"%"});
        $('#rankFour').attr("aria-valuenow", rankFourPercent).text(AP.topFour[3].animal + ' ' + rankFourPercent +  '%').css({"width": ""+rankFourPercent+"%"});
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
      AP.hasVotedThisRound = false;
      AP.totalVotes = 0;    
    });

      //Connect to session
      session.connect(token, function(error) {
          //High res - because we can
          var publisher = OT.initPublisher('webcam', {name: AP.username, resolution: '1280x720'});
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
//                     Voting Submission Functions                           //
//===========================================================================//


$('#guess button').click(function () {
  //Check if already voted this round
  if (AP.hasVotedThisRound) {
   flashMessage('You already voted this round!');
   return; 
  }

  var guessString = $('#guess input').val();
  var voteObj = {vote: guessString, username: AP.username};

  if (guessString) {
    $('#guess input').val("");
    AP.session.signal({data: voteObj, type:"vote"}, function (err) {
        if (err) {
          console.log("signal error (" + error.code + "): " + error.message);
        } else {
          AP.hasVotedThisRound = true;
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
  //if there is an archive request already ongoing

  if (AP.archiveId) {
   flashMessage('You\'re already recording this session!');
  }

  $.ajax("http://"+serverAddress+"/archive/start", {
     type: "POST",
     data: {username: AP.username, sessionId: AP.sessionId},
     statusCode: {
        200: function (response) {

           AP.archiveId = response;
           
           flashMessage('Broadcast is archiving!');
        },
        500: function (response) {
           flashMessage('Error while attempting to archive!');
        }
     }
  });
});

$('#stoparchive').click(function() {
    $.ajax("http://"+serverAddress+"/archive/stop", {
       type: "POST",
       data: {archiveId: AP.archiveId},
       statusCode: {
          200: function (response) {
             AP.archiveId = undefined;
             flashMessage('Broadcast archive stopped!');
          },
          500: function (response) {
             flashMessage('Error while attempting to stop archive!');
          }
       }
    });
});

$('#listarchives').click(function() {
    var loadMsgContainer = $('<div></div>').addClass('loadMsg'),
        loadMsg = $('<div></div').text('Loading archives...'),
        spinner = $('<i class="fa fa-spin"></i>');

    loadMsgContainer.append(loadMsg);
    loadMsgContainer.append(spinner);
    $('.videoContainer').append(loadMsgContainer);

    $.ajax("http://"+serverAddress+"/archive/list/"+AP.username, {
       type: "GET",
       statusCode: {
          200: function (response) {
            console.log(response);
             var archiveIds = Object.keys(response),
                  downloadLink;

              //Remove load message since we got answer from server
              $('.loadMsg').slideUp(400, function () { $(this).remove(); } );

              //If you don't have any archives
              if (!archiveIds.length) {
                var noArchiveMsg = $('<div></div').text('Looks like you don\'t have any archives!');
                $('.videoContainer').append(noArchiveMsg);
                return;
              }

             for (var i = 0; i < archiveIds.length; i++) {
              downloadLink = response[archiveIds[i]];
              var linkEl = $('<a></a>').attr('href', downloadLink).text('Archive '+(i+1));
              $('.videoContainer').append(linkEl);
             }
          },
          500: function (response) {
             flashMessage('Error while attempting to get list of archive!');
          }
       }
    });
});

//If close modal clean it out
$('.modalClose').click(function() { 
  $('.videoContainer').empty();
});

//===========================================================================//
//                         Screenshot Functions                              //
//===========================================================================//

$('#screenshot').click(function() {
  var screenTarget;

  //Check if there is anyone to screenshot
  if (!AP.currentTribute) {
   flashMessage('There\'s noone to screenshot!'); 
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
  document.getElementById("imageContainer").appendChild(img);
});

