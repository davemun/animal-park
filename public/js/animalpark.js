var AnimalPark = function () {

}

var AP = new AnimalPark();

$('.introDialog button').click(function () {
  if ( $('.introDialog input').val() ) {

    AP.username = escape($('.introDialog input').val());
    $('.introDialog input').val("");
    $('.splash').fadeOut(2000, function() { $(this).remove(); });

  } else {

    var alertMsg = $('<div>Please enter your name!</div>');
    $('.introDialog').append(alertMsg);
    alertMsg.fadeOut(2000, function() { $(this).remove(); });

  }

});