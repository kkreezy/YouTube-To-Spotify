// Regex-pattern to check URLs against. 
// It matches URLs like: http[s]://[...]youtube.com/watch[...]
var urlRegex = /^https?:\/\/(?:[^./?#]+\.)?youtube\.com\/watch/;

var partMatchFails = ["lyrics", "lyric", "official", "video", "remix"];

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
				artists = part.split(/ , | & /);
				parts.splice(0, 1);
				continue;
			} else {
				var featPart = part.substr(ftIndex);
				part = part.substr(0, ftIndex).trim();
				parts.splice(1, 0, featPart);
			}
		}

		// TODO: Split primary artist part on ',', '&' just like featured artists
		if(primaryArtist === null) {
			primaryArtist = part;
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

	artists.unshift(primaryArtist);

	populatePopup();
}

function populatePopup() {
	$("#artists-input textarea").val(artists.join("\n"));
	$("#track-input input").val(track);
}

$(document).ready(function() {
	$("#submit-search").click(function() {
		artists = $("#artists-input textarea").val().split("\n");
		track = $("#track-input input").val();

		var artistSearch = "";
		for(i = 0; i < artists.length; i++) {
			artistSearch += 'artist:"' + artists[i] + '"';
		}

		var query = artistSearch + 'track:"' + track + '"';
		search(query);
	});
});

var iframeStart = '<iframe src="https://embed.spotify.com/?theme=white&uri=';
var iframeEnd = '" width="250" height="80" frameborder="0" allowtransparency="true"></iframe>';

function search(query) {
	/*var url = "https://play.spotify.com/search/" + encodeURIComponent(search);
	chrome.tabs.create({"url": url});*/

	$("#search-results").empty();

	$.get(
		"https://api.spotify.com/v1/search",
		{type: "track", limit: 5, q: query},
		function(data) {
			var items = data.tracks.items;
			for(var i = 0; i < items.length; i++) {
				var uri = items[i].uri;
				$("#search-results").append(iframeStart + uri + iframeEnd);
			}
		}
	);
}

chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
	var tab = tabs[0];
	if(urlRegex.test(tab.url)) {
		chrome.tabs.sendMessage(tab.id, {text: "report_back"}, parseContentScriptResponse);
	}
});
