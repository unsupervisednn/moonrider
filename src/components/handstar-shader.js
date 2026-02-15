import COLORS from '../constants/colors';
import handstarVertShader from './shaders/handstar.vert.glsl';
import handstarFragShader from './shaders/handstar.frag.glsl';

AFRAME.registerShader('handStar', {
  schema: {
    colorPrimary: {type: 'color', is: 'uniform', default: COLORS.initial.primary},
    colorSecondary: {type: 'color', is: 'uniform', default: COLORS.initial.secondary},
    colorTertiary: {type: 'color', is: 'uniform', default: COLORS.initial.tertiary},
    pulse: {type: 'number', is: 'uniform', default: 0},
    transparent: {default: true},
    side: {default: 'back'},
    depthTest: {default: false}
  },

  vertexShader: handstarVertShader,
  fragmentShader: handstarFragShader
});
