var AnimalPark = function () {
  this.username = "",
  this.apiKey = "45200812",
  this.sessionId = ""
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
      AP.sessionId = data.sessionId,
      token = data.token;

      //Create session object with server generated credentials
      var session = OT.initSession(AP.apiKey, AP.sessionId);

      //Event listener to add other publishers
      session.on("streamCreated", function (event) {
        //Generate placeholder div to swap with webcam
        $('<div></div>').attr('id', event.stream.name+'Video').css({"display": "inline-block"}).appendTo('.audience');

        var subscriber = session.subscribe(event.stream, event.stream.name+"Video", {name:event.stream.name});
        //Let's restrict audience frame rates since we just want their general reactions, not hi-fi vid
        subscriber.restrictFrameRate(true);

        $('#'+event.stream.name+'Video').css({"height":"100%"});
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