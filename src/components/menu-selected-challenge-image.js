import normalizeCoverURL from '../lib/normalize-cover-url';

AFRAME.registerComponent('menu-selected-challenge-image', {
  schema: {
    coverURL: { type: 'string' }
  },

  update: function () {
    const el = this.el;
    el.setAttribute(
      'material', 'src',
      normalizeCoverURL(this.data.coverURL));
  }
});
