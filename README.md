# YoutFy

<p align="center">
  <img src="youtfy_logo.png">
  <div align="center">Icon design by <a href="https://www.flaticon.es/autores/iconixar" title="iconixar">iconixar</a> from <a href="https://www.flaticon.es/" title="Flaticon">www.flaticon.es</a></div>
</p>

### Description
WebExtension that adds automatically songs liked by you on Youtube, to an Spotify's playlist.

## WebExtension
It contains all the code for the WebExtension. It was tested on the latest versions of Google Chrome, Mozilla Firefox, and Microsoft Edge.

## Backend
It's done using **Node.js**. This part is necessary to store tokens securily, and to not reveal the client secret of the Spotify application. Cookies are used to save tokens, on a MongoDB datastore.

It also stores the results of the detection, to improve it in a near future.
