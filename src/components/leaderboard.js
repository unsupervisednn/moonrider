/* global localStorage */
import pr from 'profane-words';
import { fetchHighScores, submitHighScore } from '../lib/api-client';

const NUM_SCORES_DISPLAYED = 10;
const ba = /(fuc)|(ass)|(nig)|(shit)|(retard)/gi;

AFRAME.registerComponent('leaderboard', {
  schema: {
    challengeId: { default: '' },
    difficulty: { default: '' },
    beatmapCharacteristic: { default: '' },
    inVR: { default: false },
    gameMode: { type: 'string' },
    menuSelectedChallengeId: { default: '' },
    isVictory: { default: false }
  },

  init: function () {
    this.qualifyingIndex = undefined;
    this.scores = [];
    this.eventDetail = { scores: this.scores };
    this.addEventDetail = { scoreData: undefined, index: undefined };

    this.username = localStorage.getItem('moonriderusername') || 'Super Zealot';
    this.el.addEventListener('leaderboardusername', evt => {
      this.username = evt.detail.value;
      localStorage.setItem('moonriderusername', this.username);
    });
    this.el.addEventListener('leaderboardsubmit', this.addScore.bind(this));
  },

  update: function (oldData) {
    if (!oldData.isVictory && this.data.isVictory) {
      this.checkLeaderboardQualify();
    }

    if (this.data.difficulty && oldData.difficulty !== this.data.difficulty) {
      this.fetchScores(this.data.menuSelectedChallengeId);
      return;
    }

    if (this.data.menuSelectedChallengeId &&
      oldData.menuSelectedChallengeId !== this.data.menuSelectedChallengeId) {
      this.fetchScores(this.data.menuSelectedChallengeId);
      return;
    }

    if (this.data.challengeId && oldData.challengeId !== this.data.challengeId) {
      this.fetchScores(this.data.challengeId);
    }
  },

  addScore: async function () {
    const state = this.el.sceneEl.systems.state.state;

    if (!state.isVictory || !state.inVR) { return; }

    const scoreData = {
      accuracy: state.score.accuracy,
      challengeId: state.challenge.id,
      gameMode: this.data.gameMode,
      score: state.score.score,
      username: this.username,
      difficulty: this.data.difficulty || state.challenge.difficulty,
      beatmapCharacteristic: this.data.beatmapCharacteristic || state.challenge.beatmapCharacteristic
    };

    if (pr.includes(this.username.toLowerCase()) || this.username.match(ba)) {
      return;
    }

    try {
      const savedScore = await submitHighScore(scoreData);
      this.addEventDetail.scoreData = savedScore || scoreData;
      this.el.emit('leaderboardscoreadded', this.addEventDetail, false);
    } catch (error) {
      console.error('[leaderboard] failed to submit', error);
    }
  },

  fetchScores: async function (challengeId) {
    if (this.data.gameMode === 'ride') { return; }
    if (!challengeId) { return; }

    const state = this.el.sceneEl.systems.state.state;
    const difficulty = state.menuSelectedChallenge.id
      ? state.menuSelectedChallenge.difficulty
      : state.challenge.difficulty;
    const beatmapCharacteristic = state.menuSelectedChallenge.id
      ? state.menuSelectedChallenge.beatmapCharacteristic
      : state.challenge.beatmapCharacteristic;

    try {
      const scores = await fetchHighScores({
        challengeId,
        difficulty,
        beatmapCharacteristic: beatmapCharacteristic || 'Standard',
        gameMode: this.data.gameMode
      });

      this.eventDetail.challengeId = challengeId;
      this.scores.length = 0;
      this.scores.push(...scores);
      this.el.sceneEl.emit('leaderboard', this.eventDetail, false);
    } catch (error) {
      console.error('[leaderboard] failed to fetch', error);
      this.eventDetail.challengeId = challengeId;
      this.scores.length = 0;
      this.el.sceneEl.emit('leaderboard', this.eventDetail, false);
    }
  },

  checkLeaderboardQualify: function () {
    const state = this.el.sceneEl.systems.state.state;
    const score = state.score.score;

    if (AFRAME.utils.getUrlParameter('dot')) { return; }

    // If less than 10, then automatic high score.
    if (this.scores.length < NUM_SCORES_DISPLAYED) {
      this.qualifyingIndex = this.scores.length;
      this.el.sceneEl.emit('leaderboardqualify', this.scores.length, false);
      return;
    }

    // Check if overtook any existing high score.
    for (let i = 0; i < this.scores.length; i++) {
      if (score > this.scores[i].score) {
        this.qualifyingIndex = i;
        this.el.sceneEl.emit('leaderboardqualify', i, false);
        return;
      }
    }
  }
});
