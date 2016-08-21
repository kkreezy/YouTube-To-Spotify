// Regex-pattern to check URLs against. 
// It matches URLs like: http[s]://[...]youtube.com/watch[...]
var urlRegex = /^https?:\/\/(?:[^./?#]+\.)?youtube\.com\/watch/;

var partMatchFails = ["lyrics", "lyric", "official", "video", "remix", "explicit"];
var conjunctionRegex = /, | & | and | + /;

var artists = [];
var track = null;

function parseContentScriptResponse(res) {
	var user = res.user;
	var title = res.title;

	var parts = title.split(/ – | - |[:()\[\]|]/);

	var primaryArtist = null;

	while(parts.length > 0) {
		var part = parts[0].trim();
		var partLower = part.toLowerCase();

		if(part === "") {
			parts.splice(0, 1);
			continue;
		}

		var cont = false;
		for(var j = 0; j < partMatchFails; j++) {
			if(partLower.includes(partMatchFails[j])) {
				cont = true;
				break;
			}
		}

		if(cont) {
			parts.splice(0, 1);
			continue;
		}

		var ftIndex = null;
		if(partLower.includes(" ft.")) {
			ftIndex = partLower.indexOf(" ft.");
		} else if(partLower.includes(" feat")) {
			ftIndex = partLower.indexOf(" feat");
		} else if(partLower.startsWith("ft.") || partLower.startsWith("feat")) {
			ftIndex = 0;
		}

		if(ftIndex !== null) {
			if(ftIndex === 0) {
				part = part.substr(part.indexOf(" ") + 1);
				let featured = part.split(conjunctionRegex);
				artists.push(...featured);

				parts.splice(0, 1);
				continue;
			} else {
				var featPart = part.substr(ftIndex);

				part = part.substr(0, ftIndex).trim();
				parts.splice(1, 0, featPart);
			}
		}

		if(primaryArtist === null) {
			let primaryArtists = part.split(conjunctionRegex);
			primaryArtist = primaryArtists[0];
			artists.unshift(...primaryArtists);

			parts.splice(0, 1);
			continue;
		}

		if(track === null) {
			track = part.replace(/"/g, "");

			parts.splice(0, 1);
			continue;
		}

		parts.splice(0, 1);
	}

	console.log("Artist: " + primaryArtist);
	console.log("Track: " + track);
	console.log("Featuring: " + artists);

	populatePopup();
	search(getQuery());
}

function populatePopup() {
	$("#artists-input textarea").val(artists.join("\n"));
	$("#track-input input").val(track);
}

$(document).ready(function() {
	$("#submit-search").click(function() {
		search(getQuery());
	});
});

function getQuery() {
	artists = $("#artists-input textarea").val().split("\n");
	track = $("#track-input input").val();

	var artistSearch = "";
	for(i = 0; i < artists.length; i++) {
		artistSearch += 'artist:"' + artists[i] + '"';
	}

	return artistSearch + 'track:"' + track + '"';
}

function search(query) {
	$("#search-results").empty();
	$("#loading-spinner").addClass("is-active");

	$.get(
		"https://api.spotify.com/v1/search",
		{ type: "track", limit: 5, q: query },
		function(data) {
			var items = data.tracks.items;
			if(items.length > 0) {
				loadTracks(items);
			} else {
				$("#loading-spinner").removeClass("is-active");
				displayMessage("No tracks found.", "#f44336");
			}
		}
	);
}

function displayMessage(message, color) {
	$("#toast").css("visibility", "visible");
	var notification = document.querySelector('#toast');
	notification.MaterialSnackbar.showSnackbar({ "message": message });

	/*$("#message").text(message);
	$("#message").css({
		"background-color": color,
		"visibility": "visible",
		"position": "static"
	});

	window.setTimeout(function() {
		$("#message").css({
			"visibility": "hidden",
			"position": "absolute"
		});	
	}, 3000);*/
}

function loadTracks(items) {
	var loadedCount = 0;
	for(var i = 0; i < items.length; i++) {
		let uri = items[i].uri;

		let iframeId = "track-result-" + i;
		let $iframe = $("<iframe>", { id: iframeId, height: "80", frameborder: "0", allowtransparency: "true",
			src: "https://embed.spotify.com/?theme=white&uri=" + uri });
		$iframe.css("visibility", "hidden");
		$iframe.css("position", "absolute");
		/*jshint loopfunc: true */
		$iframe.on('load', function() {
			$iframe.css("visibility", "visible");
			$iframe.css("position", "static");
			loadedCount++;
			if(loadedCount === items.length) {
				$("#loading-spinner").removeClass("is-active");
			}
		});

		$("#search-results").append($iframe);
	}
}

chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
	var tab = tabs[0];
	if(urlRegex.test(tab.url)) {
		chrome.tabs.sendMessage(tab.id, {text: "report_back"}, parseContentScriptResponse);
	}
});
