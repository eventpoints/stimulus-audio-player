import {Controller} from '@hotwired/stimulus';
import anime from 'animejs'
import './main.css'

export default class extends Controller {


    audio = new Audio();
    audioContext = null;
    audioContextStarted = false;
    mediaStream = null
    mediaRecorder = null
    audioChunks = [];

    static targets = [
        'player',
        'play',
        'record',
        'seek',
        'time',
        'rect',
        'circle'
    ]

    static values = {
        file: String,
        id: String,
        isRecorder: {
            type: Boolean,
            default: false
        },
        theme: {
            type: String,
            default: 'default'
        }

    }

    initialize() {
        this.generatePlayerElements()
        this.resolveTheme();
    }

    async connect() {
        if (this.isRecorderValue) {
            this.mediaStream = await navigator.mediaDevices.getUserMedia({audio: true});
            this.mediaRecorder = new MediaRecorder(this.mediaStream);
        }

        if (this.fileValue) {
            this.audio.src = this.fileValue;
            await this.setupAudioContext()
            await this.loadAudio()
        }
    }

    async setupAudioContext() {
        if (this.audioContext) {
            await this.audioContext.close();
            this.audioContextStarted = false;
        }

        let audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.audioContext = audioCtx;
        this.gain = this.audioContext.createGain();
        this.analyser = this.audioContext.createAnalyser();

        if (!this.sourceNode) {
            this.sourceNode = this.audioContext.createMediaElementSource(this.audio);
            this.sourceNode
                .connect(this.gain)
                .connect(this.analyser)
                .connect(this.audioContext.destination);
        }
    }

    async record() {

        if (!this.recording) {
            this.audio = new Audio();
            this.recordTarget.style.color = '#c62828';
            await this.startRecording();
        } else {
            this.recordTarget.style.color = '#333';
            await this.stopRecording();
        }
    }

    async startRecording() {
        // Check if the MediaRecorder API is available
        if (typeof MediaRecorder === 'undefined') {
            console.error('MediaRecorder API is not supported in this browser.');
            return;
        }

        await this.audioContext.resume();

        try {
            return new Promise((resolve, reject) => {
                // When data is available, add it to the chunks array
                this.mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        this.audioChunks.push(event.data);
                    }
                };

                // When the recording stops, resolve the Promise
                this.mediaRecorder.onstop = () => {
                    if (this.audioChunks.length > 0) {
                        this.recordedAudio = new Blob(this.audioChunks, {type: 'audio/wav'});
                        console.log('Recording stopped, recordedAudio is set:', this.recordedAudio);
                        resolve(this.recordedAudio);
                    } else {
                        console.error('No audio data recorded.');
                        reject('No audio data recorded.');
                    }
                };

                // Start recording
                this.mediaRecorder.start();
                this.recording = true;
                console.log('Recording started.');
            });
        } catch (error) {
            console.error('Error starting recording:', error);
        }
    }

    async stopRecording() {
        if (this.mediaRecorder && this.recording) {
            try {
                // Create a promise that resolves when the recording stops and the recorded audio is available.
                const recordingPromise = new Promise((resolve, reject) => {
                    this.mediaRecorder.onstop = async () => {
                        if (this.audioChunks.length > 0) {
                            this.recordedAudio = new Blob(this.audioChunks, {type: 'audio/wav'});
                            console.log('Recording stopped, recordedAudio is set:', this.recordedAudio);
                            resolve(this.recordedAudio);
                        } else {
                            console.error('No audio data recorded.');
                            reject('No audio data recorded.');
                        }
                    };
                });

                // Stop the recording
                this.mediaRecorder.stop();
                this.mediaStream.getTracks().forEach((track) => track.stop());
                this.recording = false;
                console.log('Recording stopped.');

                // Wait for the recordingPromise to resolve before continuing
                await recordingPromise;

                if (this.recordedAudio instanceof Blob) {
                    this.audio.src = URL.createObjectURL(this.recordedAudio);

                    // Set up a new audio context for the new audio element
                    await this.setupAudioContext();
                    await this.loadAudio();
                } else {
                    console.error('Recorded audio is not a valid Blob:', this.recordedAudio);
                }
            } catch (error) {
                console.error('Error while stopping recording:', error);
            }
        }
    }

    async loadAudio() {
        return new Promise((resolve) => {
            this.audio = new Audio(this.audio.src); // Create a new Audio element

            this.audio.onloadeddata = async () => {
                this.timeTarget.textContent = this.fmtTime(this.audio.duration);
                await this.setupAudioContext();

                // Disconnect the previous source node if it exists and is connected
                if (this.track) {
                    this.track.disconnect();
                }

                // Create a new source node from the new audio element
                this.track = this.audioContext.createMediaElementSource(this.audio);

                // Connect the new source node
                this.track.connect(this.gain);
                this.track.connect(this.analyser);
                this.track.connect(this.audioContext.destination);

                this.updateVisualizer();
                resolve();
            };
        });
    }
    updateVisualizer() {
        this.graphic();
        requestAnimationFrame(() => this.updateVisualizer());
    }

    resolveTheme() {

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
    }

    async toggle(event) {
        if (this.audio.paused) {
            this.playTarget.setAttribute('data-isplaying', true);
            // You can start the AudioContext when the audio is played
            if (!this.audioContextStarted) {
                await this.audioContext.resume();
                this.audioContextStarted = true;
            }
            this.playTarget.classList.remove('mdi-play');
            this.playTarget.classList.add('mdi-pause');
            this.audio.play();
        } else {
            this.playTarget.setAttribute('data-isplaying', false);
            this.playTarget.classList.remove('mdi-pause');
            this.playTarget.classList.add('mdi-play');
            this.audio.pause();
        }
    }

    seek(event) {
        const pct = parseInt(this.seekTarget.value, 10) / 100;

        if (!isNaN(pct) && isFinite(pct)) {
            if (!isNaN(this.audio.duration) && isFinite(this.audio.duration)) {
                const newTime = this.audio.duration * pct;
                if (!isNaN(newTime) && isFinite(newTime)) {
                    this.audio.currentTime = newTime;
                } else {
                    console.error('Invalid newTime:', newTime);
                }
            } else {
                console.error('Invalid audio duration:', this.audio.duration);
            }
        } else {
            console.error('Invalid seek percentage:', pct);
        }
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
        playButton.setAttribute('data-isplaying', false)
        playButton.classList.add('_saw_play_btn');
        playButton.classList.add('mdi')
        playButton.classList.add('mdi-play')
        playButton.style.color = '#333'
        playerContainer.appendChild(playButton);


        if (this.isRecorderValue) {
            // Create the record button
            const recordButton = document.createElement('div');
            recordButton.setAttribute('data-action', 'click->audio-player#record');
            recordButton.setAttribute('data-audio-player-target', 'record');
            recordButton.classList.add('_saw_record_btn');
            recordButton.classList.add('mdi')
            recordButton.classList.add('mdi-record')
            recordButton.style.color = '#333'
            playerContainer.appendChild(recordButton);
        }

        // Create the seek input
        const seekInput = document.createElement('input');
        seekInput.setAttribute('data-action', 'change->audio-player#seek');
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
