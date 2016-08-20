// Regex-pattern to check URLs against. 
// It matches URLs like: http[s]://[...]youtube.com/watch[...]
var urlRegex = /^https?:\/\/(?:[^./?#]+\.)?youtube\.com\/watch/;

var partMatchFails = ["lyrics", "lyric", "official", "video", "remix"];

function doStuffWithTitle(res) {
	var user = res.user;
	var title = res.title;

	var parts = title.split(/ – | - |[:()\[\]|]/);

	var primaryArtist = null;
	var artists = [];
	var track = null;

	while(parts.length > 0) {
		var part = parts[0].trim().toLowerCase();

		if(part === "") {
			parts.splice(0, 1);
			continue;
		}

		var cont = false;
		for(var j = 0; j < partMatchFails; j++) {
			if(part.includes(partMatchFails[j])) {
				cont = true;
				break;
			}
		}

		if(cont) {
			parts.splice(0, 1);
			continue;
		}

		var ftIndex = null;
		if(part.includes(" ft.")) {
			ftIndex = part.indexOf(" ft.");
		} else if(part.includes(" feat")) {
			ftIndex = part.indexOf(" feat");
		} else if(part.startsWith("ft.") || part.startsWith("feat")) {
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

	var artistSearch = "";
	for(i = 0; i < artists.length; i++) {
		artistSearch += 'artist:"' + artists[i] + '"';
	}

	var search = artistSearch + 'track:"' + track + '"';
	var url = "https://play.spotify.com/search/" + encodeURIComponent(search);

	chrome.tabs.create({"url": url});
}

chrome.browserAction.onClicked.addListener(function(tab) {
	if(urlRegex.test(tab.url)) {
		chrome.tabs.sendMessage(tab.id, {text: "report_back"}, doStuffWithTitle);
	}
});
