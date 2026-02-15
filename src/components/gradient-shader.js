import flatVertShader from './shaders/flat.vert.glsl';
import gradientFragShader from './shaders/gradient.frag.glsl';

AFRAME.registerShader('gradientShader', {
  schema: {
    color1: {type: 'color', is: 'uniform'},
    color2: {type: 'color', is: 'uniform'}
  },

  vertexShader: flatVertShader,

  fragmentShader: gradientFragShader
});
