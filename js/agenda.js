var share = null;
var SERVER_LOCATION = "sharejs-server-kahnduong.c9.io";

function makeNewLineItem() {
    return {"id" : Math.random().toString(36).substr(2,4), "done" : false}
}

function createLineItemOnServer(documentKey, lineItemData) {
    var lineItem = share.get(documentKey, lineItemData.id);
    
    lineItem.whenReady(function() {
        if (!lineItem.type) {
            lineItem.create('text');
        }
        
        var context = data.createContext();
        var agenda = context.createContextAt();
        
        agenda.push([], lineItemData, function() {
            lineItem.unsubscribe();
            agenda.destroy();
            context.destroy();
        });
    });
    lineItem.subscribe();
}

function setUpLineItemDisplay(documentKey, lineItemData) {
    var lineItem = share.get(documentKey, lineItemData.id);
    
    lineItem.whenReady(function() {
        // Duplicate the template row, update the ids
        var newItem = $("#meetingItemTemplate").clone();
        newItem.attr("id", lineItemData.id + "-row");
        newItem.removeClass("fake-meeting-item");
        
        newItem.find("textarea").first().attr("id", lineItemData.id);
        
        // update the checkbox and check it if needed
        var checkbox = newItem.find("input:checkbox").first();
        checkbox.attr("id", lineItemData.id + "-done");
        checkbox.prop("checked", lineItemData.done);
        newItem.appendTo("#meetingItems");
        
        // sync the textarea
        var elem = document.getElementById(lineItemData.id);
        lineItem.attachTextarea(elem);
        
        // set the remove listener
        var removeButton = newItem.find("button#item-remove").first();
        removeButton.click(function () {
            var context = data.createContext();
            var jsonData = context.createContextAt();
            
            var lineItems = jsonData.get();
            for (var i = 0; i < lineItems.length; i++) {
                if (lineItems[i].id == lineItemData.id) {
                    jsonData.remove([i], function() {
                        jsonData.destroy();
                        context.destroy();
                    });
                    break;
                }
            }
        });
        
        // set the up button listener
        var upButton = newItem.find("button#item-move-up").first();
        upButton.click(function () {
            var context = data.createContext();
            var jsonData = context.createContextAt();
            
            var lineItems = jsonData.get();
            for (var i = 0; i < lineItems.length; i++) {
                if (lineItems[i].id == lineItemData.id) {
                    if (i == 0) {
                        window.alert("You can't move that up any farther!");
                    }
                    else {
                        jsonData.move(i, i - 1, function() {
                            jsonData.destroy();
                            context.destroy();
                        });
                    }
                    break;
                }
            }
        });
        
        // set the up button listener
        var downButton = newItem.find("button#item-move-down").first();
        downButton.click(function () {
            var context = data.createContext();
            var jsonData = context.createContextAt();
            
            var lineItems = jsonData.get();
            for (var i = 0; i < lineItems.length; i++) {
                if (lineItems[i].id == lineItemData.id) {
                    if (i == (lineItems.length - 1)) {
                        window.alert("You can't move that down any farther!");
                    }
                    else {
                        jsonData.move(i, i + 1, function() {
                            jsonData.destroy();
                            context.destroy();
                        });
                    }
                    break;
                }
            }
        });
        
        // set a listener to update the JSON on updates
        checkbox.change(function() {
            var context = data.createContext();
            var jsonData = context.createContextAt();
            
            var lineItems = jsonData.get();
            for (var i = 0; i < lineItems.length; i++) {
                if (lineItems[i].id == lineItemData.id) {
                    jsonData.set([i, "done"], this.checked);
                    break;
                }
            }
        });
    });
    
    lineItem.subscribe();
}

var data = null;
function setup() {
    var getUrlParameter = function (name) {
        return (new RegExp(name + '=' + '(.+?)(&|$)').exec(window.location.search)||[,null])[1];
    };
    
    var ws = new WebSocket('ws://' + SERVER_LOCATION);
    share = new sharejs.Connection(ws);
    
    // Get the document key and make the link visible so others can join
    var documentKey = getUrlParameter('doc');
    if (!documentKey) {
        // quick solution, not guaranteed to generate unique ids
        documentKey = Math.random().toString(36).substr(2, 5);
        
        $("#sharelink").attr("href", window.location.origin + window.location.pathname + "?doc=" + documentKey);
        $("#sharelink").text(window.location.origin + window.location.pathname + "?doc=" + documentKey);
    }
    else {
        $("#sharelink").attr("href", window.location.href);
        $("#sharelink").text(window.location.href);
    }
    
    data = share.get('agenda', documentKey);
    data.whenReady(function() {
        if (!data.type) {
            data.create('json0');
        }
        
        var context = data.createContext();
        var jsonData = context.createContextAt();
        
        if (jsonData.get() === null) {
            jsonData.set([]);
            // start off with no entry, let the server create it first, then share with others
            createLineItemOnServer(documentKey, makeNewLineItem());
        }
        else {
            var items = jsonData.get();
            for (var i = 0; i < items.length; i++) {
                setUpLineItemDisplay(documentKey, items[i]);
            }
        }
        
        var dragFrom = null;
        
        jsonData.on('move', function(from, to) {
			// At this point, the json has already been moved, so we
			// move the HTML element at index 'to' to 'from'
			
			if ((to - from) > 0) {
			    // moving down
        		var rowId = "#" + jsonData.get()[to].id + "-row";
        		var row = $(rowId);
        		var next = row.next();
        		row.detach();
        		row.insertAfter(next);
			}
			else {
    			var rowId = "#" + jsonData.get()[to].id + "-row";
    			var row = $(rowId);
    			var prev = row.prev();
    			row.detach();
    			row.insertBefore(prev);
			}
		});
		jsonData.on('insert', function(position, data) {
		    setUpLineItemDisplay(documentKey, data);
		    
		    
		});
		jsonData.on('replace', function(position, was, now) {
		    console.log(position, was, now);
		});
		jsonData.on('delete', function (position, data) {
		    var rowId = "#" + data.id + "-row";
		    $(rowId).remove();
		    //$(".item-row").index(position).remove();
		});
		jsonData.on('child op', function (path, op) {
		    // only replacements expected: {p:[path,key], od:before, oi:after}
		    if (op.od != op.oi) {
    		    var id = "#" + jsonData.get()[path[0]].id + "-done"; // get the corresponding checkbox id
    		    var checkbox = $(id);
    		    checkbox.prop("checked", op.oi);
		    }
		});
    });
    
    data.subscribe();
    
    
    $("#add_new_item_button").click(function() {
        var context = data.createContext();
        var agenda = context.createContextAt([]);
        createLineItemOnServer(documentKey, makeNewLineItem());
    });
}

$(setup);