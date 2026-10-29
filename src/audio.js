import collisionSoundUrl from './ksrtc-collision.mp3';

// Playlist player: one Audio element, in-order playback, loops after the last song, skip/previous,
// mute, pause/resume, and graceful handling of missing files. Browsers only allow audio after a
// user gesture, so start() must be called from a tap/click handler (Start Your Engine).
export const PLAYLIST = [
  { title: 'Song 1', src: './music/song1.mp3' },
  { title: 'Song 2', src: './music/song2.mp3' },
  { title: 'Song 3', src: './music/song3.mp3' },
  { title: 'Song 4', src: './music/song4.mp3' },
  { title: 'Song 5', src: './music/song5.mp3' }
];

export class MusicPlayer {
  constructor(list = PLAYLIST, AudioCtor = (typeof Audio !== 'undefined' ? Audio : null)) {
    this.list = list;
    this.AudioCtor = AudioCtor;
    this.audio = null;
    this.index = 0;
    this.muted = false;
    this.active = false;      // playlist has been started and not stopped
    this.userPaused = false;  // paused by the game (pause menu / tab hidden)
    this.failures = 0;        // consecutive load failures
    this.onChange = () => {}; // (state) => void, for HUD updates
    this.onMessage = () => {};
  }

  get track() { return this.list[this.index]; }

  state() {
    return { title: this.track ? this.track.title : '', index: this.index, total: this.list.length, muted: this.muted, playing: this.active && !this.userPaused };
  }

  _ensure() {
    if (this.audio || !this.AudioCtor) return !!this.audio;
    const a = new this.AudioCtor();
    a.preload = 'auto';
    a.loop = false;
    a.volume = 0.55;
    a.addEventListener('ended', () => { this.failures = 0; this.next(); });
    a.addEventListener('playing', () => { this.failures = 0; });
    a.addEventListener('error', () => this._failed());
    this.audio = a;
    this._mediaSession();
    return true;
  }

  _mediaSession() {
    try {
      if (!('mediaSession' in navigator)) return;
      navigator.mediaSession.setActionHandler('nexttrack', () => this.next());
      navigator.mediaSession.setActionHandler('previoustrack', () => this.prev());
      navigator.mediaSession.setActionHandler('play', () => this.resume());
      navigator.mediaSession.setActionHandler('pause', () => this.pause());
    } catch (e) { /* optional API */ }
  }

  _failed() {
    if (!this.active) return;
    this.failures++;
    if (this.failures >= this.list.length) {
      this.onMessage('Music files not found. Add song1.mp3 – song5.mp3 to the music/ folder.');
      this.stop();
      return;
    }
    this.onMessage(this.track.title + ' could not be loaded. Skipping…');
    this._load((this.index + 1) % this.list.length);
  }

  _load(i) {
    if (!this.list.length || !this._ensure()) return;
    this.index = ((i % this.list.length) + this.list.length) % this.list.length;
    const token = (this._token = (this._token || 0) + 1);
    const a = this.audio;
    a.src = this.track.src; // changing src replaces the previous song: never two songs at once
    a.muted = this.muted;
    this._meta();
    this.onChange(this.state());
    if (this.userPaused) return;
    const p = a.play();
    if (p && typeof p.catch === 'function') {
      p.catch((err) => {
        if (token !== this._token) return; // stale: a newer track was requested
        if (err && err.name === 'NotAllowedError') this.onMessage('Tap the music button to start the playlist.');
        else if (err && err.name !== 'AbortError') this._failed();
      });
    }
  }

  _meta() {
    try {
      if ('mediaSession' in navigator && typeof MediaMetadata !== 'undefined') {
        navigator.mediaSession.metadata = new MediaMetadata({ title: this.track.title, artist: 'Auto Driver — Kerala' });
      }
    } catch (e) { /* optional API */ }
  }

  // Call from a user gesture. Safe to call repeatedly (never creates a second player).
  start() {
    if (!this.list.length) return;
    this.userPaused = false;
    if (this.active && this.audio && !this.audio.paused) { this.onChange(this.state()); return; }
    if (this.active && this.audio && this.audio.src) { this.resume(); return; }
    this.active = true;
    this.failures = 0;
    this._load(this.index);
  }

  next() { if (!this.active) { this.start(); return; } this.failures = 0; this._load(this.index + 1); }
  prev() {
    if (!this.active) { this.start(); return; }
    // Like most players: restart the current song if it has played a few seconds, else go back.
    if (this.audio && this.audio.currentTime > 3) { this.audio.currentTime = 0; return; }
    this.failures = 0; this._load(this.index - 1);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.audio) this.audio.muted = this.muted;
    if (!this.active) this.start();
    this.onChange(this.state());
    return this.muted;
  }

  pause() {
    this.userPaused = true;
    this._token = (this._token || 0) + 1;
    if (this.audio && !this.audio.paused) this.audio.pause();
    this.onChange(this.state());
  }

  resume() {
    if (!this.active) return;
    this.userPaused = false;
    if (!this.audio) return;
    if (!this.audio.src) { this._load(this.index); return; }
    const p = this.audio.play();
    if (p && p.catch) p.catch(() => {});
    this.onChange(this.state());
  }

  // Returning to the main menu: stop completely and rewind to song 1.
  stop() {
    this.active = false;
    this.userPaused = false;
    this._token = (this._token || 0) + 1;
    if (this.audio) { this.audio.pause(); try { this.audio.currentTime = 0; } catch (e) { /* not seekable yet */ } }
    this.index = 0;
    this.onChange(this.state());
  }
}


// Plays the user's real custom recording when the auto hits a KSRTC bus.
export class CollisionSound {
  constructor(src = collisionSoundUrl) {
    this.src = src;
    this.audio = null;
    this.lastPlayedAt = -Infinity;
  }

  unlock() {
    if (typeof Audio === 'undefined') return;
    if (!this.audio) {
      this.audio = new Audio(this.src);
      this.audio.preload = 'auto';
      this.audio.volume = 0.9;
    }
    // Called from the Start Your Engine user gesture to allow later playback.
    // No sound is intentionally played here.
    const a = this.audio;
    a.muted = true;
    const attempt = a.play();
    if (attempt && typeof attempt.then === 'function') {
      attempt.then(() => {
        a.pause();
        a.currentTime = 0;
        a.muted = false;
      }).catch(() => { a.muted = false; });
    } else {
      a.pause();
      a.currentTime = 0;
      a.muted = false;
    }
  }

  playBusImpact() {
    if (typeof Audio === 'undefined') return;
    if (!this.audio) {
      this.audio = new Audio(this.src);
      this.audio.preload = 'auto';
      this.audio.volume = 0.9;
    }
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
    // Prevent retriggering continuously while the vehicles remain in contact.
    if (now - this.lastPlayedAt < 0.65) return;
    this.lastPlayedAt = now;
    try {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio.volume = 0.9;
      const attempt = this.audio.play();
      if (attempt && typeof attempt.catch === 'function') attempt.catch(() => {});
    } catch (e) { /* audio playback is optional if the browser blocks it */ }
  }
}
