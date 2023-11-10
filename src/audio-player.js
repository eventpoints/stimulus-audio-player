import {Controller} from '@hotwired/stimulus';
import anime from 'animejs'
import './main.css'


import {mdiAccount} from '@mdi/js';

export default class extends Controller {


    static targets = [
        'player',
        'play',
        'seek',
        'time',
        'visualiser',
        'rect',
        'circle'
    ]

    static values = {
        file: String,
        id: String,
        theme: {
            type: String,
            default: 'default'
        }
    }


    updateVisualizer() {
        this.graphic();
        requestAnimationFrame(() => this.updateVisualizer());
    }

    initialize() {
        this.generatePlayerElements()
    }

    connect() {
        this.audio = new Audio(this.fileValue);
        let audioCtx = window.AudioContext || window.webkitAudioContext;
        this.audioContext = new audioCtx;
        this.gain = this.audioContext.createGain();
        this.analyser = this.audioContext.createAnalyser();
        this.track = this.audioContext.createMediaElementSource(this.audio);
        this.track
            .connect(this.gain)
            .connect(this.analyser)
            .connect(this.audioContext.destination);

        this.seek = this.seekTarget;
        this.time = this.timeTarget;

        console.log('AUDIO PLAYER CONNECTED!')
        this.playTarget.setAttribute('data-isplaying', false)

        this.fill = 'rgba(255,255,255,1)'
        const themes = ['light', 'default', 'dark'];
        if (themes.includes(this.themeValue)) {
            if (this.themeValue === 'light') {
                this.fill = 'rgba(255,255,255,1)'
            } else if (this.themeValue === 'dark') {
                this.fill = 'rgba(0,0,0,0.07)'
            } else {
                this.fill = '#2962ff'
            }
        }

        this.audio.addEventListener("loadeddata", () => {
            this.time.textContent = this.fmtTime(this.audio.duration);
        });

        this.audio.addEventListener("timeupdate", () => {
            this.seek.value = this.audio.currentTime / this.audio.duration * 100;
            this.time.textContent = this.fmtTime(this.audio.currentTime);
        });
    }

    toggle(event) {
        if (this.audio.paused) {
            this.playTarget.setAttribute('data-isplaying', true)
            this.audioContext.resume()
            this.playTarget.classList.remove('mdi-play')
            this.playTarget.classList.add('mdi-pause')
            this.audio.play()
            this.updateVisualizer();
        } else {
            this.playTarget.setAttribute('data-isplaying', false)
            this.playTarget.classList.remove('mdi-pause')
            this.playTarget.classList.add('mdi-play')
            this.audio.pause()
        }
    }

    seeking(event) {
        const pct = this.seek.value / 100;
        this.audio.currentTime = (this.audio.duration || 0) * pct;
    }

    graphic() {
        let freqArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(freqArray);
        this.shape(freqArray);
    }

    shape(freqArray) {
        const rect = this.rectTarget;
        const width = rect.parentElement.clientWidth;
        const maxHeight = 60;

        const startFreq = 0;
        const endFreq = Math.min(freqArray.length, 110);

        let points = [];

        for (let i = startFreq; i < endFreq; i++) {
            let t = (i / (endFreq - startFreq)) * width;
            let waveHeight = (freqArray[i] / 255) * maxHeight;
            t = Math.min(t, width);
            points.push({x: t, y: maxHeight - waveHeight}); // Flip the Y-coordinate
        }

        // Use Catmull-Rom interpolation to create a smoother path
        const smoothedPoints = [];

        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[i - 1] || points[i];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = points[i + 2] || p2;

            for (let t = 0; t <= 1; t += 0.5) {
                const x = 0.5 * (
                    (2 * p1.x) +
                    (-p0.x + p2.x) * t +
                    (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t * t +
                    (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t * t * t
                );
                const y = 0.5 * (
                    (2 * p1.y) +
                    (-p0.y + p2.y) * t +
                    (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t * t +
                    (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t * t * t
                );
                smoothedPoints.push({x, y});
            }
        }

        // Create the path string and manually close the path by connecting the last point to the starting point
        const smoothPathString = `M ${smoothedPoints[0].x},${smoothedPoints[0].y} L ${smoothedPoints.map(point => `${point.x},${point.y}`).join(' ')} L ${width},${maxHeight} L 0,${maxHeight} Z`;

        // Use anime.js to animate the path with the smoothed curve
        anime({
            width: '100%',
            targets: rect,
            d: [
                {value: smoothPathString}
            ],
            easing: 'easeOutQuad',
            duration: 100,
            loop: false
        });

        // Set your desired fill color
        anime({
            width: '100%',
            targets: rect,
            fill: this.fill,
            easing: 'easeOutQuad',
            duration: 100 // Set your desired animation duration
        });
    }


    generatePlayerElements() {
        // Create the player container
        const playerContainer = document.createElement('div');
        playerContainer.classList.add('_sap_player_wrapper')
        playerContainer.classList.add('_saw_player');

        // Create the play button
        const playButton = document.createElement('div');
        playButton.setAttribute('data-action', 'click->audio-player#toggle');
        playButton.setAttribute('data-audio-player-target', 'play');
        playButton.classList.add('_saw_play_btn');
        playButton.classList.add('mdi')
        playButton.classList.add('mdi-play')
        playButton.style.color = '#333'
        playerContainer.appendChild(playButton);

        // Create the seek input
        const seekInput = document.createElement('input');
        seekInput.setAttribute('data-action', 'change->audio-player#seeking');
        seekInput.setAttribute('data-audio-player-target', 'seek');
        seekInput.type = 'range';
        seekInput.step = '0.01';
        seekInput.classList.add('_saw_seek');
        seekInput.value = '0';
        seekInput.max = ''; // You can set the 'max' attribute as needed
        playerContainer.appendChild(seekInput);

        // Create the time display
        const timeDisplay = document.createElement('div');
        timeDisplay.classList.add('_saw_audio_player_time');
        timeDisplay.setAttribute('data-audio-player-target', 'time');
        timeDisplay.style.color = '#333'
        playerContainer.appendChild(timeDisplay);


        const visualizerWrapper = document.createElement('div');
        visualizerWrapper.classList.add('_saw_visualiser_wrapper');

        // Create the SVG for the visualizer
        const visualizerSVG = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        visualizerSVG.classList.add('_saw_visualiser');
        visualizerSVG.setAttribute('width', '100%');
        visualizerSVG.setAttribute('data-audio-player-target', 'visualiser');

        // Create the path for the visualizer
        const visualizerPath = document.createElementNS("http://www.w3.org/2000/svg", 'path');
        visualizerPath.setAttribute('d', '');
        visualizerPath.style.width = '100%!important';
        visualizerPath.style.fill = this.fill;
        visualizerPath.setAttribute('data-audio-player-target', 'rect');

        // Append the path to the SVG
        visualizerSVG.appendChild(visualizerPath);
        visualizerWrapper.appendChild(visualizerSVG);

        this.element.appendChild(playerContainer)
        this.element.appendChild(visualizerWrapper)
    }

    padTime = (n) => (~~(n) + "").padStart(2, "0");
    fmtTime = (s) => s < 1 ? "00:00" : `${this.padTime(s / 60)}:${this.padTime(s % 60)}`;
}
