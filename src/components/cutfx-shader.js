import cutfxVert from './shaders/cutfx.vert.glsl';
import cutfxFrag from './shaders/cutfx.frag.glsl';

AFRAME.registerShader('cutfxShader', {
  schema: {
    src: {type: 'map', is: 'uniform', default: '#cutfxImg'},
    color: {type: 'color', is: 'uniform', default: '#fff'},
    progress: {type: 'number', is: 'uniform'},
    transparent: {default: true},
    blending: {default: 'additive'},
    side: {default: 'double'},
    depthTest: {default: false},
    depthWrite: {default: false}
  },
  vertexShader: cutfxVert,
  fragmentShader: cutfxFrag
});
