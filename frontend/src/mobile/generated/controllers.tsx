// @ts-nocheck
// Generated from prototype/screens. Rebuild with npm run prototype:generate.
import { DesignController } from "../renderer";


export class ScreenGAddDish extends DesignController {
  constructor(props) {
    super(props);
    this.state = { cat: 0, tags: { '平价': true, '鲜虾大只': true }, desc: '' };
  }
  renderVals() {
    const catLabels = ['主食', '小吃', '饮品', '甜品', '汤', '火锅', '烧烤', '凉菜', '配菜', '其他'];
    const tagLabels = ['平价', '量大', '鲜虾大只'];
    const cat = this.state.cat;
    const tags = this.state.tags;
    return {
      desc: this.state.desc,
      descLen: this.state.desc.length,
      setDesc: (e) => this.setState({ desc: e.target.value.slice(0, 200) }),
      cats: catLabels.map((label, i) => {
        const on = i === cat;
        return {
          label: label,
          on: on ? 'true' : 'false',
          bg: on ? '#231C18' : '#F4EFEB',
          fg: on ? '#FFFFFF' : '#231C18',
          w: on ? 600 : 400,
          pick: () => this.setState({ cat: i })
        };
      }),
      tags: tagLabels.map((label) => {
        const on = !!tags[label];
        return {
          label: label,
          on: on ? 'true' : 'false',
          bg: on ? '#FBEFD9' : '#FFFFFF',
          line: on ? '#231C18' : '#E6DED8',
          fg: '#231C18',
          w: on ? 600 : 400,
          toggle: () => {
            const next = Object.assign({}, this.state.tags);
            next[label] = !next[label];
            this.setState({ tags: next });
          }
        };
      })
    };
  }
}


export class ScreenGBlocked extends DesignController {
  constructor(props) {
    super(props);
    this.state = {
      list: [
        { name: '刷屏小号', initial: '刷', when: '10 月 12 日', bg: '#9DBF7A', fg: '#231C18' },
        { name: '同学 0917', initial: '同', when: '9 月 30 日', bg: '#D8B27A', fg: '#231C18' }
      ]
    };
  }
  renderVals() {
    const list = this.state.list;
    return {
      hasAny: list.length > 0,
      none: list.length === 0,
      people: list.map((p) => Object.assign({}, p, {
        unblock: () => this.setState({ list: this.state.list.filter((x) => x.name !== p.name) })
      }))
    };
  }
}


export class ScreenGChangePassword extends DesignController {
  constructor(props) {
    super(props);
    this.state = { old: 'chifan2026', pwd: 'chifan2027', oldShow: false, newShow: false, done: false };
  }
  renderVals() {
    const wrong = (this.props.tip ?? '无') === '现在的密码不对';
    const ready = this.state.old.length > 0 && this.state.pwd.length >= 6 && this.state.pwd.length <= 64;
    return {
      old: this.state.old,
      pwd: this.state.pwd,
      wrong: wrong,
      oldBad: wrong ? 'true' : 'false',
      oldLine: wrong ? '#A8321C' : '#E6DED8',
      oldType: this.state.oldShow ? 'text' : 'password',
      oldShow: this.state.oldShow,
      oldHide: !this.state.oldShow,
      oldEye: this.state.oldShow ? '隐藏现在的密码' : '显示现在的密码',
      newType: this.state.newShow ? 'text' : 'password',
      newShow: this.state.newShow,
      newHide: !this.state.newShow,
      newEye: this.state.newShow ? '隐藏新密码' : '显示新密码',
      ready: ready,
      notReady: !ready,
      editing: !this.state.done,
      done: this.state.done,
      setOld: (e) => this.setState({ old: e.target.value }),
      setPwd: (e) => this.setState({ pwd: e.target.value.slice(0, 64) }),
      toggleOld: () => this.setState({ oldShow: !this.state.oldShow }),
      toggleNew: () => this.setState({ newShow: !this.state.newShow }),
      submit: () => this.setState({ done: true })
    };
  }
}


export class ScreenGChangePhone extends DesignController {
  constructor(props) {
    super(props);
    this.state = { pwd: 'chifan2026', phone: '139 8765 4321', code: '', sent: false, requested: false, secs: 60, show: false, done: false };
    this.timer = null;
  }
  componentWillUnmount() {
    if (this.timer) clearInterval(this.timer);
  }
  renderVals() {
    const sent = this.state.sent;
    const digits = this.state.phone.replace(/\D/g, '');
    const masked = digits.length === 11 ? digits.slice(0, 3) + ' **** ' + digits.slice(7) : this.state.phone;
    const ready = this.state.pwd.length > 0 && this.state.requested && this.state.code.length === 6;
    return {
      pwd: this.state.pwd,
      phone: this.state.phone,
      code: this.state.code,
      masked: masked,
      sent: sent,
      notSent: !sent,
      secs: this.state.secs,
      pwdType: this.state.show ? 'text' : 'password',
      show: this.state.show,
      hide: !this.state.show,
      eyeLabel: this.state.show ? '隐藏密码' : '显示密码',
      ready: ready,
      notReady: !ready,
      editing: !this.state.done,
      done: this.state.done,
      setPwd: (e) => this.setState({ pwd: e.target.value }),
      setPhone: (e) => this.setState({ phone: e.target.value }),
      setCode: (e) => this.setState({ code: e.target.value.replace(/\D/g, '').slice(0, 6) }),
      toggleShow: () => this.setState({ show: !this.state.show }),
      submit: () => {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
        this.setState({ done: true });
      },
      send: () => {
        this.setState({ sent: true, requested: true, secs: 60 });
        if (this.timer) clearInterval(this.timer);
        this.timer = setInterval(() => {
          const next = this.state.secs - 1;
          if (next <= 0) {
            clearInterval(this.timer);
            this.timer = null;
            this.setState({ sent: false, secs: 60 });
          } else {
            this.setState({ secs: next });
          }
        }, 1000);
        setTimeout(() => { if (!this.state.code) this.setState({ code: '135790' }); }, 1200);
      }
    };
  }
}


export class ScreenGComments extends DesignController {
  constructor(props) {
    super(props);
    this.state = { tab: 'useful', liked: true };
  }
  renderVals() {
    const tab = (key) => {
      const on = this.state.tab === key;
      return { on: on, fg: on ? '#231C18' : '#6E625B', size: on ? 17 : 15, w: on ? 900 : 400, pick: () => this.setState({ tab: key }) };
    };
    const liked = this.state.liked;
    return {
      useful: tab('useful'),
      latest: tab('latest'),
      like1: { on: liked, off: !liked, fg: liked ? '#C9442B' : '#6E625B', n: liked ? 46 : 45, flip: () => this.setState({ liked: !liked }) }
    };
  }
}


export class ScreenGCrop extends DesignController {
  constructor(props) {
    super(props);
    this.state = { ox: 0, oy: 0, zoom: 1, dragging: false, cut: false, color: 0 };
    this.start = null;
  }
  renderVals() {
    const palette = [
      { name: '酱色', hex: '#8F5B24', on: '#FFFFFF' },
      { name: '红油', hex: '#A8321C', on: '#FFFFFF' },
      { name: '辣橙', hex: '#D9632B', on: '#231C18' }
    ];
    const sel = this.state.color;
    return {
      ox: this.state.ox,
      oy: this.state.oy,
      zoom: this.state.zoom,
      zoomTo: (e) => this.setState({ zoom: parseFloat(e.target.value) }),
      cutLabel: this.state.cut ? 'true' : 'false',
      cutTrack: this.state.cut ? '#4C9A5E' : 'rgba(255,255,255,0.25)',
      cutAlign: this.state.cut ? 'flex-end' : 'flex-start',
      toggleCut: () => this.setState({ cut: !this.state.cut }),
      pick: palette[sel],
      colors: palette.map((c, i) => ({
        name: c.name,
        hex: c.hex,
        on: i === sel ? 'true' : 'false',
        ring: i === sel ? 3 : 0,
        ring2: i === sel ? 5 : 0,
        pick: () => this.setState({ color: i })
      })),
      down: (e) => {
        this.start = { x: e.clientX, y: e.clientY, ox: this.state.ox, oy: this.state.oy };
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
        this.setState({ dragging: true });
      },
      move: (e) => {
        if (!this.state.dragging || !this.start) return;
        this.setState({ ox: this.start.ox + e.clientX - this.start.x, oy: this.start.oy + e.clientY - this.start.y });
      },
      up: () => {
        this.start = null;
        this.setState({ dragging: false });
      }
    };
  }
}


export class ScreenGDataNotice extends DesignController {
  renderVals() {
    const inSettings = (this.props.from ?? '设置里') === '设置里';
    return {
      inSettings: inSettings,
      inRegister: !inSettings,
      backTo: inSettings ? 'G-SettingsAccount.dc.html' : 'G-RegisterConfirm.dc.html'
    };
  }
}


export class ScreenGDeleteAccount extends DesignController {
  constructor(props) {
    super(props);
    this.state = { code: '', done: false };
  }
  renderVals() {
    const ready = this.state.code.length === 6;
    return {
      code: this.state.code,
      ready: ready,
      notReady: !ready,
      editing: !this.state.done,
      done: this.state.done,
      setCode: (e) => this.setState({ code: e.target.value.replace(/\D/g, '').slice(0, 6) }),
      submit: () => this.setState({ done: true })
    };
  }
}


export class ScreenGDetail extends DesignController {
  renderVals() {
    return {};
  }
}


export class ScreenGDevices extends DesignController {
  constructor(props) {
    super(props);
    this.state = {
      list: [
        { id: 'web', name: 'Chrome 网页版', when: 'Mac，昨天 22:14', web: true },
        { id: 'mi', name: '小米 14', when: '10 月 12 日', web: false }
      ]
    };
  }
  renderVals() {
    const list = this.state.list;
    return {
      others: list.map((d) => Object.assign({}, d, {
        isWeb: d.web,
        isPhone: !d.web,
        kick: () => this.setState({ list: this.state.list.filter((x) => x.id !== d.id) })
      })),
      hasOthers: list.length > 0,
      noOthers: list.length === 0,
      kickAll: () => this.setState({ list: [] })
    };
  }
}


export class ScreenGDish extends DesignController {
  constructor(props) {
    super(props);
    this.state = { fav: false };
  }
  renderVals() {
    const fav = this.state.fav;
    return {
      fav: fav,
      notFav: !fav,
      favOn: fav ? 'true' : 'false',
      flipFav: () => this.setState({ fav: !fav })
    };
  }
}


export class ScreenGEditProfile extends DesignController {
  constructor(props) {
    super(props);
    this.state = { nick: '天凉被破王', sign: '只吃好吃的，也只推荐好吃的', sheet: false };
  }
  renderVals() {
    const n = this.state.nick.trim().length;
    const bad = n < 2;
    return {
      nick: this.state.nick,
      nickLen: this.state.nick.length,
      sign: this.state.sign,
      signLen: this.state.sign.length,
      nickBad: bad ? 'true' : 'false',
      nickLine: bad ? '#A8321C' : '#231C18',
      nickTip: bad ? '昵称至少 2 个字' : '2–12 个字，可以和别人重名',
      nickTipColor: bad ? '#A8321C' : '#6E625B',
      valid: !bad,
      invalid: bad,
      sheet: this.state.sheet,
      setNick: (e) => this.setState({ nick: e.target.value.slice(0, 12) }),
      setSign: (e) => this.setState({ sign: e.target.value.slice(0, 30) }),
      toggleSheet: () => this.setState({ sheet: !this.state.sheet })
    };
  }
}


export class ScreenGFeedback extends DesignController {
  constructor(props) {
    super(props);
    this.state = { text: '加标签的词表里没有「汤底偏酸」，想加一个。', ctx: true, done: false };
  }
  renderVals() {
    const ready = this.state.text.trim().length > 0;
    const ctx = this.state.ctx;
    return {
      text: this.state.text,
      len: this.state.text.length,
      hasCtx: ctx,
      boxTop: ctx ? 232 : 184,
      shotTop: ctx ? 466 : 418,
      ready: ready,
      notReady: !ready,
      editing: !this.state.done,
      done: this.state.done,
      setText: (e) => this.setState({ text: e.target.value.slice(0, 500) }),
      dropCtx: () => this.setState({ ctx: false }),
      submit: () => this.setState({ done: true })
    };
  }
}


export class ScreenGFollows extends DesignController {
  constructor(props) {
    super(props);
    this.state = { tab: 'fans', mine: { '阿哲': false, 'Momo': false, '同学 4821': false, '小林': true, '安安': true, '一碗面': true, '老街点心粉': true } };
  }
  renderVals() {
    const mineMode = (this.props.owner ?? '自己的') === '自己的';
    const tab = (key) => {
      const on = this.state.tab === key;
      return { on: on, fg: on ? '#231C18' : '#6E625B', size: on ? 17 : 15, w: on ? 900 : 400, pick: () => this.setState({ tab: key }) };
    };
    const people = [
      { name: '阿哲', initial: '哲', sign: '西门小吃街常驻选手', bg: '#9DB8D9', fg: '#231C18', fan: true },
      { name: '小林', initial: '林', sign: '每天一杯杨枝甘露', bg: '#F3C46E', fg: '#231C18', fan: true },
      { name: 'Momo', initial: 'M', sign: '只吃辣的', bg: '#C9442B', fg: '#FFFFFF', fan: true },
      { name: '安安', initial: '安', sign: '', bg: '#8F5B24', fg: '#FFFFFF', fan: true },
      { name: '同学 4821', initial: '同', sign: '', bg: '#9DBF7A', fg: '#231C18', fan: true },
      { name: '一碗面', initial: '面', sign: '面食爱好者，求推荐拉面', bg: '#D8B27A', fg: '#231C18', fan: true },
      { name: '老街点心粉', initial: '老', sign: '粘豆包一周三次', bg: '#FFCB45', fg: '#231C18', fan: false }
    ];
    const fansTab = this.state.tab === 'fans';
    const list = people.filter((p) => fansTab ? p.fan : this.state.mine[p.name]);
    return {
      who: mineMode ? '我的粉丝和关注' : '阿哲的粉丝和关注',
      backTo: mineMode ? 'G-Me.dc.html' : 'G-UserProfile.dc.html',
      visible: mineMode,
      hidden: !mineMode,
      tFans: tab('fans'),
      tFollow: tab('follow'),
      fansN: 37,
      followN: 37,
      rows: list.map((p) => {
        const iFollow = !!this.state.mine[p.name];
        const mutual = iFollow && p.fan;
        let label = '回关';
        if (mutual) label = '已互关';
        else if (iFollow) label = '已关注';
        else if (!p.fan) label = '关注';
        const solid = !iFollow;
        return Object.assign({}, p, {
          sign: p.sign || '还没写签名',
          label: label,
          solid: solid,
          light: !solid,
          flip: () => {
            const next = Object.assign({}, this.state.mine);
            next[p.name] = !iFollow;
            this.setState({ mine: next });
          }
        });
      })
    };
  }
}


export class ScreenGForgotPassword extends DesignController {
  constructor(props) {
    super(props);
    this.state = { phone: '138 1234 5678', code: '', sent: false, requested: false, secs: 60, pwd: '', show: false, done: false };
    this.timer = null;
  }
  componentWillUnmount() {
    if (this.timer) clearInterval(this.timer);
  }
  renderVals() {
    const sent = this.state.sent;
    const pwdOk = this.state.pwd.length >= 6 && this.state.pwd.length <= 64;
    const ready = this.state.requested && this.state.code.length === 6 && pwdOk;
    return {
      phone: this.state.phone,
      code: this.state.code,
      sent: sent,
      notSent: !sent,
      secs: this.state.secs,
      pwd: this.state.pwd,
      pwdType: this.state.show ? 'text' : 'password',
      show: this.state.show,
      hide: !this.state.show,
      eyeLabel: this.state.show ? '隐藏密码' : '显示密码',
      ready: ready,
      notReady: !ready,
      editing: !this.state.done,
      done: this.state.done,
      setPhone: (e) => this.setState({ phone: e.target.value }),
      setCode: (e) => this.setState({ code: e.target.value.replace(/\D/g, '').slice(0, 6) }),
      setPwd: (e) => this.setState({ pwd: e.target.value.slice(0, 64) }),
      toggleShow: () => this.setState({ show: !this.state.show }),
      submit: () => {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
        this.setState({ done: true });
      },
      send: () => {
        this.setState({ sent: true, requested: true, secs: 60 });
        if (this.timer) clearInterval(this.timer);
        this.timer = setInterval(() => {
          const next = this.state.secs - 1;
          if (next <= 0) {
            clearInterval(this.timer);
            this.timer = null;
            this.setState({ sent: false, secs: 60 });
          } else {
            this.setState({ secs: next });
          }
        }, 1000);
        setTimeout(() => { if (!this.state.code) this.setState({ code: '246810' }); }, 1200);
      }
    };
  }
}


export class ScreenGHistory extends DesignController {
  constructor(props) {
    super(props);
    this.state = { tab: 'dish' };
  }
  renderVals() {
    const tab = (key) => {
      const on = this.state.tab === key;
      return { on: on, fg: on ? '#231C18' : '#6E625B', size: on ? 17 : 15, w: on ? 900 : 400, pick: () => this.setState({ tab: key }) };
    };
    const dishes = [
      { title: '柳州螺蛳粉', sub: '螺蛳粉研究所', time: '12 分钟前', img: '../assets/photos/sq_luosi.png', href: 'G-Dish.dc.html' },
      { title: '铁锅炖大鹅', sub: '东北饭庄', time: '1 小时前', img: '../assets/photos/sq_tieguo.png', href: 'G-Dish.dc.html' },
      { title: '粘豆包', sub: '老街点心', time: '昨天', img: '../assets/photos/sq_niandou.png', href: 'G-Dish.dc.html' },
      { title: '红烧肉', sub: '家常小馆', time: '周一', img: '../assets/photos/sq_hongshao.png', href: 'G-Dish.dc.html' },
      { title: '玉米排骨汤', sub: '家常小馆', time: '周一', img: '../assets/photos/sq_paigu.png', href: 'G-Dish.dc.html' },
      { title: '鲜虾蟹籽云吞', sub: '袁记云饺', time: '10 月 18 日', img: '', href: 'G-Dish.dc.html' }
    ];
    const shops = [
      { title: '螺蛳粉研究所', sub: '万达金街 B1', time: '12 分钟前', img: '../assets/photos/sq_luosi.png', href: 'G-Detail.dc.html' },
      { title: '家常小馆', sub: '银座商城 2 层', time: '周一', img: '../assets/photos/sq_hongshao.png', href: 'G-Detail.dc.html' },
      { title: '老街点心', sub: '西门小吃街', time: '周日', img: '../assets/photos/sq_niandou.png', href: 'G-Detail.dc.html' },
      { title: '袁记云饺', sub: '万达金街 1 层', time: '10 月 18 日', img: '', href: 'G-Detail.dc.html' }
    ];
    const list = this.state.tab === 'dish' ? dishes : shops;
    return {
      tDish: tab('dish'),
      tShop: tab('shop'),
      rows: list.map((r) => Object.assign({}, r, { hasImg: !!r.img, noImg: !r.img }))
    };
  }
}


export class ScreenGHomePhoto extends DesignController {
  constructor(props) {
    super(props);
    this.state = { n: 0, drag: 0, dragging: false };
    this.startX = 0;
  }
  renderVals() {
    const ink = '#231C18';
    const light = { on: ink, ghost: 'rgba(255,255,255,0.42)', table: 'rgba(255,255,255,0.22)', ring: 'rgba(255,255,255,0.55)', solidShadow: 'inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -2px 0 rgba(0,0,0,0.28), 0 1px 2px rgba(35,28,24,0.2), 0 6px 14px rgba(35,28,24,0.16)' };
    const dark = { on: '#FFFFFF', ghost: 'rgba(255,255,255,0.18)', table: 'rgba(255,255,255,0.07)', ring: 'rgba(255,255,255,0.22)', solidShadow: 'inset 0 -2px 0 rgba(0,0,0,0.16), 0 2px 4px rgba(0,0,0,0.18), 0 8px 18px rgba(0,0,0,0.16)' };
    const dishes = [
      Object.assign({ l1: '柳州', l2: '螺蛳粉', shop: '螺蛳粉研究所', dist: '600 m', price: '16', stage: '#8F5B24' }, dark),
      Object.assign({ l1: '铁锅炖', l2: '', shop: '东北饭庄', dist: '750 m', price: '58', stage: '#A8321C' }, dark),
      Object.assign({ l1: '粘豆包', l2: '', shop: '老街点心', dist: '260 m', price: '8', stage: '#F3C46E' }, light),
      Object.assign({ l1: '红烧肉', l2: '', shop: '家常小馆', dist: '500 m', price: '38', stage: '#8F5B24' }, dark),
      Object.assign({ l1: '玉米', l2: '排骨汤', shop: '家常小馆', dist: '500 m', price: '26', stage: '#D8B27A' }, light)
    ];
    const N = dishes.length;
    const STEP = 55;
    const RADIUS = 430;
    const n = this.state.n;
    const k = ((n % N) + N) % N;
    const plate = (i) => {
      let d = (((i - n) % N) + N) % N;
      if (d > N / 2) d -= N;
      const theta = d * STEP + this.state.drag;
      const a = Math.min(1, Math.abs(theta) / STEP);
      const scale = 1 - 0.15 * a;
      return {
        t: 'rotate(' + theta.toFixed(2) + 'deg) translateY(-' + RADIUS + 'px) rotate(' + (-theta).toFixed(2) + 'deg) scale(' + scale.toFixed(3) + ')',
        o: Math.abs(d) >= 2 ? 0 : 1
      };
    };
    const dots = dishes.map((_, i) => ({ w: i === k ? 16 : 5, o: i === k ? 1 : 0.4 }));
    return {
      s: dishes[k],
      p0: plate(0), p1: plate(1), p2: plate(2), p3: plate(3), p4: plate(4),
      dots: dots,
      tr: this.state.dragging ? 'none' : 'transform 680ms cubic-bezier(0.2, 0.9, 0.25, 1.1), opacity 280ms ease',
      next: () => this.setState({ n: this.state.n + 1, drag: 0, dragging: false }),
      down: (e) => {
        this.startX = e.clientX;
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
        this.setState({ dragging: true, drag: 0 });
      },
      move: (e) => {
        if (!this.state.dragging) return;
        const deg = (e.clientX - this.startX) / 7.5;
        this.setState({ drag: Math.max(-STEP * 1.1, Math.min(STEP * 1.1, deg)) });
      },
      up: () => {
        if (!this.state.dragging) return;
        const drag = this.state.drag;
        let steps = 0;
        if (drag < -4) steps = 1;
        if (drag > 4) steps = -1;
        this.setState({ n: this.state.n + steps, drag: 0, dragging: false });
      }
    };
  }
}


export class ScreenGIcon extends DesignController {
  renderVals() {
    const key = this.props.icon || 'search';
    const is = {};
    is[key] = true;
    const size = this.props.size || 24;
    const sw = size >= 20 ? 2 : +Math.min(2.6, 1.6 * 24 / size).toFixed(2);
    return { size: size, sw: sw, is: is };
  }
}


export class ScreenGIcons extends DesignController {
  renderVals() {
    const list = [
      ['discover', '发现'], ['nearby', '附近'], ['me', '我的'], ['add', '发布'], ['search', '搜索'], ['bell', '消息'],
      ['back', '返回'], ['close', '关闭'], ['chevronRight', '进入'], ['chevronDown', '展开'], ['more', '更多'], ['check', '勾选'],
      ['shuffle', '换一个'], ['share', '分享'], ['navigate', '导航'], ['heart', '赞'], ['heartOn', '赞过'], ['bookmark', '收藏'],
      ['bookmarkOn', '收藏过'], ['comment', '评论'], ['report', '举报'], ['edit', '编辑'], ['delete', '删除'], ['settings', '设置'],
      ['filter', '筛选'], ['locate', '我的位置'], ['camera', '拍照'], ['image', '照片'], ['tag', '标签'], ['history', '足迹'],
      ['verify', '认证'], ['phone', '手机号'], ['mail', '邮箱'], ['mailSend', '邮件已发'], ['lock', '仅自己'], ['key', '密码'],
      ['eye', '显示'], ['eyeOff', '隐藏'], ['logout', '退出'], ['follow', '关注'], ['followed', '已关注'], ['unfollow', '取消关注'],
      ['block', '屏蔽'], ['store', '店'], ['bowl', '菜'], ['utensils', '吃饭'], ['time', '饭点'], ['school', '校区'],
      ['district', '商圈'], ['map', '地图'], ['pin', '选点'], ['link', '复制链接'], ['copy', '复制'], ['sort', '排序'],
      ['warning', '提示'], ['info', '说明'], ['question', '帮助'], ['calendar', '日期'], ['topic', '专题'], ['hot', '热门'],
      ['earth', '境外存放'], ['document', '协议'], ['feedback', '反馈'], ['external', '外部页面'], ['addCircle', '添加'], ['closeCircle', '清空'],
      ['checkCircle', '完成'], ['send', '发送'], ['notifyOff', '不打扰'], ['moon', '夜间'], ['shield', '安全'], ['idcard', '身份'],
      ['computer', '电脑'], ['announce', '公告'], ['download', '更新'], ['wifiOff', '没网'], ['tool', '维护'], ['pause', '暂停']
    ];
    return {
      count: list.length,
      icons: list.map((x) => ({ key: x[0], label: x[1], color: x[0] === 'heartOn' ? '#C9442B' : '#231C18' }))
    };
  }
}


export class ScreenGInbox extends DesignController {
  renderVals() {
    return {};
  }
}


export class ScreenGKit extends DesignController {
  renderVals() {
    return {};
  }
}


export class ScreenGLogin extends DesignController {
  constructor(props) {
    super(props);
    this.state = { agreed: false };
  }
  renderVals() {
    return {
      agreed: this.state.agreed,
      notAgreed: !this.state.agreed,
      toggle: () => this.setState({ agreed: !this.state.agreed })
    };
  }
}


export class ScreenGMe extends DesignController {
  renderVals() {
    return {};
  }
}


export class ScreenGMyTags extends DesignController {
  constructor(props) {
    super(props);
    this.state = {
      edit: false,
      renaming: -1,
      draft: '',
      tags: [
        { name: '一个人吃', count: 12 },
        { name: '便宜大碗', count: 9 },
        { name: '考试周', count: 8 },
        { name: '宵夜', count: 6 },
        { name: '请客', count: 5 },
        { name: '减脂', count: 4 },
        { name: '下雨天', count: 3 },
        { name: '想再吃一次', count: 3 },
        { name: '带爸妈来', count: 2 }
      ]
    };
  }
  renderVals() {
    const edit = this.state.edit;
    return {
      n: 12,
      editLabel: edit ? '完成' : '管理',
      toggleEdit: () => this.setState({ edit: !edit, renaming: -1 }),
      tags: this.state.tags.map((t, i) => {
        const renaming = this.state.renaming === i;
        return {
          name: t.name,
          count: t.count,
          renaming: renaming,
          showing: !renaming,
          edit: edit,
          plain: !edit,
          draft: this.state.draft,
          setDraft: (e) => this.setState({ draft: e.target.value.slice(0, 10) }),
          rename: () => this.setState({ renaming: i, draft: t.name }),
          save: () => {
            const d = this.state.draft.trim();
            const next = this.state.tags.slice();
            if (d) next[i] = { name: d, count: t.count };
            this.setState({ tags: next, renaming: -1 });
          },
          remove: () => this.setState({ tags: this.state.tags.filter((_, j) => j !== i) })
        };
      })
    };
  }
}


export class ScreenGNav extends DesignController {
  renderVals() {
    const active = this.props.active ?? 'home';
    const tab = (key) => {
      const on = key === active;
      return {
        cur: on ? 'page' : 'false',
        bg: on ? '#F4EFEB' : 'transparent',
        fg: on ? '#231C18' : '#6E625B',
        w: on ? 700 : 500
      };
    };
    return { t: { home: tab('home'), nearby: tab('nearby'), me: tab('me') } };
  }
}


export class ScreenGNearby extends DesignController {
  renderVals() {
    return {};
  }
}


export class ScreenGNewShop extends DesignController {
  constructor(props) {
    super(props);
    this.state = { name: '袁记云饺', desc: '', kept: false };
  }
  renderVals() {
    const name = this.state.name.trim();
    const dup = name === '袁记云饺' && !this.state.kept;
    const ready = name.length > 0 && this.state.desc.trim().length > 0 && !dup;
    return {
      name: this.state.name,
      nameLen: this.state.name.length,
      desc: this.state.desc,
      descLen: this.state.desc.length,
      dup: dup,
      ready: ready,
      notReady: !ready,
      setName: (e) => this.setState({ name: e.target.value.slice(0, 20), kept: false }),
      setDesc: (e) => this.setState({ desc: e.target.value.slice(0, 30) }),
      keep: () => this.setState({ kept: true })
    };
  }
}


export class ScreenGPanelFilter extends DesignController {
  constructor(props) {
    super(props);
    this.state = { cats: ['小吃', '汤'], price: '¥15–30', good: true, fav: false };
  }
  renderVals() {
    const names = ['主食', '小吃', '饮品', '甜品', '汤', '火锅', '烧烤', '凉菜', '配菜', '其他'];
    const picked = this.state.cats;
    const sw = (on, flip) => ({
      on: on ? 'true' : 'false',
      track: on ? 'linear-gradient(180deg, #3B312B, #231C18)' : '#E6DED8',
      shadow: on ? 'inset 0 -1px 0 rgba(0,0,0,0.28)' : 'inset 0 1px 2px rgba(35,28,24,0.12)',
      align: on ? 'flex-end' : 'flex-start',
      flip: flip
    });
    let count = 18 - picked.length * 2 - (this.state.price === '不限' ? 0 : 3) - (this.state.good ? 1 : 0) - (this.state.fav ? 6 : 0);
    if (count < 0) count = 0;
    return {
      cats: names.map((n) => {
        const on = picked.indexOf(n) >= 0;
        return {
          name: n,
          on: on ? 'true' : 'false',
          bg: on ? '#FBEFD9' : '#FFFFFF',
          line: on ? '#231C18' : '#E6DED8',
          w: on ? 600 : 400,
          pick: () => this.setState({ cats: on ? picked.filter((x) => x !== n) : picked.concat([n]) })
        };
      }),
      prices: ['不限', '¥15 以下', '¥15–30', '¥30 以上'].map((p) => {
        const on = this.state.price === p;
        return { name: p, on: on ? 'true' : 'false', bg: on ? '#231C18' : '#F4EFEB', fg: on ? '#FFFFFF' : '#231C18', w: on ? 600 : 400, pick: () => this.setState({ price: p }) };
      }),
      good: sw(this.state.good, () => this.setState({ good: !this.state.good })),
      fav: sw(this.state.fav, () => this.setState({ fav: !this.state.fav })),
      count: count,
      reset: () => this.setState({ cats: [], price: '不限', good: false, fav: false })
    };
  }
}


export class ScreenGPanelPlace extends DesignController {
  constructor(props) {
    super(props);
    this.state = { sel: 'auto' };
  }
  renderVals() {
    const sel = this.state.sel;
    const look = (on) => ({
      on: on ? 'true' : 'false',
      bg: on ? '#F4EFEB' : 'transparent',
      w: on ? 700 : 500,
      ring: on ? '#231C18' : '#D9D0C9',
      fill: on ? '#231C18' : 'transparent',
      check: on ? 1 : 0
    });
    const list = [
      { key: 'breakfast', name: '早饭', time: '05:00–10:30' },
      { key: 'lunch', name: '午饭', time: '10:30–14:30' },
      { key: 'dinner', name: '晚饭', time: '14:30–20:30' },
      { key: 'night', name: '夜宵', time: '20:30–05:00' }
    ];
    return {
      auto: Object.assign(look(sel === 'auto'), { pick: () => this.setState({ sel: 'auto' }) }),
      meals: list.map((m) => Object.assign({}, m, look(sel === m.key), { pick: () => this.setState({ sel: m.key }) }))
    };
  }
}


export class ScreenGPanelReport extends DesignController {
  constructor(props) {
    super(props);
    this.state = { sel: 0, note: '', done: false };
  }
  renderVals() {
    const names = ['不是这道菜的实拍', '广告', '违法或不友善', '其他'];
    return {
      reasons: names.map((n, i) => {
        const on = i === this.state.sel;
        return {
          name: n,
          on: on ? 'true' : 'false',
          bg: on ? '#F4EFEB' : 'transparent',
          w: on ? 700 : 400,
          ring: on ? '#231C18' : '#D9D0C9',
          fill: on ? '#231C18' : 'transparent',
          check: on ? 1 : 0,
          pick: () => this.setState({ sel: i })
        };
      }),
      note: this.state.note,
      len: this.state.note.length,
      setNote: (e) => this.setState({ note: e.target.value.slice(0, 200) }),
      editing: !this.state.done,
      done: this.state.done,
      submit: () => this.setState({ done: true })
    };
  }
}


export class ScreenGPanelTag extends DesignController {
  constructor(props) {
    super(props);
    this.state = {
      taste: ['鲜虾大只', '平价'],
      mineAll: ['考试周', '请客'],
      mineOn: ['考试周'],
      writing: false,
      draft: ''
    };
  }
  renderVals() {
    const words = ['鲜虾大只', '平价', '汤鲜', '皮薄', '量大', '排队久', '出餐快', '偏咸', '好下饭', '适合一个人', '分量小', '辣得过瘾'];
    const taste = this.state.taste;
    const mineOn = this.state.mineOn;
    return {
      taste: words.map((w) => {
        const on = taste.indexOf(w) >= 0;
        return {
          name: w,
          on: on ? 'true' : 'false',
          bg: on ? '#FBEFD9' : '#FFFFFF',
          line: on ? '#231C18' : '#E6DED8',
          w: on ? 600 : 400,
          pick: () => this.setState({ taste: on ? taste.filter((x) => x !== w) : taste.concat([w]) })
        };
      }),
      mine: this.state.mineAll.map((w) => {
        const on = mineOn.indexOf(w) >= 0;
        return {
          name: w,
          on: on ? 'true' : 'false',
          bg: on ? '#231C18' : '#F4EFEB',
          fg: on ? '#FFFFFF' : '#231C18',
          w: on ? 600 : 400,
          pick: () => this.setState({ mineOn: on ? mineOn.filter((x) => x !== w) : mineOn.concat([w]) })
        };
      }),
      writing: this.state.writing,
      notWriting: !this.state.writing,
      draft: this.state.draft,
      write: () => this.setState({ writing: true }),
      setDraft: (e) => this.setState({ draft: e.target.value.slice(0, 10) }),
      addMine: () => {
        const d = this.state.draft.trim();
        if (!d || this.state.mineAll.indexOf(d) >= 0) { this.setState({ writing: false, draft: '' }); return; }
        this.setState({ mineAll: this.state.mineAll.concat([d]), mineOn: mineOn.concat([d]), writing: false, draft: '' });
      }
    };
  }
}


export class ScreenGPasswordLogin extends DesignController {
  constructor(props) {
    super(props);
    this.state = { account: 'tianliang', pwd: 'chifan2026', show: false };
  }
  renderVals() {
    const tip = this.props.tip ?? '密码不对';
    const msgs = {
      '密码不对': '账号或密码不对',
      '输错太多次': '密码连续输错 5 次，15 分钟后再试，或者找回密码'
    };
    const msg = msgs[tip] || '';
    const locked = tip === '输错太多次';
    return {
      account: this.state.account,
      pwd: this.state.pwd,
      pwdType: this.state.show ? 'text' : 'password',
      show: this.state.show,
      hide: !this.state.show,
      eyeLabel: this.state.show ? '隐藏密码' : '显示密码',
      msg: msg,
      hasMsg: !!msg,
      invalid: tip === '密码不对' ? 'true' : 'false',
      line: tip === '密码不对' ? '#A8321C' : '#231C18',
      locked: locked,
      canLogin: !locked,
      setAccount: (e) => this.setState({ account: e.target.value }),
      setPwd: (e) => this.setState({ pwd: e.target.value }),
      toggleShow: () => this.setState({ show: !this.state.show })
    };
  }
}


export class ScreenGPhoneLogin extends DesignController {
  constructor(props) {
    super(props);
    this.state = { phone: '138 1234 5678', code: '', sent: false, requested: false, secs: 60, user: 'tianliang', pwd: '', show: false };
    this.timer = null;
  }
  componentWillUnmount() {
    if (this.timer) clearInterval(this.timer);
  }
  renderVals() {
    const sent = this.state.sent;
    const user = this.state.user.trim();
    let userTip = '字母、数字或下划线，用来登录，注册后不能改';
    let userBad = false;
    if (user && !/^[A-Za-z0-9_]{3,10}$/.test(user)) {
      userTip = '用户名是 3–10 位字母、数字或下划线';
      userBad = true;
    } else if (/^\d{11}$/.test(user)) {
      userTip = '用户名不能是 11 位数字，会和手机号混在一起';
      userBad = true;
    }
    const pwdOk = this.state.pwd.length >= 6 && this.state.pwd.length <= 64;
    const ready = this.state.requested && this.state.code.length === 6 && user.length > 0 && !userBad && pwdOk;
    return {
      phone: this.state.phone,
      code: this.state.code,
      sent: sent,
      notSent: !sent,
      secs: this.state.secs,
      user: this.state.user,
      userTip: userTip,
      userBad: userBad ? 'true' : 'false',
      userLine: userBad ? '#A8321C' : '#E6DED8',
      userTipColor: userBad ? '#A8321C' : '#6E625B',
      pwd: this.state.pwd,
      pwdType: this.state.show ? 'text' : 'password',
      show: this.state.show,
      hide: !this.state.show,
      eyeLabel: this.state.show ? '隐藏密码' : '显示密码',
      ready: ready,
      notReady: !ready,
      setPhone: (e) => this.setState({ phone: e.target.value }),
      setCode: (e) => this.setState({ code: e.target.value.replace(/\D/g, '').slice(0, 6) }),
      setUser: (e) => this.setState({ user: e.target.value.slice(0, 10) }),
      setPwd: (e) => this.setState({ pwd: e.target.value.slice(0, 64) }),
      toggleShow: () => this.setState({ show: !this.state.show }),
      send: () => {
        this.setState({ sent: true, requested: true, secs: 60 });
        if (this.timer) clearInterval(this.timer);
        this.timer = setInterval(() => {
          const next = this.state.secs - 1;
          if (next <= 0) {
            clearInterval(this.timer);
            this.timer = null;
            this.setState({ sent: false, secs: 60 });
          } else {
            this.setState({ secs: next });
          }
        }, 1000);
        setTimeout(() => { if (!this.state.code) this.setState({ code: '246810' }); }, 1200);
      }
    };
  }
}


export class ScreenGPhotoPipeline extends DesignController {
  renderVals() {
    return {};
  }
}


export class ScreenGPickShop extends DesignController {
  constructor(props) {
    super(props);
    this.state = { sel: 0 };
  }
  renderVals() {
    const shops = [
      { name: '袁记云饺', dist: '320 m', hub: '万达金街 1 层', tint: '#F8E6C4', img: '../assets/dishes/yuntun.svg' },
      { name: '螺蛳粉研究所', dist: '600 m', hub: '万达金街 B1', tint: '#F3D6CF', img: '../assets/dishes/luosifen.svg' },
      { name: '一点点', dist: '180 m', hub: '万达金街 1 层', tint: '#FBEFC6', img: '../assets/dishes/yangzhi.svg' },
      { name: '香锅小站', dist: '400 m', hub: '银座商城 3 层', tint: '#F6E0DB', img: '../assets/dishes/xiangguo.svg' },
      { name: '小碗菜', dist: '450 m', hub: '银座商城 2 层', tint: '#F6DDD3', img: '../assets/dishes/niunan.svg' }
    ];
    const sel = this.state.sel;
    return {
      chosen: shops[sel].name,
      rows: shops.map((s, i) => {
        const on = i === sel;
        return Object.assign({}, s, {
          on: on ? 'true' : 'false',
          bg: on ? '#F8F3EE' : 'transparent',
          ring: on ? '#231C18' : '#D9D0C9',
          fill: on ? '#231C18' : 'transparent',
          check: on ? 1 : 0,
          pick: () => this.setState({ sel: i })
        });
      })
    };
  }
}


export class ScreenGReconsent extends DesignController {
  renderVals() {
    return {};
  }
}


export class ScreenGRegisterConfirm extends DesignController {
  constructor(props) {
    super(props);
    this.state = { agreed: false };
  }
  renderVals() {
    return {
      agreed: this.state.agreed,
      notAgreed: !this.state.agreed,
      toggle: () => this.setState({ agreed: !this.state.agreed })
    };
  }
}


export class ScreenGSearch extends DesignController {
  constructor(props) {
    super(props);
    const start = props.start ?? '有结果';
    this.state = {
      q: start === '没输入' ? '' : (start === '没找到' ? '黄焖鸡' : '粉'),
      tab: 'dish',
      recent: ['螺蛳粉', '云吞', '麻辣香锅', '东北饭庄', '杨枝甘露', '粥']
    };
  }
  renderVals() {
    const q = this.state.q.trim();
    const hit = q !== '' && q.indexOf('黄焖鸡') < 0;
    const tab = (key) => {
      const on = this.state.tab === key;
      return { on: on, fg: on ? '#231C18' : '#6E625B', size: on ? 17 : 15, w: on ? 900 : 400, pick: () => this.setState({ tab: key }) };
    };
    return {
      q: this.state.q,
      hasQ: q !== '',
      showRecent: q === '',
      showResults: hit,
      showNone: q !== '' && !hit,
      recent: this.state.recent.map((w) => ({ word: w, pick: () => this.setState({ q: w, tab: 'dish' }) })),
      recentEmpty: this.state.recent.length === 0,
      tDish: tab('dish'),
      tShop: tab('shop'),
      setQ: (e) => this.setState({ q: e.target.value }),
      clearQ: () => this.setState({ q: '' }),
      clearRecent: () => this.setState({ recent: [] })
    };
  }
}


export class ScreenGSettings extends DesignController {
  constructor(props) {
    super(props);
    this.state = { asking: false };
  }
  renderVals() {
    return {
      asking: this.state.asking,
      ask: () => this.setState({ asking: true }),
      cancel: () => this.setState({ asking: false })
    };
  }
}


export class ScreenGSettingsAbout extends DesignController {
  renderVals() {
    return {};
  }
}


export class ScreenGSettingsAccount extends DesignController {
  renderVals() {
    return {};
  }
}


export class ScreenGSettingsNotify extends DesignController {
  constructor(props) {
    super(props);
    this.state = { comment: true, like: true, follow: true, system: true };
  }
  renderVals() {
    const sysOff = (this.props.system ?? '系统通知开着') === '系统通知关着';
    const sw = (key) => {
      const on = this.state[key];
      return {
        on: on ? 'true' : 'false',
        track: on ? 'linear-gradient(180deg, #3B312B, #231C18)' : '#E6DED8',
        shadow: on ? 'inset 0 -1px 0 rgba(0,0,0,0.28)' : 'inset 0 1px 2px rgba(35,28,24,0.12)',
        align: on ? 'flex-end' : 'flex-start',
        flip: () => { const next = {}; next[key] = !on; this.setState(next); }
      };
    };
    return {
      sysOff: sysOff,
      listTop: sysOff ? 248 : 182,
      types: [
        Object.assign({ id: 'n-comment', icon: 'comment', label: '评论和回复', sub: '一条一推' }, sw('comment')),
        Object.assign({ id: 'n-like', icon: 'heart', label: '赞和收藏', sub: '同一道菜 1 小时内的合成一条' }, sw('like')),
        Object.assign({ id: 'n-follow', icon: 'follow', label: '关注', sub: '有人关注了你' }, sw('follow')),
        Object.assign({ id: 'n-system', icon: 'announce', label: '系统消息', sub: '认证结果、反馈和举报的处理结果' }, sw('system'))
      ]
    };
  }
}


export class ScreenGSettingsPrivacy extends DesignController {
  constructor(props) {
    super(props);
    this.state = { following: true, fans: true, perso: true };
  }
  renderVals() {
    const sw = (key) => {
      const on = this.state[key];
      return {
        on: on ? 'true' : 'false',
        track: on ? 'linear-gradient(180deg, #3B312B, #231C18)' : '#E6DED8',
        shadow: on ? 'inset 0 -1px 0 rgba(0,0,0,0.28)' : 'inset 0 1px 2px rgba(35,28,24,0.12)',
        align: on ? 'flex-end' : 'flex-start',
        flip: () => { const next = {}; next[key] = !on; this.setState(next); }
      };
    };
    return {
      lists: [
        Object.assign({ id: 'pub-following', label: '公开我的关注列表', sub: '关掉后别人点开，看到的是「对方没有公开」' }, sw('following')),
        Object.assign({ id: 'pub-fans', label: '公开我的粉丝列表', sub: '关掉后别人点开，看到的是「对方没有公开」' }, sw('fans'))
      ],
      perso: sw('perso')
    };
  }
}


export class ScreenGTagDishes extends DesignController {
  renderVals() {
    return {};
  }
}


export class ScreenGTopic extends DesignController {
  renderVals() {
    return {};
  }
}


export class ScreenGTopicArchive extends DesignController {
  renderVals() {
    const luosi = '../assets/photos/sq_luosi.png';
    const tieguo = '../assets/photos/sq_tieguo.png';
    const niandou = '../assets/photos/sq_niandou.png';
    const hongshao = '../assets/photos/sq_hongshao.png';
    const paigu = '../assets/photos/sq_paigu.png';
    return {
      topics: [
        { name: '降温了喝碗汤', range: '10 月 13 日–10 月 19 日', a: paigu, b: tieguo, c: luosi },
        { name: '国庆留校不孤单', range: '9 月 29 日–10 月 7 日', a: hongshao, b: niandou, c: paigu },
        { name: '一个人也要好好吃', range: '9 月 22 日–9 月 28 日', a: luosi, b: hongshao, c: niandou },
        { name: '军训后的那顿饭', range: '9 月 15 日–9 月 21 日', a: tieguo, b: paigu, c: hongshao },
        { name: '开学第一顿', range: '9 月 1 日–9 月 7 日', a: niandou, b: luosi, c: tieguo }
      ]
    };
  }
}


export class ScreenGUserProfile extends DesignController {
  constructor(props) {
    super(props);
    this.state = { following: false, menu: true };
  }
  renderVals() {
    return {
      following: this.state.following,
      notFollowing: !this.state.following,
      menuOpen: this.state.menu,
      flip: () => this.setState({ following: !this.state.following }),
      toggleMenu: () => this.setState({ menu: !this.state.menu })
    };
  }
}


export class ScreenGVerify extends DesignController {
  constructor(props) {
    super(props);
    this.state = { email: '202100301234@mail.sdu.edu.cn', sent: false, done: false };
  }
  renderVals() {
    const fromSettings = (this.props.from ?? '注册后') === '设置里';
    const verified = this.state.done || (this.props.status ?? '未认证') === '已认证';
    return {
      fromSettings: fromSettings,
      fromRegister: !fromSettings,
      verified: verified,
      unverified: !verified,
      sent: this.state.sent,
      notSent: !this.state.sent,
      email: this.state.email,
      setEmail: (e) => this.setState({ email: e.target.value }),
      send: () => this.setState({ sent: true }),
      done: () => this.setState({ done: true })
    };
  }
}


export class ScreenGWriteComment extends DesignController {
  constructor(props) {
    super(props);
    const reply = (props.mode ?? '写评论') === '回复';
    this.state = { text: reply ? '' : '中辣刚好，酸笋很足。加了一份炸蛋，泡在汤里吸满了味道。', photo: true };
  }
  renderVals() {
    const reply = (this.props.mode ?? '写评论') === '回复';
    const hasPhoto = !reply && this.state.photo;
    const can = this.state.text.trim().length > 0 || hasPhoto;
    return {
      title: reply ? '回复' : '写一条',
      hint: reply ? '回复 小林' : '吃过的话，说两句',
      isReply: reply,
      isComment: !reply,
      text: this.state.text,
      len: this.state.text.length,
      hasPhoto: hasPhoto,
      count: hasPhoto ? 1 : 0,
      canSend: can,
      cannotSend: !can,
      setText: (e) => this.setState({ text: e.target.value.slice(0, 200) }),
      addPhoto: () => this.setState({ photo: true }),
      removePhoto: () => this.setState({ photo: false })
    };
  }
}


export class ScreenGWrongInfo extends DesignController {
  constructor(props) {
    super(props);
    this.state = { sel: 1, note: '', done: false };
  }
  renderVals() {
    const names = ['店名不对', '位置不对', '已经关门了', '和别的店重复', '其他'];
    return {
      reasons: names.map((n, i) => {
        const on = i === this.state.sel;
        return {
          name: n,
          on: on ? 'true' : 'false',
          bg: on ? '#F4EFEB' : 'transparent',
          w: on ? 700 : 400,
          ring: on ? '#231C18' : '#D9D0C9',
          fill: on ? '#231C18' : 'transparent',
          check: on ? 1 : 0,
          pick: () => this.setState({ sel: i })
        };
      }),
      note: this.state.note,
      len: this.state.note.length,
      setNote: (e) => this.setState({ note: e.target.value.slice(0, 200) }),
      editing: !this.state.done,
      done: this.state.done,
      submit: () => this.setState({ done: true })
    };
  }
}


export class ScreenG2Home extends DesignController {
  constructor(props) {
    super(props);
    this.state = { n: 0, drag: 0, dragging: false };
    this.startX = 0;
  }
  renderVals() {
    const ink = '#231C18';
    const light = { on: ink, ghost: 'rgba(255,255,255,0.42)', table: 'rgba(255,255,255,0.22)', ring: 'rgba(255,255,255,0.55)', solidShadow: 'inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -2px 0 rgba(0,0,0,0.28), 0 1px 2px rgba(35,28,24,0.2), 0 6px 14px rgba(35,28,24,0.16)' };
    const dark = { on: '#FFFFFF', ghost: 'rgba(255,255,255,0.18)', table: 'rgba(255,255,255,0.08)', ring: 'rgba(255,255,255,0.24)', solidShadow: 'inset 0 -2px 0 rgba(0,0,0,0.16), 0 2px 4px rgba(0,0,0,0.18), 0 8px 18px rgba(0,0,0,0.16)' };
    const dishes = [
      Object.assign({ l1: '鲜虾蟹籽', l2: '云吞', shop: '袁记云饺', dist: '320 m', price: '18', stage: '#F3C46E' }, light),
      Object.assign({ l1: '番茄', l2: '牛腩饭', shop: '小碗菜', dist: '450 m', price: '22', stage: '#C9442B' }, dark),
      Object.assign({ l1: '杨枝甘露', l2: '', shop: '一点点', dist: '180 m', price: '15', stage: '#FFCB45' }, light),
      Object.assign({ l1: '柳州', l2: '螺蛳粉', shop: '螺蛳粉研究所', dist: '600 m', price: '16', stage: '#A8321C' }, dark),
      Object.assign({ l1: '铁锅炖', l2: '大鹅', shop: '东北饭庄', dist: '750 m', price: '58', stage: '#8F5B24' }, dark),
      Object.assign({ l1: '麻辣香锅', l2: '', shop: '香锅小站', dist: '400 m', price: '32', stage: '#D9632B' }, light),
      Object.assign({ l1: '粘豆包', l2: '', shop: '老街点心', dist: '260 m', price: '8', stage: '#D8B27A' }, light),
      Object.assign({ l1: '玉米鲜肉', l2: '饺子', shop: '袁记云饺', dist: '320 m', price: '16', stage: '#9DB8D9' }, light)
    ];
    const N = dishes.length;
    const STEP = 55;
    const RADIUS = 430;
    const n = this.state.n;
    const k = ((n % N) + N) % N;
    const plate = (i) => {
      let d = (((i - n) % N) + N) % N;
      if (d > N / 2) d -= N;
      const theta = d * STEP + this.state.drag;
      const a = Math.min(1, Math.abs(theta) / STEP);
      const scale = 1 - 0.15 * a;
      return {
        t: 'rotate(' + theta.toFixed(2) + 'deg) translateY(-' + RADIUS + 'px) scale(' + scale.toFixed(3) + ')',
        o: Math.abs(d) >= 2 ? 0 : 1
      };
    };
    const dots = dishes.map((_, i) => ({ w: i === k ? 16 : 5, o: i === k ? 1 : 0.4 }));
    return {
      s: dishes[k],
      p0: plate(0), p1: plate(1), p2: plate(2), p3: plate(3),
      p4: plate(4), p5: plate(5), p6: plate(6), p7: plate(7),
      dots: dots,
      tr: this.state.dragging ? 'none' : 'transform 680ms cubic-bezier(0.2, 0.9, 0.25, 1.1), opacity 280ms ease',
      next: () => this.setState({ n: this.state.n + 1, drag: 0, dragging: false }),
      down: (e) => {
        this.startX = e.clientX;
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
        this.setState({ dragging: true, drag: 0 });
      },
      move: (e) => {
        if (!this.state.dragging) return;
        const deg = (e.clientX - this.startX) / 7.5;
        this.setState({ drag: Math.max(-STEP * 1.1, Math.min(STEP * 1.1, deg)) });
      },
      up: () => {
        if (!this.state.dragging) return;
        const drag = this.state.drag;
        let steps = 0;
        if (drag < -4) steps = 1;
        if (drag > 4) steps = -1;
        this.setState({ n: this.state.n + steps, drag: 0, dragging: false });
      }
    };
  }
}

export const controllers={"G-AddDish":ScreenGAddDish,"G-Blocked":ScreenGBlocked,"G-ChangePassword":ScreenGChangePassword,"G-ChangePhone":ScreenGChangePhone,"G-Comments":ScreenGComments,"G-Crop":ScreenGCrop,"G-DataNotice":ScreenGDataNotice,"G-DeleteAccount":ScreenGDeleteAccount,"G-Detail":ScreenGDetail,"G-Devices":ScreenGDevices,"G-Dish":ScreenGDish,"G-EditProfile":ScreenGEditProfile,"G-Feedback":ScreenGFeedback,"G-Follows":ScreenGFollows,"G-ForgotPassword":ScreenGForgotPassword,"G-History":ScreenGHistory,"G-HomePhoto":ScreenGHomePhoto,"G-Icon":ScreenGIcon,"G-Icons":ScreenGIcons,"G-Inbox":ScreenGInbox,"G-Kit":ScreenGKit,"G-Login":ScreenGLogin,"G-Me":ScreenGMe,"G-MyTags":ScreenGMyTags,"G-Nav":ScreenGNav,"G-Nearby":ScreenGNearby,"G-NewShop":ScreenGNewShop,"G-PanelFilter":ScreenGPanelFilter,"G-PanelPlace":ScreenGPanelPlace,"G-PanelReport":ScreenGPanelReport,"G-PanelTag":ScreenGPanelTag,"G-PasswordLogin":ScreenGPasswordLogin,"G-PhoneLogin":ScreenGPhoneLogin,"G-PhotoPipeline":ScreenGPhotoPipeline,"G-PickShop":ScreenGPickShop,"G-Reconsent":ScreenGReconsent,"G-RegisterConfirm":ScreenGRegisterConfirm,"G-Search":ScreenGSearch,"G-Settings":ScreenGSettings,"G-SettingsAbout":ScreenGSettingsAbout,"G-SettingsAccount":ScreenGSettingsAccount,"G-SettingsNotify":ScreenGSettingsNotify,"G-SettingsPrivacy":ScreenGSettingsPrivacy,"G-TagDishes":ScreenGTagDishes,"G-Topic":ScreenGTopic,"G-TopicArchive":ScreenGTopicArchive,"G-UserProfile":ScreenGUserProfile,"G-Verify":ScreenGVerify,"G-WriteComment":ScreenGWriteComment,"G-WrongInfo":ScreenGWrongInfo,"G2-Home":ScreenG2Home};
