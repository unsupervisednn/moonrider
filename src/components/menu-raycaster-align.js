/**
 * Keep menu interaction ray aligned with visual wand adjustments.
 */
AFRAME.registerComponent('menu-raycaster-align', {
  init: function () {
    this.lastDirection = '';
  },

  tick: function () {
    const raycaster = this.el.components.raycaster;
    if (!raycaster) { return; }

    const state = this.el.sceneEl.systems.state && this.el.sceneEl.systems.state.state;
    const isPlaying = state && state.isPlaying;

    const controllerComponent = this.el.components.controller;
    const fallbackType = state && state.controllerType ? state.controllerType : '';
    const controllerType = (controllerComponent && controllerComponent.controllerType) || fallbackType;
    const isMetaLike = controllerType.indexOf('oculus') !== -1 ||
      controllerType.indexOf('meta-touch') !== -1;

    // Only adjust menu ray. Leave gameplay raycaster settings untouched.
    if (isPlaying) { return; }

    const direction = isMetaLike ? '0 -0.682 -0.731' : '0 0 -1';
    if (direction === this.lastDirection) { return; }

    this.lastDirection = direction;
    this.el.setAttribute('raycaster', 'direction', direction);
  }
});
