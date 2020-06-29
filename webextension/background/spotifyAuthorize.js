
const REDIRECT_URL = browser.identity.getRedirectURL();
const API_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const CLIENT_ID = '';
const SCOPES = [
  'playlist-modify-private',
  'playlist-modify-public',
  'playlist-read-private',
  'playlist-read-collaborative',
];

const AUTH_URL = `https://accounts.spotify.com/authorize\
?client_id=${CLIENT_ID}\
&response_type=code\
&redirect_uri=${encodeURIComponent(REDIRECT_URL)}\
&scope=${encodeURIComponent(SCOPES.join(" "))}`;

/**
 * It extracts the token from the URL
 * @param {string} redirectUri
 */
async function extractAccessToken(redirectURL) {
  let m = redirectURL.split('=');
  if (!m || m.length < 1) return null;
  return m[1];
}

/**
 * Gets Spotify code from redirect URL
 * @param {string} redirectURL
 */
function validate(redirectURL) {
  const code = extractAccessToken(redirectURL);
  if (!code) {
    throw "Authorization failure";
  }
  return code;
}

/**
 * Get a valid access token from server, giving an Spotify code
 * @param {string} code
 */

function obtainAccessTokenFromServer(code) {
  const requestURL = `${baseRequestURL}/token`;
  const driveRequest = new Request(requestURL, {
    method: "POST",
    insecure: true,
    body: JSON.stringify({
      code: code,
      redirect_uri: REDIRECT_URL,
    }),
    headers: {
      "Content-Type": "application/json",
    },
  });

  fetch(driveRequest).then(async (response) => {
    if (response.status === 200) {
      console.log("Token requested");
    } else {
      throw response.status;
    }
  });
}

/**
Authenticate and authorize using browser.identity.launchWebAuthFlow().
If successful, this resolves with a redirectURL string that contains
an Spotify code for obtaining an Spotify token.
*/
function authorize() {
  return browser.identity.launchWebAuthFlow({
    interactive: true,
    url: AUTH_URL,
  });
}

/**
 * Retrieves a token already stored on the extension storage, or request a new token to the server
 */
async function getSpotifyAccessToken() {
  return authorize()
          .then(validate)
          .then(obtainAccessTokenFromServer);
}
