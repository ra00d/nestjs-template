(() => {
  var P = `.container{background-color:var(--base00);color:var(--base05);padding:10px;letter-spacing:0.5px;font-family:monospace;border-radius:3px}.toolbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;padding-bottom:5px;border-bottom:solid 1px var(--base02)}.toolbar .options,.toolbar .search-wrapper{display:flex;align-items:center}.toolbar .icon-wrapper{height:15px;display:flex;align-items:center;padding:2px 5px;background:none;border:none;cursor:pointer;color:inherit;font:inherit}.toolbar .icon-wrapper:hover{background-color:var(--base02);border-radius:3px}.toolbar .icon-wrapper:focus-visible{outline:2px solid var(--base0D);outline-offset:2px;border-radius:3px}.toolbar .icon-wrapper:first-child{margin-left:0px}.toolbar .search.icon{margin-right:5px}.toolbar .search-input{border:none;background:transparent;outline:none;flex:1;font-size:16px;color:var(--base0D)}.match{background-color:yellow;font-weight:bold;color:red}.data-row{padding:3px 0}.data-row .data-row{border-left:solid 1px var(--base02);padding-left:20px;margin-left:5px;display:none}.data-row.expanded>.data-row{display:block}.data-row .key-value-wrapper{display:flex;align-items:center}.data-row .key{color:var(--base07)}.data-row .key.number{color:var(--base0C)}.data-row .colon{color:var(--base07);margin:0 5px 0 0}.clickable{cursor:pointer}.data-row .opening-parenthesis,.data-row .closing-parenthesis{color:var(--base07)}.data-row .ellipsis{color:var(--base09)}.data-row.expanded>.key-value-wrapper .closing-parenthesis,.data-row.expanded>.key-value-wrapper .ellipsis{display:none}.data-row>.closing-parenthesis{display:none}.data-row.expanded>.closing-parenthesis{display:inline-block}.data-row .items-size{margin-left:10px;color:var(--base04);font-style:italic;display:none}.show-size .data-row .items-size{display:inline-block}.data-row .value.bool,.data-row .value.boolean{color:var(--base0E)}.data-row .value.function{color:var(--base0D)}.data-row .value.int,.data-row .value.integer{color:var(--base0F)}.data-row .value.float{color:var(--base0B)}.data-row .value.string{color:var(--base09)}.data-row .value.string .content{overflow-wrap:break-word}.data-row .value.string .content::before{content:open-quote}.data-row .value.string .content::after{content:close-quote}.data-row .value.regexp{color:var(--base0A)}.data-row .value.nan{color:var(--base08)}.data-row .value.null{color:var(--base0A)}.data-row .value.undefined{color:var(--base05)}.data-row .value.date{color:var(--base0D)}.data-row .value.nan,.data-row .value.null,.data-row .value.undefined{border-radius:3px;background-color:var(--base02);padding:1px 2px}.data-row .value .type{font-size:smaller;margin-right:4px;opacity:0.8;display:none}.data-row .value .value-data{word-break:break-all}.show-data-types .data-row .value .type{display:inline-block}.icon-wrapper,.copy-icon-wrapper{display:inline-block;cursor:pointer}.icon{display:block;position:relative}.icon:before,.icon:after{content:"";position:absolute;display:block}.expand.icon{margin-right:5px}.expand-icon-arrow .expand.icon{margin-left:3px;width:0;height:0;border-left:solid 6px var(--base0E);border-top:solid 6px transparent;border-bottom:solid 6px transparent}.expand-icon-arrow .expanded>.key-value-wrapper .expand.icon,.expand-icon-arrow .expanded.icon.expand{transform:rotate(90deg);border-left-color:var(--base0D)}.expand-icon-square .expand.icon,.expand-icon-circle .expand.icon{display:block;width:9px;height:9px;border-radius:2px;border:solid 1px var(--base0E)}.expand-icon-circle .expand.icon{border-radius:50%}.expand-icon-square .expand.icon:before,.expand-icon-circle .expand.icon:before,.expand-icon-square .expand.icon:after,.expand-icon-circle .expand.icon:after{width:5px;height:1px;background-color:var(--base0E);left:2px;top:4px}.expand-icon-square .expand.icon:after,.expand-icon-circle .expand.icon:after{transform:rotate(90deg)}.expand-icon-square .expanded>.key-value-wrapper .expand.icon:after,.expand-icon-circle .expanded>.key-value-wrapper .expand.icon:after,.expand-icon-square .expand.icon.expanded:after,.expand-icon-circle .expand.icon.expanded:after{display:none}.expand-icon-square .expanded>.key-value-wrapper .expand.icon,.expand-icon-circle .expanded>.key-value-wrapper .expand.icon,.expand-icon-square .expand.icon.expanded,.expand-icon-circle .expanded.expand.icon{border-color:var(--base0D)}.expand-icon-square .expanded>.key-value-wrapper .expand.icon:before,.expand-icon-circle .expanded>.key-value-wrapper .expand.icon:before,.expand-icon-square .expanded.expand.icon:before,.expand-icon-circle .expanded.expand.icon:before{background-color:var(--base0D)}.icon-wrapper{display:inline-block;cursor:pointer}.show-copy .key-value-wrapper:hover .icon.copy{display:block}.copy.icon{margin-left:10px;display:none;width:8px;height:10px;border:solid 1px var(--base0D);border-radius:1px;position:relative;top:4px;transition:0.2s all}.copy.icon:active{transform:scale(1.6);background-color:var(--base0B)}.copy.icon:before{content:"";display:block;left:-3px;top:-3px;width:8px;height:10px;border-top:solid 1px var(--base0D);border-left:solid 1px var(--base0D);border-radius:1px 0 0 0}.plus.icon{width:11px;height:1px;background-color:var(--base0D)}.plus.icon:after{content:"";width:11px;height:1px;background-color:var(--base0D);-webkit-transform:rotate(90deg);transform:rotate(90deg)}.minus.icon{width:11px;height:1px;background-color:var(--base0D)}.indent.icon{color:var(--base0D);width:17px;height:8px;border-top:solid 1px var(--base0D);border-bottom:solid 1px var(--base0D)}.indent.icon:before{content:"";position:absolute;top:2px;right:0;width:11px;height:2px;border-top:solid 1px var(--base0D);border-bottom:solid 1px var(--base0D)}.indent.icon:after{content:"";position:absolute;top:1px;width:0;height:0;border-top:solid 3px transparent;border-bottom:solid 3px transparent;border-left:solid 3px var(--base0D);border-right:solid 3px transparent}.outdent.icon{color:var(--base0D);margin-left:2px;width:17px;height:8px;border-top:solid 1px var(--base0D);border-bottom:solid 1px var(--base0D)}.outdent.icon:before{content:"";top:2px;right:0;width:11px;height:2px;border-top:solid 1px var(--base0D);border-bottom:solid 1px var(--base0D)}.outdent.icon:after{content:"";top:1px;left:-3px;width:0;height:0;border-top:solid 3px transparent;border-bottom:solid 3px transparent;border-left:solid 3px transparent;border-right:solid 3px var(--base0D)}.refresh.icon{color:var(--base0D);width:10px;height:10px;border-radius:50%;border-top:solid 1px var(--base0D);border-bottom:solid 1px var(--base0D);border-left:solid 1px transparent;border-right:solid 1px var(--base0D)}.refresh.icon:before{content:"";left:1px;top:8px;width:3px;height:3px;border-top:solid 1px var(--base0D);border-left:solid 1px var(--base0D);-webkit-transform:rotate(-22.5deg);transform:rotate(-22.5deg)}.info.icon{width:12px;height:11px;border:solid 1px var(--base0D);border-radius:2px}.info.icon::before{top:5px;left:5px;width:2px;height:5px;background-color:var(--base0D)}.info.icon::after{top:2px;left:5px;width:2px;height:2px;background-color:var(--base0D)}.info.icon.active{background-color:var(--base0D)}.info.icon.active::before,.info.icon.active::after{background-color:var(--base02)}.search.icon{color:var(--base0D);width:11px;height:11px;border:solid 1px var(--base0D);border-radius:100%;-webkit-transform:rotate(-45deg);transform:rotate(-45deg)}.search.icon:before{content:"";top:11px;left:5px;height:6px;width:1px;background-color:var(--base0D)}
`;
  github = [
    '#ffffff',
    '#f5f5f5',
    '#c8c8fa',
    '#969896',
    '#e8e8e8',
    '#333333',
    '#ffffff',
    '#969896',
    '#ed6a43',
    '#0086b3',
    '#795da3',
    '#183691',
    '#183691',
    '#795da3',
    '#a71d5d',
    '#333333',
  ];
  var J = {
      'default-dark': [
        '#181818',
        '#282828',
        '#383838',
        '#585858',
        '#b8b8b8',
        '#d8d8d8',
        '#e8e8e8',
        '#f8f8f8',
        '#ab4642',
        '#dc9656',
        '#f7ca88',
        '#a1b56c',
        '#86c1b9',
        '#7cafc2',
        '#ba8baf',
        '#a16946',
      ],
      'default-light': [
        '#ffffff',
        '#e8e8e8',
        '#d8d8d8',
        '#b8b8b8',
        '#585858',
        '#383838',
        '#282828',
        '#181818',
        '#ab4642',
        '#dc9656',
        '#ab4642',
        '#a1b56c',
        '#86c1b9',
        '#7cafc2',
        '#ba8baf',
        '#a16946',
      ],
    },
    re = Object.keys(J),
    H = (a) => {
      let e;
      if (typeof a == 'string') {
        if (J[a] === void 0) throw new Error(`${a} not found`);
        e = J[a].reduce((d, i, r) => {
          let t = `base0${r.toString(16).toUpperCase()}`;
          return ((d[t] = i), d);
        }, {});
      } else e = a;
      return `.container{${Object.keys(e)
        .map((d) => `--${d}: ${e[d]};`)
        .join('')}}`;
    };
  var R = (a) => {
      try {
        return !!new URL(a);
      } catch {
        return !1;
      }
    },
    F = (a) => {
      if (Array.isArray(a)) return 'array';
      if (a === null) return 'null';
      if (a instanceof RegExp) return 'regexp';
      let e = typeof a;
      return e === 'number'
        ? isNaN(a)
          ? 'NaN'
          : isFinite(a)
            ? Number.isInteger(a)
              ? 'int'
              : 'float'
            : 'Infinity'
        : e === 'boolean'
          ? 'bool'
          : e === 'object' && a instanceof Date
            ? 'date'
            : e;
    };
  var M = (a) =>
    a
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  var $ = (a) => {
      if (typeof a == 'boolean') return a;
      if (a === 'true') return !0;
      if (a === 'false') return !1;
      throw new Error('should be a boolean!');
    },
    W = (a) => {
      if (typeof a == 'string') return a;
      throw new Error('should be a string!');
    },
    K = (a) => {
      if (typeof a == 'number' && a >= 0) return a;
      if ((typeof a == 'string' && (a = parseFloat(a)), isNaN(a) || a < 0))
        throw new Error('should be a positive number!');
      return a;
    },
    Z = (a) => {
      if (typeof a == 'boolean' || typeof a == 'number') return a;
      if (a === 'true') return !0;
      if (a === 'false') return !1;
      if (typeof a == 'string' && ((a = parseFloat(a)), !isNaN(a) && a >= 0))
        return a;
      throw new Error('should be a boolean or a positive number!');
    },
    O = (a) => {
      if (typeof a == 'object') return a;
      if (typeof a == 'string')
        try {
          return JSON.parse(a);
        } catch {
          return a;
        }
      throw new Error('should be a string or JSON!');
    };
  var G = function ({
      key: a,
      value: e,
      expanded: d,
      indent: i,
      onToggleExpand: r,
      level: t = 0,
      parentRow: N,
      path: g = '',
      expandedPaths: y = null,
      onPathToggle: b = null,
      expandEmpty: C = !0,
    }) {
      let c = document.createElement('div');
      this.maxLevel = t;
      let m = g ? `${g}.${a}` : a !== '' ? String(a) : '',
        f = F(e),
        v = f === 'array' || f === 'object',
        E = v && (f === 'array' ? e.length === 0 : Object.keys(e).length === 0),
        w;
      (y && m ? (w = y.has(m)) : (w = d === !0 || d > t),
        E && C === !1 && (w = !1));
      let x, p, l, s;
      ((c.className = `data-row ${w ? 'expanded' : ''}`),
        (c.dataset.key = a),
        (c.dataset.level = t),
        t > 0 && (c.style.paddingLeft = `${i * 5}px`));
      let u = document.createElement('span');
      ((u.className = 'key-value-wrapper'), c.appendChild(u));
      let L = (n = !1) => {
        c.classList.toggle('expanded');
        let o = c.classList.contains('expanded');
        (b && m && b(m, o),
          n &&
            p &&
            p.forEach((h) => {
              let k = h.element;
              o
                ? (k.classList.contains('expanded') ||
                    (k.classList.add('expanded'),
                    b && h.currentPath && b(h.currentPath, !0)),
                  h.expandAll && h.expandAll(!0))
                : (k.classList.contains('expanded') &&
                    (k.classList.remove('expanded'),
                    b && h.currentPath && b(h.currentPath, !1)),
                  h.expandAll && h.expandAll(!1));
            }),
          r && r(o ? t + 1 : t));
      };
      if (
        ((this.expandAll = (n) => {
          v &&
            (n ? c.classList.add('expanded') : c.classList.remove('expanded'),
            b && m && b(m, n),
            p &&
              p.forEach((o) => {
                o.expandAll && o.expandAll(n);
              }));
        }),
        (this.currentPath = m),
        v)
      ) {
        let n = document.createElement('span');
        ((n.className = 'icon-wrapper'),
          u.appendChild(n),
          (x = document.createElement('span')),
          (x.className = 'expand icon clickable'),
          x.setAttribute(
            'title',
            w
              ? 'Collapse (Shift+Click for all)'
              : 'Expand (Shift+Click for all)',
          ),
          n.appendChild(x),
          n.addEventListener('click', (o) => {
            L(o.shiftKey);
          }));
      }
      if (a !== null && a !== '') {
        let n = typeof a;
        ((l = document.createElement('span')),
          (l.className = `key clickable ${n === 'number' ? 'number' : ''}`),
          (l.textContent = n === 'number' ? a : `${a}`),
          l.addEventListener('click', (h) => {
            L(h.shiftKey);
          }),
          u.appendChild(l));
        let o = document.createElement('span');
        (o.classList.add('colon'), (o.textContent = ':'), u.appendChild(o));
      }
      if (v) {
        let n = document.createElement('span');
        ((n.className = 'opening-parenthesis'),
          (n.textContent = f === 'array' ? '[' : '{'),
          u.appendChild(n));
        let o = document.createElement('span');
        ((o.className = 'ellipsis clickable'),
          (o.textContent = '...'),
          o.addEventListener('click', (S) => {
            L(S.shiftKey);
          }),
          u.appendChild(o));
        let h = document.createElement('span');
        ((h.className = 'closing-parenthesis'),
          (h.textContent = f === 'array' ? ']' : '}'),
          u.appendChild(h));
        let k = document.createElement('span'),
          z = f === 'array' ? e.length : Object.keys(e).length;
        ((k.className = 'items-size'),
          (k.textContent = `${z} item${z === 1 ? '' : 's'}`),
          u.appendChild(k),
          (p = []),
          (f === 'array' ? e.map((S, D) => D) : Object.keys(e)).forEach((S) => {
            let D = new G({
              key: S,
              value: e[S],
              expanded: d,
              indent: i,
              expandEmpty: C,
              onToggleExpand: r,
              level: t + 1,
              parentRow: c,
              path: m,
              expandedPaths: y,
              onPathToggle: b,
            });
            (p.push(D),
              c.appendChild(D.element),
              (this.maxLevel = Math.max(this.maxLevel, D.maxLevel)));
          }));
        let A = document.createElement('span');
        ((A.className = 'closing-parenthesis'),
          (A.textContent = f === 'array' ? ']' : '}'),
          c.appendChild(A));
      } else {
        let n = null;
        ['nan', 'NaN', 'undefined', 'null'].includes(f) ||
          ((n = document.createElement('span')),
          (n.className = 'type'),
          (n.textContent = f.toLowerCase()));
        let o = document.createElement('span');
        ((o.className = `value ${f.toLowerCase()}`),
          (s = document.createElement('span')),
          (s.className = 'value-data'),
          (s.textContent = f === 'string' ? `"${M(e)}"` : e),
          n && o.appendChild(n),
          o.appendChild(s),
          u.appendChild(o));
      }
      let B = document.createElement('span');
      ((B.className = 'copy icon'),
        B.setAttribute('title', 'Copy to clipboard'));
      let T = document.createElement('span');
      ((T.className = 'icon-wrapper'),
        T.addEventListener('click', () => {
          let n;
          (v
            ? (n = JSON.stringify(e, null, i))
            : e === null
              ? (n = 'null')
              : e === void 0
                ? (n = 'undefined')
                : (n = String(e)),
            navigator.clipboard.writeText(n));
        }),
        T.appendChild(B),
        u.appendChild(T));
      let _ = (n) => {
        let o = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
          h = new RegExp(o, 'gi'),
          k = [];
        (l && k.push(l), s && k.push(s));
        let z = !1;
        (k.forEach((q) => {
          let A = q.textContent;
          if (((q.innerHTML = A), !n || n === '')) return;
          let S = [...A.matchAll(h)].map((I) => I.index),
            D = [],
            j = 0;
          (S.forEach((I) => {
            ((z = !0), D.push(A.slice(j, I)));
            let ee = A.slice(I, I + n.length);
            (D.push(`<span class="match">${ee}</span>`), (j = I + n.length));
          }),
            D.push(A.slice(j)),
            (q.innerHTML = D.join('')));
        }),
          z &&
            !c.classList.contains('expanded') &&
            (L(), N && N.classList.add('expanded')));
      };
      ((this.update = ({ expanded: n, indent: o, searchTerm: h }) => {
        (o !== void 0 && t > 0 && (c.style.paddingLeft = `${o * 5}px`),
          n !== void 0 &&
            ((w = n === !0 || n > t),
            E && C === !1 && (w = !1),
            c.classList.toggle('expanded', w),
            x &&
              (x.title = w
                ? 'Collapse (Shift+Click for all)'
                : 'Expand (Shift+Click for all)')),
          h != null && _(h),
          p &&
            p.forEach((k) =>
              k.update({ expanded: n, indent: o, searchTerm: h }),
            ));
      }),
        (this.element = c));
    },
    Q = G;
  var te = function ({
      expanded: a,
      indent: e,
      onChange: d,
      onSearch: i,
      showDetails: r,
    }) {
      ((this.indent = e || 2),
        (this.expanded = typeof a == 'number' ? a : 2),
        (this.showDetails = r !== !1),
        (this.maxExpandLevel = 0));
      let t,
        N = document.createElement('div');
      N.className = 'toolbar';
      let g = document.createElement('div');
      ((g.className = 'options'), N.appendChild(g));
      let y = document.createElement('div');
      ((y.className = 'search-wrapper'), N.appendChild(y));
      let b = document.createElement('button');
      ((b.type = 'button'),
        (b.className = 'icon-wrapper'),
        b.setAttribute('title', 'Reset to defaults'),
        b.setAttribute('aria-label', 'Reset to defaults'),
        g.appendChild(b));
      let C = document.createElement('span');
      ((C.className = 'icon refresh'),
        C.setAttribute('aria-hidden', 'true'),
        (b.onclick = () => this.refresh()),
        b.appendChild(C));
      let c = document.createElement('button');
      ((c.type = 'button'),
        (c.className = 'icon-wrapper'),
        c.setAttribute('title', 'Expand'),
        c.setAttribute('aria-label', 'Expand one level'),
        g.appendChild(c));
      let m = document.createElement('span');
      ((m.className = 'icon plus'),
        m.setAttribute('aria-hidden', 'true'),
        c.appendChild(m),
        (c.onclick = () => {
          (this.expanded < this.maxExpandLevel && (this.expanded += 1),
            d({ expanded: this.expanded }));
        }));
      let f = document.createElement('button');
      ((f.type = 'button'),
        (f.className = 'icon-wrapper'),
        f.setAttribute('title', 'Collapse'),
        f.setAttribute('aria-label', 'Collapse one level'),
        g.appendChild(f));
      let v = document.createElement('span');
      ((v.className = 'icon minus'),
        v.setAttribute('aria-hidden', 'true'),
        f.appendChild(v),
        (f.onclick = () => {
          (this.expanded > this.maxExpandLevel &&
            (this.expanded = this.maxExpandLevel),
            this.expanded > 0 && (this.expanded -= 1),
            d({ expanded: this.expanded }));
        }));
      let E = document.createElement('button');
      ((E.type = 'button'),
        (E.className = 'icon-wrapper'),
        E.setAttribute('title', 'Increase indent'),
        E.setAttribute('aria-label', 'Increase indent'),
        g.appendChild(E));
      let w = document.createElement('span');
      ((w.className = 'icon indent'),
        w.setAttribute('aria-hidden', 'true'),
        (E.onclick = () => {
          ((this.indent += 1), d({ indent: this.indent }));
        }),
        E.appendChild(w));
      let x = document.createElement('button');
      ((x.type = 'button'),
        (x.className = 'icon-wrapper'),
        x.setAttribute('title', 'Decrease indent'),
        x.setAttribute('aria-label', 'Decrease indent'),
        g.appendChild(x));
      let p = document.createElement('span');
      ((p.className = 'icon outdent'),
        p.setAttribute('aria-hidden', 'true'),
        (x.onclick = () => {
          ((this.indent -= 1), d({ indent: this.indent }));
        }),
        x.appendChild(p));
      let l = document.createElement('button');
      ((l.type = 'button'),
        (l.className = 'icon-wrapper'),
        l.setAttribute('title', 'Toggle details'),
        l.setAttribute('aria-label', 'Toggle details'),
        l.setAttribute('aria-pressed', this.showDetails ? 'true' : 'false'),
        g.appendChild(l));
      let s = document.createElement('span');
      ((s.className = `icon info ${this.showDetails ? 'active' : ''}`),
        s.setAttribute('aria-hidden', 'true'),
        (l.onclick = () => {
          (s.classList.toggle('active'),
            (this.showDetails = !this.showDetails),
            l.setAttribute('aria-pressed', this.showDetails ? 'true' : 'false'),
            d({ showDetails: this.showDetails }));
        }),
        l.appendChild(s));
      let u = document.createElement('span');
      ((u.className = 'icon search'),
        y.appendChild(u),
        (t = document.createElement('input')),
        (t.className = 'search-input'),
        (t.placeholder = 'Search'),
        (t.oninput = (L) => {
          i(L.target.value);
        }),
        y.appendChild(t),
        (this.refresh = () => {
          ((this.expanded = 1),
            (this.indent = 2),
            t && (t.value = ''),
            d({ indent: 2, expanded: 1 }),
            i(''));
        }),
        (this.updateShowDetails = (L) => {
          ((this.showDetails = L),
            l.setAttribute('aria-pressed', this.showDetails ? 'true' : 'false'),
            this.showDetails
              ? s.classList.add('active')
              : s.classList.remove('active'));
        }),
        (this.element = N));
    },
    V = te;
  function de(a, e = {}) {
    let d = document.createElement('div');
    ((d.className = 'container'), a.appendChild(d));
    let i = null,
      r = null,
      t = {},
      N = new Set();
    ((this.update = ({
      data: g,
      expanded: y,
      indent: b,
      expandIconType: C,
      showDataTypes: c,
      showToolbar: m,
      showSize: f,
      showCopy: v,
      preserveExpanded: E,
      expandEmpty: w,
    }) => {
      if (
        (E !== void 0 && (t.preserveExpanded = E),
        w !== void 0 && (t.expandEmpty = w),
        g != null)
      ) {
        let p = JSON.stringify(g);
        if (t.dataComapreString !== p) {
          t.dataComapreString = p;
          let l = t.preserveExpanded
            ? (s, u) => {
                u ? N.add(s) : N.delete(s);
              }
            : null;
          ((i = new Q({
            key: '',
            value: g,
            expanded: y,
            indent: b,
            expandEmpty: t.expandEmpty !== void 0 ? t.expandEmpty : !0,
            onToggleExpand: (s) => {
              (r && (r.expanded = s), (t.expanded = s));
            },
            path: '',
            expandedPaths: t.preserveExpanded ? N : null,
            onPathToggle: l,
          })),
            d.replaceChildren(i.element),
            t.showToolbar &&
              r &&
              (d.prepend(r.element),
              (r.maxExpandLevel = i.maxLevel),
              r.refresh()));
        }
      }
      if (m !== void 0 && t.showToolbar !== m)
        if (((t.showToolbar = m), m))
          (r ||
            (r = new V({
              expanded: t.expanded,
              indent: t.indent,
              onChange: ({ expanded: p, indent: l, showDetails: s }) => {
                let u = { expanded: p, indent: l };
                (s !== void 0 &&
                  ((u.showCopy = s), (u.showSize = s), (u.showDataTypes = s)),
                  this.update(u));
              },
              onSearch: (p) => {
                i && i.update({ searchTerm: p });
              },
            })),
            i && (r.maxExpandLevel = i.maxLevel),
            d.prepend(r.element));
        else {
          let p = d.querySelector('.toolbar');
          p && p.remove();
        }
      let x = {};
      (y !== void 0 && t.expanded !== y && ((t.expanded = y), (x.expanded = y)),
        b !== void 0 && t.indent !== b && ((t.indent = b), (x.indent = b)),
        Object.keys(x).length > 0 && i && i.update(x),
        v !== void 0 &&
          t.showCopy !== v &&
          ((t.showCopy = v), d.classList.toggle('show-copy', v)),
        f !== void 0 &&
          t.showSize !== f &&
          ((t.showSize = f),
          d.classList.toggle('show-size', f),
          r && r.updateShowDetails(t.showSize || t.showDataTypes)),
        c !== void 0 &&
          t.showDataTypes !== c &&
          ((t.showDataTypes = c),
          d.classList.toggle('show-data-types', c),
          r && r.updateShowDetails(t.showSize || t.showDataTypes)),
        C !== void 0 &&
          t.expandIconType !== C &&
          (d.classList.add(`expand-icon-${C}`),
          d.classList.remove(`expand-icon-${t.expandIconType}`),
          (t.expandIconType = C)));
    }),
      this.update(e));
  }
  var X = de;
  var Y = {
      indent: 2,
      expanded: 1,
      theme: 'default-light',
      showDataTypes: !0,
      showToolbar: !1,
      expandIconType: 'arrow',
      showCopy: !0,
      showSize: !0,
      preserveExpanded: !1,
      expandEmpty: !0,
      data: null,
    },
    U = class a extends HTMLElement {
      #t;
      #e;
      #n;
      #c;
      constructor() {
        (super(),
          (this.#e = { ...Y }),
          (this.#t = document.createElement('style')));
        let e = this.attachShadow({ mode: 'open' }),
          d = document.createElement('style');
        ((d.textContent = `${P}`),
          e.appendChild(d),
          e.appendChild(this.#t),
          (this.theme = this.#e.theme),
          (this.#c = new X(e, this.#e)));
      }
      static get observedAttributes() {
        return Object.keys(Y).map((e) =>
          e.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase(),
        );
      }
      static allowedAttributes = ['id'].concat(a.observedAttributes);
      #d = (...e) => {
        console.warn(`JsonViewer${this.id ? ` (${this.id})` : ''}:`, ...e);
      };
      #a = (e, d, i, r) => {
        try {
          if (((d = i(d)), r && !r.includes(d)))
            throw new Error(`should be one of ${r.join(', ')}`);
          if (this.#e[e] === d) return;
          ((this.#e[e] = d), this.#r());
        } catch (t) {
          this.#d(`Attribute ${e}: ${t.message}`);
        }
      };
      set showDataTypes(e) {
        this.#a('showDataTypes', e, $);
      }
      set showToolbar(e) {
        this.#a('showToolbar', e, $);
      }
      set indent(e) {
        this.#a('indent', e, K);
      }
      set expandIconType(e) {
        this.#a('expandIconType', e, W, ['arrow', 'square', 'circle']);
      }
      set expanded(e) {
        this.#a('expanded', e, Z);
      }
      set showSize(e) {
        this.#a('showSize', e, $);
      }
      set showCopy(e) {
        this.#a('showCopy', e, $);
      }
      set preserveExpanded(e) {
        this.#a('preserveExpanded', e, $);
      }
      set expandEmpty(e) {
        this.#a('expandEmpty', e, $);
      }
      set theme(e) {
        try {
          if (((e = O(e)), this.#e.theme === e && this.#t.textContent !== ''))
            return;
          ((this.#t.textContent = H(e)), (this.#e.theme = e));
        } catch (d) {
          this.#d(`Attribute theme: ${d.message}`);
        }
      }
      set data(e) {
        try {
          e = O(e);
          let d = JSON.stringify(e);
          if (this.#e.data === d) return;
          ((this.#e.data = d),
            R(e)
              ? fetch(e)
                  .then((i) => i.json())
                  .then((i) => {
                    ((this.#n = i), this.#r());
                  })
              : ((this.#n = e), this.#r()));
        } catch (d) {
          this.#d(`Attribute data: ${d.message}`);
        }
      }
      get options() {
        return this.#e;
      }
      connectedCallback() {
        let e = this.textContent;
        e.trim() && ((this.textContent = ''), (this.data = e));
      }
      attributeChangedCallback(e, d, i) {
        if (a.allowedAttributes.indexOf(e) > -1) {
          let r = e.replace(/-([a-z])/g, (t) => t[1].toUpperCase());
          this[r] = i;
        } else
          (this.#d(`Attribute ${e} is not supported and will be ignored!`),
            this.removeAttribute(e));
      }
      #r = () => {
        this.#c.update({
          data: this.#n,
          expanded: this.#e.expanded,
          expandIconType: this.#e.expandIconType,
          indent: this.#e.indent,
          showDataTypes: this.#e.showDataTypes,
          showToolbar: this.#e.showToolbar,
          showSize: this.#e.showSize,
          showCopy: this.#e.showCopy,
          preserveExpanded: this.#e.preserveExpanded,
          expandEmpty: this.#e.expandEmpty,
        });
      };
    };
  customElements.get('andypf-json-viewer') ||
    customElements.define('andypf-json-viewer', U);
})();

const JsonViewerPlugin = (system) => ({
  wrapComponents: {
    HighlightCode: (Original) => (props) => {
      try {
        const json = JSON.parse(props.children);
        // const jsonViewer = document.createElement("andypf-json-viewer")
        // jsonViewer.id = "json"
        // jsonViewer.expanded = 2
        // jsonViewer.indent = 2
        // jsonViewer.showDataTypes = true
        // jsonViewer.theme = "monokai"
        // jsonViewer.showToolbar = true
        // jsonViewer.showSize = true
        // jsonViewer.showCopy = true
        // jsonViewer.expandIconType = "square"
        // jsonViewer.expandEmpty = false
        // jsonViewer.data = json
        return system.React.createElement('andypf-json-viewer', {
          theme: 'default-dark',
          data: JSON.stringify(json, null, 2),
          'show-toolbar': true,
          expanded: 2,
        });
      } catch (err) {
        console.error(err);
        return Original(props);
      }
    },
  },
});
window.onload = function () {
  window.ui = SwaggerUIBundle({
    url: 'http://localhost:3000/docs-json',
    dom_id: '#swagger-ui',
    presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
    plugins: [
      SwaggerUIBundle.plugins.DownloadUrl,
      SwaggerUIBundle.plugins.Auth,
      SwaggerUIBundle.plugins.RequestSnippets,

      JsonViewerPlugin,
    ],
    layout: 'StandaloneLayout',
  });
};
