var AnimalPark = function () {

}

var AP = new AnimalPark();

$('.introDialog button').click(function () {
  if ( $('.introDialog input').val() ) {

    //If there is a username entered, transition to main app
    AP.username = escape($('.introDialog input').val());
    $('.introDialog input').val("");
    $('.splash').fadeOut(2000, function() { $(this).remove(); });
    //Ask server for sessionId and token  
    $.ajax({
      type: "POST",
      url: "/start",
      data: {username: AP.username},
      success: function (data) {
      sessionId = data.sessionId,
      token = data.token;

      //Create session object with server generated credentials
      var session = OT.initSession(apiKey, sessionId);

      //Event listener to add other publishers
      session.on("streamCreated", function (event) {
        session.subscribe(event.stream);
      });

      //Connect to session
      session.connect(token, function(error) {
          var publisher = OT.initPublisher();
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