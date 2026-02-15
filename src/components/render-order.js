AFRAME.registerSystem('render-order', {
  init: function () {
    this.order = {};
  },

  setOrderMap: function (raw) {
    const map = {};
    const keys = (raw || '').split(',').map(s => s.trim()).filter(Boolean);

    for (let i = 0; i < keys.length; i++) {
      map[keys[i]] = i + 1;
    }

    this.order = map;
    this.el.emit('render-order-map-updated');
  }
});

AFRAME.registerComponent('render-order', {
  multiple: true,
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
    if (this.isSceneOrderConfig()) {
      const renderer = this.el.renderer;
      if (renderer) { renderer.sortObjects = true; }
      this.system.setOrderMap(this.data);
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

  isSceneOrderConfig: function () {
    return this.el.sceneEl === this.el && this.id === '';
  },

  getRenderOrderValue: function () {
    const key = (this.data || '').trim();
    if (!key) { return undefined; }

    const numericOrder = Number(key);
    if (Number.isFinite(numericOrder)) { return numericOrder; }
    return this.system.order[key];
  },

  apply: function () {
    if (!this.el.object3D || this.isSceneOrderConfig()) { return; }

    const renderOrder = this.getRenderOrderValue();
    if (renderOrder === undefined) { return; }

    this.el.object3D.traverse(obj => {
      if (obj && obj.isObject3D) {
        obj.renderOrder = renderOrder;
      }
    });
  }
});
