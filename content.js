chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
	if(msg.text === "report_back") {
		sendResponse({
			"user": $("#watch7-user-header .yt-user-info a").text(),
			"title": $("#eow-title").attr("title")
		});
	}
});