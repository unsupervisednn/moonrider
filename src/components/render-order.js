AFRAME.registerComponent('render-order', {
  schema: { default: '' },

  init: function () {
    this.apply = this.apply.bind(this);
    this.onObject3DSet = this.onObject3DSet.bind(this);
    this.onOrderMapUpdated = this.onOrderMapUpdated.bind(this);

    this.el.addEventListener('object3dset', this.onObject3DSet);
    if (this.el.sceneEl) {
      this.el.sceneEl.addEventListener('render-order-map-updated', this.onOrderMapUpdated);
    }
  },

  remove: function () {
    this.el.removeEventListener('object3dset', this.onObject3DSet);
    if (this.el.sceneEl) {
      this.el.sceneEl.removeEventListener('render-order-map-updated', this.onOrderMapUpdated);
    }
  },

  update: function () {
    if (this.el.sceneEl === this.el) {
      this.updateSceneOrderMap();
      return;
    }
    this.apply();
  },

  onObject3DSet: function () {
    this.apply();
  },

  onOrderMapUpdated: function () {
    this.apply();
  },

  updateSceneOrderMap: function () {
    const renderer = this.el.renderer;
    if (renderer) { renderer.sortObjects = true; }

    const raw = this.data || '';
    const map = {};
    const keys = raw.split(',').map(s => s.trim()).filter(Boolean);
    for (let i = 0; i < keys.length; i++) {
      map[keys[i]] = i + 1;
    }

    this.el.sceneEl.__renderOrderMap = map;
    this.el.sceneEl.emit('render-order-map-updated');
  },

  apply: function () {
    if (!this.el.sceneEl) { return; }
    const key = (this.data || '').trim();
    if (!key) { return; }

    const map = this.el.sceneEl.__renderOrderMap || {};
    const renderOrder = map[key];
    if (renderOrder === undefined) { return; }

    this.el.object3D.traverse(obj => {
      if (obj.isObject3D) {
        obj.renderOrder = renderOrder;
      }
    });
  }
});
