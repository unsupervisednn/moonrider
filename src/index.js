console.time = () => {
};
console.timeEnd = () => {
};

import './index.css';
import sceneHtml from './generated/scene.html?raw';
import { getCurrentSession, signInWithFacebook } from './lib/auth-client';
import { fetchFavorites } from './lib/api-client';

let hasBootedScene = false;

redirectToHttps();
await initialize();

async function initialize () {
  const app = document.getElementById('app');

  let session = null;
  try {
    session = await getCurrentSession();
  } catch (error) {
    console.error('[auth] failed to load session', error);
    renderLogin(app, 'Unable to reach auth service. Check Worker deployment and try again.');
    return;
  }

  if (!session?.user || !session?.session) {
    renderLogin(app);
    return;
  }

  let favorites = [];
  try {
    favorites = await fetchFavorites();
  } catch (error) {
    console.error('[favorites] failed to preload', error);
  }

  globalThis.__MOONRIDER_AUTH_SESSION = session;
  globalThis.__MOONRIDER_INITIAL_FAVORITES = favorites;

  await bootstrapScene(app);
  initSubscribeForm();
}

async function bootstrapScene (appEl) {
  if (hasBootedScene) { return; }
  hasBootedScene = true;

  const { default: AFRAME } = await import('aframe');
  globalThis.AFRAME = AFRAME;

  if (!globalThis.THREE && AFRAME.THREE) {
    globalThis.THREE = AFRAME.THREE;
  }

  if (globalThis.THREE) {
    // Three r125+ removed *BufferGeometry aliases; older components still use them.
    globalThis.THREE.PlaneBufferGeometry = globalThis.THREE.PlaneBufferGeometry || globalThis.THREE.PlaneGeometry;
    globalThis.THREE.BoxBufferGeometry = globalThis.THREE.BoxBufferGeometry || globalThis.THREE.BoxGeometry;
    globalThis.THREE.SphereBufferGeometry = globalThis.THREE.SphereBufferGeometry || globalThis.THREE.SphereGeometry;
    globalThis.THREE.Math = globalThis.THREE.Math || globalThis.THREE.MathUtils;
  }

  await import('../vendor/BufferGeometryUtils');

  await Promise.all([
    import('aframe-aabb-collider-component'),
    import('aframe-atlas-uvs-component'),
    import('aframe-audioanalyser-component'),
    import('aframe-event-set-component'),
    import('aframe-geometry-merger-component'),
    import('aframe-haptics-component'),
    import('aframe-orbit-controls'),
    import('aframe-proxy-event-component'),
    import('aframe-slice9-component'),
    import('aframe-thumb-controls-component')
  ]);

  if (process.env.DEBUG_LOG) {
    await import('aframe-log-component');
  } else {
    AFRAME.log = () => void 0;
  }

  const componentModules = import.meta.glob('./components/**/*.js');
  await Promise.all(Object.values(componentModules).map(loadModule => loadModule()));

  await import('aframe-state-component/dist/aframe-state-component.js');
  if (typeof AFRAME.registerState !== 'function') {
    throw new Error('Failed to initialize aframe-state-component (AFRAME.registerState missing).');
  }
  await import('./state/index.js');

  appEl.innerHTML = sceneHtml;

  if (import.meta.hot) {
    import.meta.hot.accept();
  }
}

function renderLogin (appEl, errorText = '') {
  appEl.innerHTML = `
    <div class="loginGate">
      <div class="loginCard">
        <h1 class="loginTitle">Moon Rider</h1>
        <p class="loginText">Sign in with Facebook to sync your favorites and high scores across devices.</p>
        ${errorText ? `<p class="loginError">${errorText}</p>` : ''}
        <button id="facebookLoginButton" class="loginButton">Continue with Facebook</button>
      </div>
    </div>
  `;

  const loginButton = document.getElementById('facebookLoginButton');
  loginButton.addEventListener('click', async () => {
    loginButton.disabled = true;
    loginButton.textContent = 'Redirecting...';

    try {
      await signInWithFacebook();
    } catch (error) {
      console.error('[auth] sign-in failed', error);
      loginButton.disabled = false;
      loginButton.textContent = 'Continue with Facebook';

      const errorMessageEl = document.createElement('p');
      errorMessageEl.className = 'loginError';
      errorMessageEl.textContent = 'Could not start Facebook login. Verify auth settings and try again.';

      const cardEl = appEl.querySelector('.loginCard');
      const previous = cardEl.querySelector('.loginError');
      if (previous) {
        previous.parentNode.removeChild(previous);
      }
      cardEl.insertBefore(errorMessageEl, loginButton);
    }
  });
}

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

function redirectToHttps () {
  if (window.location.protocol === 'http:' && !window.location.host.startsWith('localhost')) {
    window.location.replace(`https:${location.href.substring(location.protocol.length)}`);
  }
}
