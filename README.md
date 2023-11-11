# Stimulus Audio Player
Date and time input stimulus controller.

### Demo
[Stimulus Audio Player Demo](https://gregarious-treacle-078ba8.netlify.app/)

### Installation

`yarn add stimulus-audio-player`
`npm install stimulus-audio-player`


### Usage

```js
// bootstrap.js
import {Application} from '@hotwired/stimulus'
import AudioPlayer from 'src/audio-player'

const app = Application.start()
app.register('audio-player', AudioPlayer)
```

```html
 <div data-controller="audio-player"
      data-audio-player-file-value="./audio-example.mp3" data-audio-player-theme-value="default">
</div>
```

### Themes

- `data-audio-player-theme-value="dark"`
- `data-audio-player-theme-value="light"`
- `data-audio-player-theme-value="default"` (crazy, but this one is default)
