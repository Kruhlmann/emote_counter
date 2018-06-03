'use srict';

// Function for pulling emote and channel data
function updateData(){
    
}

// Function for adding enter press listeners on jQuery objects
$.fn.onEnterPress = function(fn){
    return this.each(function(){
        $(this).bind("enterPress", fn);
        $(this).keyup(function(e){
            // 13 is enter.
            if(e.keyCode == 13) $(this).trigger("enterPress");
        });
    });
}

// Add event listener to channel input and append classes for valid/invalid channels.
$(".channel-input").on("input", function(){
    // Keep the element without additional classes if empty.
    if($(".channel-input").val() == ""){
        $(".channel-input").removeClass("channel-input-valid");
        $(".channel-input").removeClass("channel-input-invalid");
    }
        
    // Validate input.
    $.get("api/channel_exists/" + $(".channel-input").val(), function(data){
        if(data.channel_exists){
            $(".channel-input").addClass("channel-input-valid");
            $(".channel-input").removeClass("channel-input-invalid");
        }else{
            $(".channel-input").addClass("channel-input-invalid");
            $(".channel-input").removeClass("channel-input-valid");
        }
    });
});

// Validate data and send on enter press.
$(".channel-input").onEnterPress(function(){
    console.log("Adding " + $(".channel-input").val());
});

// Runs on document.ready. Pulls remote data and starts a loop pulling every 5 seconds
$(function(){
    updateData();
    setInterval(function(){
        updateData();
    }, 5000);
})
