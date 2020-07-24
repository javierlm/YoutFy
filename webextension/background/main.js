
let baseRequestURL = '';

/**
 * Listener for like and unlike requests made by Youtube site. It obtains the information about the tab that has produced the request, and then it gets the URL to send it to the backend
 */
browser.webRequest.onBeforeRequest.addListener(
  (request) => {
    const url = new URL(request.url);
    if (!url.pathname.includes("like")) {
      return;
    }
    if (url.pathname.includes("/like/like")) {
      let infoTab = browser.tabs.get(request.tabId);
      infoTab.then((infoTab) => {
        sendData(infoTab.url, true);
      });
    } else {
      let infoTab = browser.tabs.get(request.tabId);
      infoTab.then((infoTab) => {
        sendData(infoTab.url, false);
      });
    }
  },
  {
    urls: [
      "https://www.youtube.com/youtubei/v1/like/like?*",
      "https://www.youtube.com/youtubei/v1/like/removelike?*",
    ],
  }
);

/**
 * Send a refresh token to the backend, and obtain a new access token
 */
async function getRefreshedToken() {
  const requestURL = `${baseRequestURL}/refresh`;

  const driveRequest = new Request(requestURL, {
    method: "POST",
    insecure: true,
    headers: {
      "Content-Type": "application/json",
    },
  });
  let response = await fetch(driveRequest);
  let data = await response.json();
  return data;
}

/**
 * Send access_token, video URLs and a boolean to specify if the song must be added to the playlist (true), or deleted (false)
 * @param {*} request
 * @param {boolean} add
 */
async function sendSongToBackend(request, add) {
  const requestURL = `${baseRequestURL}`;
  let responseCode = 0;

  const driveRequest = new Request(requestURL, {
    method: "POST",
    insecure: true,
    body: JSON.stringify({
      add: add,
      param: [`${request}`],
    }),
    headers: {
      "Content-Type": "application/json",
    },
  });

  let response = await fetch(driveRequest);
  return response.status;
}

async function sendData(request, add) {
  let responseCode;
  let message = add
    ? "Adding song to Spotify..."
    : "Deleting song from Spotify's playlist...";

  browser.notifications.create({
    type: "basic",
    title: "YoutFy",
    iconUrl: "icons/logo_64.png",
    message: message,
  });

  sendSongToBackend(request, add)
    .then(async (responseCode) => {
      if (responseCode == 401) {
        let newTokenInfo = await getRefreshedToken();
        responseCode = await sendSongToBackend(request, add);
      } else if (responseCode == 200) {
        browser.notifications.create({
          type: "basic",
          title: "YoutFy",
          iconUrl: "icons/tick.png",
          message: "Operation completed succesfully",
        });
      } else {
        browser.notifications.create({
          type: "basic",
          title: "YoutFy",
          iconUrl: "icons/error.png",
          message: "There was an error: Code " + responseCode,
        });
      }
    })
    .catch((reason) => {
      console.log("There was an error: " + reason);
    });
}

chrome.browserAction.onClicked.addListener(() => {
  getSpotifyAccessToken().then(() => {
    browser.notifications.create({
      type: "basic",
      title: "YoutFy",
      iconUrl: "icons/tick.png",
      message:
        "YoutFy has configured correctly. You can use it now",
    });
  });
});
