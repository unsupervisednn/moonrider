AFRAME.registerComponent('layout', {
  schema: {
    type: { default: 'line' }, // line | box
    columns: { type: 'int', default: 1 },
    margin: { type: 'number', default: 1 },
    marginColumn: { type: 'number', default: 0 },
    marginRow: { type: 'number', default: 0 },
    align: { default: '' }, // '', center
    orderAttribute: { default: '' }
  },

  init: function () {
    this.layout = this.layout.bind(this);
    this.el.addEventListener('child-attached', this.layout);
    this.el.addEventListener('child-detached', this.layout);
    this.el.addEventListener('layoutrefresh', this.layout);
  },

  remove: function () {
    this.el.removeEventListener('child-attached', this.layout);
    this.el.removeEventListener('child-detached', this.layout);
    this.el.removeEventListener('layoutrefresh', this.layout);
  },

  update: function () {
    this.layout();
  },

  layout: function () {
    const children = Array.prototype.slice.call(this.el.children)
      .filter(child => child.tagName && child.tagName.toLowerCase().startsWith('a-'))
      // bind-for pools entities; skip inactive ones so layout indices stay compact.
      .filter(child => child.getAttribute('data-bind-for-active') !== 'false');

    if (!children.length) { return; }

    const data = this.data;
    const columns = Math.max(1, data.columns || 1);
    const colStep = data.marginColumn || data.margin || 1;
    const rowStep = data.marginRow || data.margin || 1;

    if (data.orderAttribute) {
      const orderKey = data.orderAttribute;
      children.sort((a, b) => {
        const aVal = a.getAttribute(orderKey);
        const bVal = b.getAttribute(orderKey);
        return String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
      });
    }

    if (data.type === 'line') {
      for (let i = 0; i < children.length; i++) {
        const x = i * colStep;
        this.setChildPosition(children[i], x, 0);
      }
      if (data.align === 'center') {
        const offsetX = (children.length - 1) * colStep / 2;
        for (const child of children) {
          this.offsetChildPosition(child, -offsetX, 0);
        }
      }
      return;
    }

    // box layout
    const rows = Math.ceil(children.length / columns);
    for (let i = 0; i < children.length; i++) {
      const col = i % columns;
      const row = Math.floor(i / columns);
      const x = col * colStep;
      const y = row * rowStep;
      this.setChildPosition(children[i], x, y);
    }

    if (data.align === 'center') {
      const usedCols = Math.min(columns, children.length);
      const offsetX = (usedCols - 1) * colStep / 2;
      const offsetY = (rows - 1) * rowStep / 2;
      for (const child of children) {
        this.offsetChildPosition(child, -offsetX, offsetY);
      }
    }
  },

  setChildPosition: function (el, x, y) {
    if (el.object3D && el.object3D.position) {
      el.object3D.position.set(x, y, el.object3D.position.z);
      return;
    }

    const currentPosition = el.getAttribute('position') || {x: 0, y: 0, z: 0};
    el.setAttribute('position', `${x} ${y} ${currentPosition.z || 0}`);
  },

  offsetChildPosition: function (el, x, y) {
    if (el.object3D && el.object3D.position) {
      el.object3D.position.x += x;
      el.object3D.position.y += y;
      return;
    }

    const currentPosition = el.getAttribute('position') || {x: 0, y: 0, z: 0};
    el.setAttribute('position',
      `${(currentPosition.x || 0) + x} ${(currentPosition.y || 0) + y} ${currentPosition.z || 0}`);
  }
});
