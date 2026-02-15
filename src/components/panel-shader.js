import COLORS from '../constants/colors';
import panelVertShader from './shaders/panel.vert.glsl';
import panelFragShader from './shaders/panel.frag.glsl';

AFRAME.registerShader('panelShader', {
  schema: {
    activePanel: {type: 'number', is: 'uniform', default: 0},
    brightness: {type: 'number', is: 'uniform', default: 0.3},
    borderWidth: {type: 'number', is: 'uniform', default: 0.004},
    borderRadius: {type: 'number', is: 'uniform', default: 0.15},
    colorPrimary: {type: 'color', is: 'uniform', default: COLORS.initial.primary},
    colorSecondary: {type: 'color', is: 'uniform', default: COLORS.initial.secondary},
    midSection: {type: 'number', is: 'uniform', default: 0},
    opacity: {type: 'number', is: 'uniform', default: 1},
    ratio: {type: 'number', is: 'uniform', default: 0.5},
    transparent: {default: true}
  },

  vertexShader: panelVertShader,

  fragmentShader: panelFragShader,

  update: function (data) {
    Object.getPrototypeOf(Object.getPrototypeOf(this)).update.call(this, data);
    this.el.sceneEl.systems.materials.registerPanel(this.material);
  }
});
