const express = require('express');
const ytdl = require('ytdl-core');
const SpotifyWebApi = require('spotify-web-api-node');
const https = require('https');
const fs = require('fs');
const Song = require('./models/songSchema');
const session = require('express-session');
const MongoStore = require('connect-mongo')(session);

const PORT = process.env.PORT || 5000;
const MONGOURI = process.env.MONGOSTRING;
const clientId = process.env.CLIENTID;
const clientSecret = process.env.CLIENTSECRET;
const cookieSecret = process.env.COOKIESECRET;

const Entities = require('html-entities').AllHtmlEntities;
const entities = new Entities();

const app = express();

//Middleware
app.use(express.json());
app.use(
  session({
    secret: cookieSecret,
    resave: false,
    saveUninitialized: false,
    store: new MongoStore({
      url:
        MONGOURI,
      autoReconnect: true,
    }),
  })
);

function getSpotifyAPI(redirectURI = '') {
  let spotifyApi = new SpotifyWebApi({
    clientId,
    clientSecret,
    redirectUri: redirectURI,
  });
  return spotifyApi;
}

/**
 * Gets the playlist if it exists, or create a new one. It returns the playlist to insert on it the songs later
 * @param {string} spotifyToken
 */
async function getCustomPlaylist(spotifyApi) {
  let youtfyPlaylist;
  let result = await spotifyApi.getUserPlaylists();
  for (const actualResult of result.body.items) {
    if (actualResult.name === 'YoutFy') {
      return actualResult;
    }
  }
  try {
    let userInfo = await spotifyApi.getMe();
    youtfyPlaylist = await spotifyApi.createPlaylist(
      userInfo.body.id,
      'YoutFy',
      { public: false }
    );
  } catch (error) {
    console.log(error);
    return null;
  }
  return youtfyPlaylist.body;
}

/**
 * Endpoint to obtain a token from Spotify's code
 */
app.post('/token', (req, res) => {
  let code = req.body.code;
  let spotifyApiCode = getSpotifyAPI(req.body.redirect_uri);

  spotifyApiCode.authorizationCodeGrant(code).then(
    function (data) {
      let accessToken = data.body['access_token'];
      let refreshToken = data.body['refresh_token'];

      req.session.accessToken = accessToken;
      req.session.refreshToken = refreshToken;
      return res.status(200).send(JSON.stringify({ message: 'Token sent' }));
    },
    function (err) {
      console.log('Something went wrong!', err);
    }
  );
});

function updateSessionAccessToken(data, req, res) {
  let newAccesToken = data.body['access_token'];
  delete req.session.accessToken;
  req.session.accessToken = newAccesToken;
  console.log('A Token was refreshed');
  return res.status(200).send(JSON.stringify({ message: 'Token refreshed' }));
}

/**
 * Obtains a new access token, using the refresh token given by the extension, and returns it
 */
app.post('/refresh', (req, res) => {
  res.set('Content-Type', 'application/json');
  let spotifyApiCode = getSpotifyAPI(req.body.redirect_uri);
  let refreshToken = req.session.refreshToken;
  spotifyApiCode.setRefreshToken(refreshToken);
  spotifyApiCode
    .refreshAccessToken()
    .then((data) =>
      updateSessionAccessToken(data, req, res))
    .catch((reason) => {
      console.log(reason);
      return res
        .status(500)
        .send(JSON.stringify({ message: 'Error refreshing token' }));
    });
});

function printSummary(add, newSong) {
  console.log(
    '-----------------------------------------------------------------------------'
  );
  if (add) console.log('Added track to playlist!');
  else console.log('Deleted track from playlist!');
  console.log(`Track: ${newSong.artist}     Title: ${newSong.song}`);
  console.log(
    '-----------------------------------------------------------------------------'
  );
}

function replaceCharactersFromTrack(track) {
  track = entities
    .decode(
      track
        .replace(/\(.*\)/, '')
        .replace(/\[.*\]/, '')
        .split("'")
        .join('')
    )
    .trim();
  return track;
}

function replaceCharactersFromArtist(artist) {
  artist = entities
    .decode(
      artist
        .replace(' &', ',')
        .replace(' vs', ',')
        .replace(' ft.', ',')
        .replace(' feat.', ',')
        .replace(' feat', ',')
        .split("'")
        .join('')
    )
    .trim();
  return artist;
}

function extractSongInfo(promisesArray, newSong) {
  let songsInfo = [];
  for (let video of promisesArray) {
    if (video.videoDetails.media.song != null && video.videoDetails.media.artist != null) {
      newSong.artist = entities.decode(video.videoDetails.media.artist.split("'").join('')).trim();
      newSong.song = entities.decode(video.videoDetails.media.song.split("'").join('')).trim();
      newSong.title = video.videoDetails.title;

      songsInfo.push({
        artist: replaceCharactersFromArtist(video.videoDetails.media.artist),
        track: replaceCharactersFromTrack(video.videoDetails.media.song),
      });
    } else {
      console.log(
        "-------- There's no info about the song given by Youtube, trying alternative method based on the video title --------"
      );
      const videoInfoTitle = video.videoDetails.title.split('-');

      video.artist = video.artist || videoInfoTitle[0];
      video.track = video.track || videoInfoTitle[1];

      newSong.title = video.videoDetails.title;
      newSong.song = entities.decode(video.track.split("'").join('')).trim();
      newSong.artist = videoInfoTitle[0].trim();

      songsInfo.push({
        artist: replaceCharactersFromArtist(video.artist),
        track: replaceCharactersFromTrack(video.track),
      });
    }
  }
  return Promise.resolve({
    newSong,
    songsInfo,
  });
}


function searchSpotifySongs(songsInfo, newSong, spotifyApi) {
  const songsPromises = songsInfo.map((video) => {
    newSong.preparedArtist = entities.decode(video.artist).trim();
    newSong.preparedSong = video.track.trim();
    return spotifyApi.searchTracks(
      `artist:${video.artist.trim()} track:${video.track.trim()}`
    );
  });
  return Promise.all(songsPromises);
}

function getSpotifyUri(songs_promises, newSong) {
  let songsArray = [];
  for (const song of songs_promises) {
    if (song.body.tracks.items.length != 0) {
      songsArray.push(song.body.tracks.items[0].uri);
      newSong.spotifyUri = song.body.tracks.items[0].uri;
    } else {
      console.log('URI not found on Spotify for the song');
    }
  }
  return {
    songsArray,
    newSong,
  };
}

// TODO: Find a way to suppress problematic strings on the name of the song, as "(feat X)" and so on
app.post('/', async (req, res) => {
  let promisesArray = [];
  let youtfyPlaylist = [];
  let add;
  let accessToken = req.session.accessToken;
  let spotifyApi = getSpotifyAPI();
  spotifyApi.setAccessToken(accessToken);
  let newSong = new Song();
  let today = new Date();
  let date =
    today.getHours() + ':' + today.getMinutes() + ':' + today.getSeconds();

  console.log(date + ' Request received');
  res.set('Content-Type', 'application/json');

  for (let video of req.body.param) {
    promisesArray.push(ytdl.getInfo(video));
    newSong.urlVideo = video;
  }

  try {
    youtfyPlaylist = await getCustomPlaylist(spotifyApi);
    add = req.body.add;
  } catch (error) {
    console.log(error);
    if (error.statusCode == 401) {
      return res.status(401).send(JSON.stringify({ message: 'Token expired' }));
    } else {
      return res.status(500).send(JSON.stringify({ message: error }));
    }
  }

  Promise.all(promisesArray)
    .then((promisesArray) =>
      extractSongInfo(promisesArray, newSong))
    .then(({ newSong, songsInfo }) =>
      searchSpotifySongs(songsInfo, newSong, spotifyApi)
    )
    .then(async (songs_promises) => {
      let returnedValues = getSpotifyUri(songs_promises, newSong);
      let songsArray = returnedValues.songsArray;
      newSong = returnedValues.newSong;
      if (add) {
        spotifyApi.addTracksToPlaylist(youtfyPlaylist.id, songsArray).then(
          function () {
            newSong.success = true;
            newSong.save(function (err) {
              if (err && err.code && err.code === 11000) {
                console.warn('Song already on database');
              } else if (err) {
                console.error(err);
              }
            });
            return res
              .status(200)
              .send(JSON.stringify({ message: 'Song added' }));
          },
          function (err) {
            console.log('Something went wrong!', err);
            newSong.success = false;
            newSong.save(function (err) {
              if (err && err.code && err.code === 11000) {
                console.warn('Song already on database');
              } else if (err) {
                console.error(err);
              }
            });
            return res
              .status(500)
              .send(JSON.stringify({ message: 'Song not found' }));
          }
        );
      } else {
        let tracks = [{ uri: songsArray[0] }];
        spotifyApi.removeTracksFromPlaylist(youtfyPlaylist.id, tracks).then(
          function () {
            return res
              .status(200)
              .send(JSON.stringify({ message: 'Song removed' }));
          },
          function (err) {
            console.log('Something went wrong!', err);
            return res
              .status(500)
              .send(JSON.stringify({ message: 'Song not found' }));
          }
        );
      }
      return newSong;
    })
    .then((newSong) =>
      printSummary(add, newSong));
});

https.createServer({
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.cert')
}, app).listen(PORT, '0.0.0.0', () => {
  console.log(`YoutFy listening on port ${PORT}`);
});
