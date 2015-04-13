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
  this.votes = {};
  this.hasVotedThisRound = false;
  this.heartbeat = false;
}


var AP = new AnimalPark();

var serverAddress = "http://animalpark.herokuapp.com";
// var serverAddress = "http://localhost:3000";

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

function updateVotes (votesDB) {
  var voteArray = [],
      maxVotes = 0,
      sortedData;

  //Sort data
  for (var animal in votesDB) {
    voteArray.push({animal: animal, votes: votesDB[animal]});
    maxVotes = maxVotes + votesDB[animal];
  }

  sortedData = voteArray.sort(function(a, b){return b.votes-a.votes}).slice(0,4);

  var x = d3.scale.linear()
      .domain([0, maxVotes])
      .range([0, 420]);

  $('.chart').empty();

  d3.select(".chart")
    .selectAll("div")
      .data(sortedData)
    .enter().append("div")
      .style("width", function(d) { return x(d.votes) + "px"; }).style("visibility", function (d) { return (d.votes > 0) ? "visible" : "hidden"; })
      .text(function(d) { return d.animal+': '+d.votes+' votes'; });
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
    $('.splash').fadeOut(2000, function() { 
      $(this).remove(); 
      //focus cursor on guess input on load
      $( '#guess input' ).focus();
    });

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
        var voteArray = [],
            maxVotes = 0;

        console.log("Signal sent from connection " + event.from.id);
        // Process the vote.

        //First sanitize and normalize inputs.
        var vote = escape(event.data.vote).toLowerCase(),
            username = escape(event.data.username);

        //If user already voted, subtract from old vote first
        if (AP.userVotes[username]) {
          var oldVote = AP.userVotes[username];
          AP.votes[oldVote] = AP.votes[oldVote] - 1;
        }

        //Otherwise store their vote and update rankings
        AP.userVotes[username] = vote;

        //If this animal doesnt exist, init as 1
        if (AP.votes[vote] === undefined) {
          AP.votes[vote] = 1;
        } else {
          AP.votes[vote] = AP.votes[vote] + 1;          
        }

        //Sort data
        for (var animal in AP.votes) {
          voteArray.push({animal: animal, votes: AP.votes[animal]});
          maxVotes = maxVotes + AP.votes[animal];
        }

        var sortedData = voteArray.sort(function(a, b){return b.votes-a.votes}).slice(0,4);

        var x = d3.scale.linear()
            .domain([0, maxVotes])
            .range([0, 420]);

        $('.chart').empty();

        d3.select(".chart")
          .selectAll("div")
            .data(sortedData)
          .enter().append("div")
            .style("width", function(d) { return x(d.votes) + "px"; }).style("visibility", function (d) { return (d.votes > 0) ? "visible" : "hidden"; })
            .text(function(d) { return d.animal+': '+d.votes+' votes'; });
      });

    //===========================//    
    //     Tribute handling      //
    //===========================// 

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
      AP.hasVotedThisRound = false;
      AP.totalVotes = 0;
      AP.userVotes = {};
      AP.votes = {};
      $('.chart').empty();
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
      AP.userVotes = {};
      AP.votes = {};
      $('.chart').empty();
    });

    //===========================//    
    // Listen for votes update   //
    //===========================// 

    //Listen for other clients updated votes list
    session.on("signal:voteUpdate", function (event) {
      if (Object.keys(AP.userVotes).length < Object.keys(event.data.userVotes).length) {
        AP.userVotes = event.data.userVotes;
        AP.votes = event.data.votes;
        //Force update render of votes chart
        updateVotes(AP.votes);
      }
    });

    //===========================//    
    //   Send them our votes     //
    //===========================//
    session.on('connectionCreated', function (event) {
      var connection = event.connection;
      session.signal({
                      to: connection,
                      data: {votes: AP.votes, userVotes: AP.userVotes},
                      type: "voteUpdate"
                    },
        function(error) {
          if (error) {
            console.log("vote update signal error ("
                         + error.code
                         + "): " + error.message);
          } else {
            console.log("vote update signal sent.");
          }
        }
      );
    }); 

    //===========================//    
    //     START THE ENGINES     //
    //===========================//

      var pubVideo = $('#sendVideo').is(":checked"),
          pubAudio = $('#sendAudio').is(":checked");

      //Connect to session
      session.connect(token, function(error) {
          //High res - because we can
          var publisher = OT.initPublisher('webcam', 
            {
              name: AP.username, 
              resolution: '1280x720', 
              publishAudio: pubAudio, 
              publishVideo: pubVideo
            }
          );
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
//                   Tribute Volunteer Buttons                               //
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

  if(AP.session.connections.length() > 9) {
    flashMessage('>>> OpenTok API can only record first NINE (9) streams!');
  }

  if (AP.archiveId) {
   flashMessage('You\'re already recording this session!');
   return;
  }

  $.ajax(serverAddress+"/archive/start", {
     type: "POST",
     data: {username: AP.username, sessionId: AP.sessionId},
     statusCode: {
        200: function (response) {

           AP.archiveId = response;
           
           flashMessage('Broadcast is archiving!');
        },
        500: function (response) {
           flashMessage('Error while attempting to archive!');
           flashMessage('Error message: '+response.responseJSON.message);           
        }
     }
  });
});

$('#stoparchive').click(function() {
    $.ajax(serverAddress+"/archive/stop", {
       type: "POST",
       data: {archiveId: AP.archiveId},
       statusCode: {
          200: function (response) {
             AP.archiveId = undefined;
             flashMessage('Broadcast archive stopped!');
          },
          500: function (response) {
             flashMessage('Error while attempting to stop archive!');
             flashMessage('Error message: '+response.responseJSON.message);           
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

    $.ajax(serverAddress+"/archive/list/"+AP.username, {
       type: "GET",
       statusCode: {
          200: function (response) {
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
              var container = $('<div></div>').addClass("well well-lg");
              
              var linkEl = $('<a download></a>').attr('href', downloadLink);
              var linkButtonDownload = $('<button></button>').text('Download archive');
              linkButtonDownload.on('click', function () {
                linkEl[0].click();
              });

              var linkButtonDelete = $('<button></button>').text('Delete archive');
              linkButtonDelete.on('click', function () {
                $.ajax(serverAddress+"/archive/delete", {
                   type: "POST",
                   data: {archiveId: archiveIds[i], username: AP.username},
                   statusCode: {
                      200: function (response) {
                         container.slideUp(1000, function(){ $(this).remove(); });
                      },
                      500: function (response) {
                         flashMessage('Error while attempting to delete archive!');
                         flashMessage('Error message: '+response.responseJSON.message);           
                      }
                   }
                });
              });

              $(container).append(linkButtonDownload).append(linkButtonDelete);              
              //Append video element
              var videoEl = $('<video controls name=\"media\"></video>').append($("<source></source>").attr('src', downloadLink));              
              $(container).append(videoEl);

              $('.videoContainer').append(container);
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

