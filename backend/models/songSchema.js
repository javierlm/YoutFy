
const mongoose = require('mongoose');

const MONGOURI = process.env.MONGOSTRING;

mongoose.connect(
      MONGOURI,
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
    function (err) {
      if (err) throw err;
      console.log('Successfully connected');
    }
);

let songSchema = mongoose.Schema({
    urlVideo: String,
    title: String,
    artist: String,
    song: String,
    preparedArtist: String,
    preparedSong: String,
    spotifyUri: String,
    success: Boolean,
});

module.exports = mongoose.model('songs', songSchema);
