var serverUrl = "http://localhost:3000/";

// Regex-pattern to check URLs against. 
// It matches URLs like: http[s]://[...]youtube.com/watch[...]
var urlRegex = /^https?:\/\/(?:[^./?#]+\.)?youtube\.com\/watch/;

var partMatchFails = ["lyrics", "lyric", "official", "video", "remix", "explicit"];
var conjunctionRegex = /, | & | and | + /;

var artists = [];
var track = null;

var user;
chrome.storage.sync.get("user", (items) => {
	user = items.user;
	if(user === undefined) {
		user = {};
	}
});

function saveUserData() {
	chrome.storage.sync.set({ "user": user });
}

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

$(document).ready(() => {
	$("#submit-search").click(() => {
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
		(data) => {
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
}

function loadTracks(items) {
	var loadedCount = 0;
	/*jshint loopfunc: true */
	for(var i = 0; i < items.length; i++) {
		let item = items[i];

		let $div = $("<div>", { class: "track" });
		$div.css({
			"visibility": "hidden",
			"position": "absolute"
		});

		let $iframe = $("<iframe>", { id: "track-result-" + i, height: "80", frameborder: "0",
			allowtransparency: "true", src: "https://embed.spotify.com/?theme=white&uri=" + item.uri });
		$iframe.css({
			"display": "inline-block",
			"width": "calc(100% - 48px)"
		});

		$iframe.on('load', () => {
			$div.css({
				"visibility": "visible",
				"position": "static"
			});
			loadedCount++;
			if(loadedCount === items.length) {
				$("#loading-spinner").removeClass("is-active");
			}
		});
		
		let $img = $("<img>", { src: "images/ic_add_black_48dp_1x.png" });
		$img.css({
			"opacity": "0.6"
		});
		$img.click(() => {
			saveTrackToSpotify(item);
		});

		$($div).append($iframe);
		$($div).append($img);
		$("#search-results").append($div);
	}
}

// From: http://stackoverflow.com/a/8809472
function generateUUID(){
	var d = new Date().getTime();
	if(window.performance && typeof window.performance.now === "function"){
		d += performance.now(); //use high-precision timer if available
	}
	var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
		var r = (d + Math.random()*16)%16 | 0;
		d = Math.floor(d/16);
		return (c=='x' ? r : (r&0x3|0x8)).toString(16);
	});
	return uuid;
}

function getClientId() {
	if(user.clientId === undefined) {
		user.clientId = generateUUID();
		saveUserData();
	}
	return user.clientId;
}

function directToAuthenticationServer(info) {
	var url = serverUrl + "authenticate?clientId=" + getClientId() + "&saveTrack=true&trackUri=" + info.uri;
	chrome.tabs.create({ url: url });
}

function requestServerToSaveTrackToSpotify(info) {
	var xhr = new XMLHttpRequest();
	xhr.open("POST", serverUrl + "saveTrack?clientId=" + getClientId() +
		"&spotifyId=" + user.spotifyId + "&trackUri=" + info.uri, true);
	xhr.onreadystatechange = function() {
		if(xhr.readyState == 4) {
			var res = JSON.parse(xhr.responseText);
			if(!res.ok) {	// TODO: Change [PLUS] to [CHECK] in popup
				console.log(res.error);
			}
		}
	};
	xhr.send();
}

function saveTrackToSpotify(info) {
	if(user.spotifyId === undefined) {
		var xhr = new XMLHttpRequest();
		xhr.open("GET", serverUrl + "userInfo?clientId=" + getClientId(), true);
		xhr.onreadystatechange = function() {
			if(xhr.readyState == 4) {
				var res = JSON.parse(xhr.responseText);
				if(res.userAuthenticated) {
					user.spotifyId = res.spotifyId;
					saveUserData();
					requestServerToSaveTrackToSpotify(info);
				} else {
					directToAuthenticationServer(info);
				}
			}
		};
		xhr.send();
	} else {
		requestServerToSaveTrackToSpotify(info);
	}
}

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
	var tab = tabs[0];
	if(urlRegex.test(tab.url)) {
		chrome.tabs.sendMessage(tab.id, {text: "report_back"}, parseContentScriptResponse);
	}
});
