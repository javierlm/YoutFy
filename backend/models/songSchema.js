
const mongoose = require('mongoose');

const MONGOURI = process.env.MONGOSTRING;

mongoose.connect(
      MONGOURI,
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useCreateIndex: true
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

//Create index for avoiding duplicates on the database
songSchema.index({ urlVideo: 1,
                   preparedArtist: 1,
                   preparedSong: 1,
                   success: 1 },
                 { unique: true }
                );

module.exports = mongoose.model('songs', songSchema);
