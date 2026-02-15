import COLORS from '../constants/colors';
import supercurveFragShader from './shaders/supercurve.frag.glsl';
import supercurveVertShader from './shaders/supercurve.vert.glsl';

AFRAME.registerShader('supercurve', {
  schema: {
    cameraPercent: {type: 'number', is: 'uniform'},
    color1: {type: 'color', is: 'uniform', default: COLORS.initial.primary},
    color2: {type: 'color', is: 'uniform', default: COLORS.initial.secondary},
    fogColor: {type: 'color', is: 'uniform', default: COLORS.initial.primary},
    side: {default: 'double'},
    transparent: {default: true}
  },

  fragmentShader: supercurveFragShader,

  vertexShader: supercurveVertShader,

  update: function (data) {
    Object.getPrototypeOf(Object.getPrototypeOf(this)).update.call(this, data);
    this.el.sceneEl.systems.materials.registerCurve(this.material);
  }
});
