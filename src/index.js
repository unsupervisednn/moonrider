console.time = () => {
};
console.timeEnd = () => {
};

import '../vendor/BufferGeometryUtils';

import 'aframe-aabb-collider-component';
import 'aframe-atlas-uvs-component';
import 'aframe-audioanalyser-component';
import 'aframe-event-set-component';
import 'aframe-geometry-merger-component';
import 'aframe-haptics-component';
if (process.env.DEBUG_LOG) {
  import('aframe-log-component');
} else {
  AFRAME.log = () => void 0;
}
import 'aframe-orbit-controls';
import 'aframe-proxy-event-component';
import 'aframe-slice9-component';
import 'aframe-thumb-controls-component';

import.meta.glob('./components/**/*.js', { eager: true });
await import('aframe-state-component/dist/aframe-state-component.js');
if (typeof AFRAME.registerState !== 'function') {
  throw new Error('Failed to initialize aframe-state-component (AFRAME.registerState missing).');
}
await import('./state/index.js');

import './index.css';
import sceneHtml from './generated/scene.html?raw';

document.getElementById('app').innerHTML = sceneHtml;

if (import.meta.hot) { import.meta.hot.accept(); }

document.addEventListener('DOMContentLoaded', () => {
  initSubscribeForm();
});

/**
 * Init XHR handler to subscribe.
 */
function initSubscribeForm () {
  const form = document.querySelector('form');
  if (!form) { return; }

  if (localStorage.getItem('subscribeClosed')) {
    const formParent = form.parentNode;
    formParent.parentNode.removeChild(formParent);
    return;
  }

  document.getElementById('subscribeClose').addEventListener('click', () => {
    const formParent = form.parentNode;
    formParent.parentNode.removeChild(formParent);
    localStorage.setItem('subscribeClosed', true);
  });

  const button = form.querySelector('.submit');
  const input = form.querySelector('input[type="email"]');
  const newsletterHeader = document.querySelector('#subscribeForm > h2');

  let originalHeaderText = '';
  if (newsletterHeader) {
    originalHeaderText = newsletterHeader.innerHTML;
  }

  form.addEventListener('submit', evt => {
    evt.preventDefault();

    // supermedium/superchimp
    const xhr = new XMLHttpRequest();
    let endpoint = 'http://localhost:5000/mail/subscribe';
    if (import.meta.env.PROD) {
      endpoint = 'https://supermedium.com/mail/subscribe';
    }
    xhr.open('POST', endpoint);

    xhr.addEventListener('load', () => {
      if (parseInt(xhr.status, 10) !== 200) {
        window.location.href = 'https://supermedium/subscribe/';
      }
      if (button) {
        button.disabled = true;
        button.innerHTML = 'Subscribed!';
      }
      if (newsletterHeader) {
        newsletterHeader.innerHTML = 'Successfully subscribed, thank you!';
      }
    });

    xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
    xhr.send(JSON.stringify({
      email: document.querySelector('[name="email"]').value,
      source: 'moonrider'
    }));

    return false;
  });

  if (button) {
    input.addEventListener('keydown', () => {
      if (button.hasAttribute('disabled')) {
        button.innerHTML = 'Subscribe';
        button.removeAttribute('disabled');
      }
      if (newsletterHeader && originalHeaderText) {
        newsletterHeader.innerHTML = originalHeaderText;
      }
    });
  }
}

// Redirect to HTTPS in production.
if (window.location.protocol === 'http:' && !window.location.host.startsWith('localhost')) {
  window.location.replace(`https:${location.href.substring(location.protocol.length)}`);
}
