const firebaseConfig = {
	apiKey: 'AIzaSyBf5G5URD6rMkk9SlM7s1Nd7JlhQKAhzzQ',
	authDomain: 'task-table-d5b0b.firebaseapp.com',
	projectId: 'task-table-d5b0b',
	storageBucket: 'task-table-d5b0b.firebasestorage.app',
	messagingSenderId: '286009015777',
	appId: '1:286009015777:web:2277f6daa5c9a70a70a6a0',
}
firebase.initializeApp(firebaseConfig)
const db = firebase.firestore()
const boardRef = db.collection('stena-del').doc('board')

;(function () {
	'use strict'

	/* ============ utils ============ */
	const $ = (s, r = document) => r.querySelector(s)
	const $$ = (s, r = document) => [...r.querySelectorAll(s)]
	const KEY = 'stena-del-v1'
	const URGENT = /срочн|важн|горит/i
	const reduced =
		window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches
	const rnd = (a, b) => a + Math.random() * (b - a)
	const pick = a => a[Math.floor(Math.random() * a.length)]
	const uid = () =>
		Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
	const isUrgent = n => (n.tags.some(t => URGENT.test(t)) ? 1 : 0)

	function h(tag, props, ...kids) {
		const el = document.createElement(tag)
		if (props)
			for (const [k, v] of Object.entries(props)) {
				if (v == null || v === false) continue
				if (k === 'class') el.className = v
				else if (k === 'style') el.style.cssText = v
				else if (k.startsWith('on')) el.addEventListener(k.slice(2), v)
				else el.setAttribute(k, v === true ? '' : v)
			}
		for (const kid of kids.flat()) {
			if (kid == null || kid === false) continue
			el.append(kid.nodeType ? kid : document.createTextNode(kid))
		}
		return el
	}
	function plural(n, f) {
		const a = Math.abs(n) % 100,
			b = a % 10
		if (a > 10 && a < 20) return f[2]
		if (b > 1 && b < 5) return f[1]
		if (b === 1) return f[0]
		return f[2]
	}
	function fmtDate(ts) {
		const d = new Date(ts),
			o = { day: 'numeric', month: 'short' }
		if (d.getFullYear() !== new Date().getFullYear()) o.year = 'numeric'
		return d.toLocaleDateString('ru-RU', o).replace(/\s?г\.$/, '')
	}
	function normTag(s) {
		return String(s)
			.replace(/^#+/, '')
			.replace(/\s+/g, ' ')
			.trim()
			.toLowerCase()
			.slice(0, 24)
	}
	function hash(s) {
		let x = 0
		for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) >>> 0
		return x
	}
	function tornClip(id, folds) {
		folds = folds || {}
		const j = (seed, amp) => ((hash(seed + id) % 1000) / 1000 - 0.5) * 2 * amp
		const pt = (x, y) =>
			(typeof x === 'number' ? x.toFixed(2) + '%' : x) +
			' ' +
			(typeof y === 'number' ? y.toFixed(2) + '%' : y)
		const px = n => n + 'px',
			fromEnd = n => `calc(100% - ${n}px)`
		const pts = []
		// угол с загибом заменяется срезом по диагонали; порядок точек — по часовой стрелке
		const corner = (name, normal, cut) => {
			const f = folds[name]
			;(f ? cut(f) : [normal]).forEach(p => pts.push(p))
		}
		;[0, 18, 36, 54, 72, 88, 100].forEach((x, i) => {
			const y = Math.max(0, 1.6 + j('t' + i, 1.6))
			if (i === 0) corner('tl', pt(x, y), f => [pt(0, px(f)), pt(px(f), 0)])
			else if (i === 6)
				corner('tr', pt(x, y), f => [pt(fromEnd(f), 0), pt('100%', px(f))])
			else pts.push(pt(x, y))
		})
		;[14, 32, 50, 68, 86].forEach((y, i) =>
			pts.push(pt(Math.min(100, 98.4 - j('r' + i, 1.6)), y)),
		)
		;[100, 82, 64, 46, 28, 12, 0].forEach((x, i) => {
			const y = Math.min(100, 98.4 - j('b' + i, 1.6))
			if (i === 0)
				corner('br', pt(x, y), f => [
					pt('100%', fromEnd(f)),
					pt(fromEnd(f), '100%'),
				])
			else if (i === 6)
				corner('bl', pt(x, y), f => [pt(px(f), '100%'), pt(0, fromEnd(f))])
			else pts.push(pt(x, y))
		})
		;[86, 68, 50, 32, 14].forEach((y, i) =>
			pts.push(pt(Math.max(0, 1.6 + j('l' + i, 1.6)), y)),
		)
		return 'polygon(' + pts.join(',') + ')'
	}

	/* потёртости стикера: 1–2 загнутых уголка и иногда пара дырочек.
   Зависят только от id заметки, поэтому не «прыгают» при перерисовке. */
	function rng(seed) {
		let a = hash(seed) || 1
		return () => {
			a = (a + 0x6d2b79f5) | 0
			let t = Math.imul(a ^ (a >>> 15), 1 | a)
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296
		}
	}
	function wear(id, pinx) {
		const r = rng(id + ':wear')
		const corners = ['tl', 'tr', 'br', 'bl']
		for (let i = corners.length - 1; i > 0; i--) {
			const k = Math.floor(r() * (i + 1))
			;[corners[i], corners[k]] = [corners[k], corners[i]]
		}
		const folds = corners
			.slice(0, r() < 0.5 ? 1 : 2)
			.map(c => ({ c, f: Math.round(20 + r() * 7) }))
		const q = r(),
			nh = q < 0.4 ? 0 : q < 0.75 ? 1 : 2
		const edges = ['l', 'r', 't', 'b']
		for (let i = edges.length - 1; i > 0; i--) {
			const k = Math.floor(r() * (i + 1))
			;[edges[i], edges[k]] = [edges[k], edges[i]]
		}
		const holes = edges.slice(0, nh).map(e => {
			const w = Math.round(6 + r() * 2),
				rot = Math.round((r() - 0.5) * 24)
			let left, top
			if (e === 'l' || e === 'r') {
				const inset = Math.round(11 + r())
				left = e === 'l' ? inset + 'px' : `calc(100% - ${inset}px)`
				top = (26 + r() * 46).toFixed(1) + '%'
			} else {
				// по горизонтали обходим кнопку-гвоздик и углы с загибами
				const lo = 13,
					hi = 87,
					gl = pinx - 15,
					gr = pinx + 15
				const spans = [
					[lo, gl],
					[gr, hi],
				].filter(([a, b]) => b - a > 4)
				const [a, b] = spans[Math.floor(r() * spans.length)] || [lo, hi]
				left = (a + r() * (b - a)).toFixed(1) + '%'
				top = e === 't' ? '15px' : 'calc(100% - 10px)'
			}
			return { left, top, w, h: Math.round(w * 0.62), rot }
		})
		return { folds, holes }
	}
	function tagFg(hex) {
		const r = parseInt(hex.slice(1, 3), 16),
			g = parseInt(hex.slice(3, 5), 16),
			b = parseInt(hex.slice(5, 7), 16)
		const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
		return lum > 0.6 ? '#20222b' : '#fff'
	}
	function tagStyle(t) {
		const custom = state.data.tagColors && state.data.tagColors[t]
		if (custom) return `--tg-bg:${custom};--tg-fg:${tagFg(custom)}`
		if (URGENT.test(t)) return '--tg-bg:hsl(2 78% 82%);--tg-fg:hsl(2 62% 28%)'
		const hue = hash(t) % 360
		return `--tg-bg:hsl(${hue} 60% 84%);--tg-fg:hsl(${hue} 50% 26%)`
	}

	/* ============ кнопки-гвоздики (SVG-спрайт), круглый пуш-пин ============ */
	// цвета: [светлый, основной, тёмный]; 0 — красный, только для «срочно»
	const PINS = [
		['#ff9a8a', '#e2402c', '#9d1a0c'],
		['#9cc0ff', '#3b6fe0', '#1b3f9a'],
		['#9fe6ae', '#2fa04e', '#17652f'],
		['#ffe58a', '#f0b81c', '#a87a06'],
		['#d3b0ff', '#8c4fdc', '#522191'],
		['#ffc28a', '#ee7d1b', '#a04a06'],
		['#96ece6', '#23a8a0', '#106762'],
		['#ffb3d1', '#e04a8d', '#9b1f57'],
	]
	function setPinSprite() {
		let defs =
			`<linearGradient id='steel' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#8b9299'/><stop offset='.4' stop-color='#f5f7f8'/><stop offset='1' stop-color='#7b828a'/></linearGradient>` +
			`<radialGradient id='shd'><stop offset='0' stop-color='#000' stop-opacity='.35'/><stop offset='1' stop-color='#000' stop-opacity='0'/></radialGradient>`
		let sym = ''
		PINS.forEach(([hi, mid, lo], k) => {
			defs += `<radialGradient id='pc${k}' cx='.32' cy='.28' r='.9'><stop offset='0' stop-color='${hi}'/><stop offset='.55' stop-color='${mid}'/><stop offset='1' stop-color='${lo}'/></radialGradient>`
			sym +=
				`<symbol id='pin${k}' viewBox='0 0 44 58'>` +
				`<ellipse cx='22' cy='55' rx='9' ry='2.2' fill='url(#shd)'/>` +
				`<path d='M20.3 29H23.7L22.7 54.3H21.3Z' fill='url(#steel)'/>` +
				`<rect x='18' y='23' width='8' height='9' rx='3' fill='url(#steel)'/>` +
				`<circle cx='22' cy='14.5' r='14.5' fill='url(#pc${k})'/>` +
				`<path d='M22 27.5a14.5 14.5 0 0 1-13-8 14.5 14.5 0 0 0 26 0 14.5 14.5 0 0 1-13 8Z' fill='#000' fill-opacity='.14'/>` +
				`<ellipse cx='16.5' cy='8.7' rx='6.6' ry='4.8' fill='#fff' fill-opacity='.4'/>` +
				`</symbol>`
		})
		document.body.insertAdjacentHTML(
			'afterbegin',
			`<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden"><defs>${defs}</defs>${sym}</svg>`,
		)
	}

	/* ============ state + storage ============ */
	function randomStyle() {
		return {
			tint: Math.floor(rnd(0, 5)),
			rot: +rnd(-3.4, 3.4).toFixed(2),
			dy: Math.round(rnd(-6, 6)),
			pin: Math.floor(rnd(1, 4)),
			pinx: Math.round(rnd(32, 64)),
		}
	}
	function cleanStyle(s) {
		const d = randomStyle()
		if (!s || typeof s !== 'object') return d
		const num = (v, a, b, def) =>
			Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : def
		return {
			tint: Math.round(num(s.tint, 0, 4, d.tint)),
			rot: num(s.rot, -6, 6, d.rot),
			dy: num(s.dy, -10, 10, d.dy),
			pin: Math.round(num(s.pin, 1, 3, d.pin)),
			pinx: num(s.pinx, 22, 78, d.pinx),
		}
	}
	function cleanNote(x) {
		if (!x || typeof x.text !== 'string' || !x.text.trim()) return null
		const tags = Array.isArray(x.tags)
			? [...new Set(x.tags.map(normTag).filter(Boolean))].slice(0, 8)
			: []
		return {
			id: String(x.id || uid()),
			text: x.text.trim().slice(0, 600),
			tags,
			created: Number.isFinite(x.created) ? x.created : Date.now(),
			archivedAt: Number.isFinite(x.archivedAt) ? x.archivedAt : null,
			style: cleanStyle(x.style),
		}
	}
	const state = {
		data: { notes: [], extraTags: [], tagColors: {}, seeded: false },
		route: 'board',
		filter: [],
		q: '',
		sort: 'new',
		tagEditing: null,
		confirm: null,
		justAdded: null,
		storageOk: true,
		dataMsg: '',
		exportText: '',
		archiveView: (() => {
			try {
				return localStorage.getItem('stena-del-archive-view') === 'full'
					? 'full'
					: 'mini'
			} catch (e) {
				return 'mini'
			}
		})(),
	}
	let fbFirstLoad = true
	function startSync() {
		boardRef.onSnapshot(
			docSnap => {
				const d = docSnap.data()
				if (d && Array.isArray(d.notes)) {
					state.data = {
						notes: d.notes.map(cleanNote).filter(Boolean),
						extraTags: Array.isArray(d.extraTags)
							? [...new Set(d.extraTags.map(normTag).filter(Boolean))].slice(
									0,
									200,
								)
							: [],
						tagColors:
							d.tagColors && typeof d.tagColors === 'object' ? d.tagColors : {},
						seeded: true,
					}
				}
				state.storageOk = true
				if (fbFirstLoad) {
					fbFirstLoad = false
					if (!state.data.seeded) seed()
					state.route = parseRoute()
					renderAll()
				} else {
					renderAll()
				}
			},
			err => {
				console.error('Firestore sync error:', err)
				state.storageOk = false
				if (fbFirstLoad) {
					fbFirstLoad = false
					state.route = parseRoute()
					renderAll()
				}
			},
		)
	}
	function save() {
		boardRef.set(state.data).then(
			() => {
				state.storageOk = true
			},
			err => {
				console.error('Firestore save error:', err)
				state.storageOk = false
				renderHead()
			},
		)
	}
	function seed() {
		const now = Date.now(),
			H = 3600e3
		const s = [
			[
				'Нажми на кнопку сверху: заметка открепится и уйдёт в архив.',
				['как пользоваться'],
			],
			[
				'Кликни по тексту, чтобы изменить заметку или удалить её насовсем.',
				['как пользоваться'],
			],
			[
				'Теги внизу: жми на тег, чтобы отфильтровать доску. «Срочно» краснеет и всплывает наверх.',
				['срочно', 'как пользоваться'],
			],
			['Новую заметку приклеивает плюс после последней.', ['как пользоваться']],
		]
		state.data.notes = s.map(([text, tags], i) =>
			cleanNote({ text, tags, created: now - i * H, archivedAt: null }),
		)
		state.data.seeded = true
		save()
	}
	const find = id => state.data.notes.find(n => n.id === id)
	const notesFor = r =>
		state.data.notes.filter(n => (r === 'archive') === !!n.archivedAt)

	/* ============ actions ============ */
	let toastT
	function toast(msg, action) {
		const t = $('#toast')
		t.replaceChildren(
			h('span', null, msg),
			action &&
				h(
					'button',
					{
						type: 'button',
						onclick: () => {
							hideToast()
							action.fn()
						},
					},
					action.label,
				),
		)
		t.classList.add('show')
		clearTimeout(toastT)
		toastT = setTimeout(hideToast, 5500)
	}
	function hideToast() {
		$('#toast').classList.remove('show')
	}

	function addNote(text, tags) {
		const n = cleanNote({ text, tags })
		state.data.notes.unshift(n)
		state.justAdded = n.id
		save()
		renderAll()
	}
	function updateNote(id, patch) {
		const n = find(id)
		if (!n) return
		Object.assign(n, patch)
		save()
		renderAll()
	}
	function deleteNote(id) {
		state.data.notes = state.data.notes.filter(n => n.id !== id)
		save()
		renderAll()
	}
	function archiveNote(id) {
		updateNote(id, { archivedAt: Date.now() })
		toast('Заметка ушла в архив', {
			label: 'Вернуть',
			fn: () => restoreNote(id),
		})
	}
	function restoreNote(id) {
		updateNote(id, { archivedAt: null })
	}
	function unpin(id, el) {
		if (el.classList.contains('falling')) return
		if (reduced) {
			archiveNote(id)
			return
		}
		el.classList.add('falling')
		setTimeout(() => archiveNote(id), 420)
	}
	function addTag(id, t) {
		const n = find(id)
		if (!n || n.tags.includes(t) || n.tags.length >= 8) {
			state.tagEditing = null
			renderView()
			return
		}
		state.tagEditing = null
		updateNote(id, { tags: [...n.tags, t] })
	}
	function toggleFilter(t) {
		state.filter = state.filter.includes(t)
			? state.filter.filter(x => x !== t)
			: [...state.filter, t]
		renderHead()
		renderView()
	}
	let confirmT
	function confirmBtn(key, label, onOk, cls = 'btn-mini danger') {
		const armed = state.confirm === key
		return h(
			'button',
			{
				class: cls,
				type: 'button',
				onclick: () => {
					if (armed) {
						state.confirm = null
						onOk()
						return
					}
					state.confirm = key
					renderView()
					clearTimeout(confirmT)
					confirmT = setTimeout(() => {
						if (state.confirm === key) {
							state.confirm = null
							renderView()
						}
					}, 3500)
				},
			},
			armed ? 'Точно удалить?' : label,
		)
	}

	/* ============ filtering ============ */
	function visible() {
		const arch = state.route === 'archive'
		let list = notesFor(state.route)
		if (state.filter.length)
			list = list.filter(n => state.filter.every(t => n.tags.includes(t)))
		const q = state.q.trim().toLowerCase()
		if (q)
			list = list.filter(
				n =>
					n.text.toLowerCase().includes(q) || n.tags.some(t => t.includes(q)),
			)
		const key = n => (arch ? n.archivedAt || n.created : n.created)
		const cmp = {
			new: (a, b) => key(b) - key(a),
			old: (a, b) => key(a) - key(b),
			urgent: (a, b) => isUrgent(b) - isUrgent(a) || key(b) - key(a),
		}[state.sort]
		return list.sort(cmp)
	}

	/* ============ render ============ */
	const NAV = [
		{ id: 'board', label: 'Доска' },
		{ id: 'archive', label: 'Архив' },
		{ id: 'tags', label: 'Теги' },
	]
	function renderNav() {
		const nb = notesFor('board').length,
			na = notesFor('archive').length
		$('#nav').replaceChildren(
			...NAV.map(n =>
				h(
					'li',
					{ class: state.route === n.id ? 'cur' : null },
					h(
						'a',
						{
							href: '#' + n.id,
							'aria-current': state.route === n.id ? 'page' : null,
						},
						n.label,
						h(
							'span',
							{ class: 'count' },
							n.id === 'board' && nb
								? String(nb)
								: n.id === 'archive' && na
									? String(na)
									: '',
						),
					),
				),
			),
		)
	}
	function renderMeta() {
		const r = state.route,
			meta = $('#meta')
		if (r === 'board' || r === 'archive') {
			const total = notesFor(r).length,
				shown = visible().length
			const word = plural(total, ['заметка', 'заметки', 'заметок'])
			if (state.filter.length || state.q.trim())
				meta.textContent = `Показано ${shown} из ${total}`
			else
				meta.textContent =
					r === 'board'
						? `На доске ${total} ${word}`
						: `В архиве ${total} ${word}`
		} else if (r === 'tags')
			meta.textContent = 'Все теги, которые вы использовали'
		else meta.textContent = 'Копия заметок и восстановление'
	}
	function renderHead() {
		const r = state.route,
			list = r === 'board' || r === 'archive'
		$('#title').textContent = NAV.find(n => n.id === r).label
		$('#tools').hidden = !list
		$('#viewSeg').hidden = r !== 'archive'
		$$('#viewSeg button').forEach(b =>
			b.setAttribute('aria-pressed', String(b.dataset.v === state.archiveView)),
		)
		$('#warn').hidden = state.storageOk
		renderMeta()
		const box = $('#chips')
		box.replaceChildren()
		if (!list) {
			box.hidden = true
			return
		}
		const counts = new Map()
		notesFor(r).forEach(n =>
			n.tags.forEach(t => counts.set(t, (counts.get(t) || 0) + 1)),
		)
		state.filter.forEach(t => {
			if (!counts.has(t)) counts.set(t, 0)
		})
		if (!counts.size) {
			box.hidden = true
			return
		}
		box.hidden = false
		const tags = [...counts]
			.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ru'))
			.map(x => x[0])
		const none = !state.filter.length
		box.append(
			h(
				'button',
				{
					class: 'chip' + (none ? ' on' : ''),
					type: 'button',
					'aria-pressed': String(none),
					onclick: () => {
						state.filter = []
						renderHead()
						renderView()
					},
				},
				'Все',
			),
		)
		tags.forEach(t => {
			const on = state.filter.includes(t)
			box.append(
				h(
					'button',
					{
						class: 'chip' + (on ? ' on' : ''),
						type: 'button',
						'aria-pressed': String(on),
						onclick: () => toggleFilter(t),
					},
					t,
				),
			)
		})
	}

	function tagsRow(n, archived) {
		const row = h('div', { class: 'tags' })
		n.tags.forEach(t =>
			row.append(
				h(
					'button',
					{
						class: 'tag' + (state.filter.includes(t) ? ' on' : ''),
						type: 'button',
						style: tagStyle(t),
						title: 'Показать заметки с этим тегом',
						onclick: () => toggleFilter(t),
					},
					t,
				),
			),
		)
		if (!archived) {
			if (state.tagEditing === n.id) {
				let done = false
				const inp = h('input', {
					class: 'tag-input',
					type: 'text',
					maxlength: '24',
					'aria-label': 'Новый тег',
					placeholder: 'тег',
				})
				const commit = () => {
					if (done) return
					done = true
					const t = normTag(inp.value)
					if (t) addTag(n.id, t)
					else {
						state.tagEditing = null
						renderView()
					}
				}
				inp.addEventListener('keydown', e => {
					if (e.key === 'Enter' || e.key === ',') {
						e.preventDefault()
						commit()
					} else if (e.key === 'Escape') {
						done = true
						state.tagEditing = null
						renderView()
					}
				})
				inp.addEventListener('blur', commit)
				row.append(inp)
			} else if (n.tags.length < 8) {
				row.append(
					h(
						'button',
						{
							class: 'tag tag-add',
							type: 'button',
							'aria-label': 'Добавить тег',
							onclick: () => {
								state.tagEditing = n.id
								renderView()
							},
						},
						'+ тег',
					),
				)
			}
		}
		return row
	}

	function noteCard(n, archived, mini) {
		const s = n.style
		const wr = wear(n.id, s.pinx)
		const foldMap = {}
		wr.folds.forEach(f => {
			foldMap[f.c] = f.f
		})
		const pinK = isUrgent(n) ? 0 : 1 + (hash(n.id + 'p') % (PINS.length - 1))
		const tilt = (hash(n.id + 't') % 25) - 12
		const wrap = h('article', {
			class:
				'note-wrap' +
				(state.justAdded === n.id ? ' just-added' : '') +
				(archived ? ' is-archived' : '') +
				(archived && mini ? ' is-mini' : ''),
		})
		wrap.style.setProperty('--rot', s.rot + 'deg')
		wrap.style.setProperty('--dy', s.dy + 'px')
		wrap.style.setProperty('--pinx', s.pinx + '%')
		wrap.style.setProperty('--tint', `var(--t${s.tint})`)
		if (archived)
			wrap.append(h('span', { class: 'pin-hole', 'aria-hidden': 'true' }))
		else {
			const pb = h('button', {
				class: 'pin',
				type: 'button',
				title: 'Открепить и убрать в архив',
				'aria-label': 'Открепить и убрать в архив',
				onclick: () => unpin(n.id, wrap),
			})
			pb.style.setProperty('--tilt', tilt + 'deg')
			pb.innerHTML = `<svg viewBox="0 0 44 58" aria-hidden="true"><use href="#pin${pinK}" width="44" height="58"/></svg>`
			wrap.append(pb)
		}
		wrap.append(
			h(
				'div',
				{
					class: 'note' + wr.folds.map(o => ' wf-' + o.c).join(''),
					style: 'clip-path:' + tornClip(n.id, foldMap),
				},
				h(
					'div',
					{ class: 'note-top' },
					archived && h('span', null, 'в архиве с ' + fmtDate(n.archivedAt)),
					h(
						'time',
						{ datetime: new Date(n.created).toISOString() },
						fmtDate(n.created),
					),
				),
				archived
					? h(
							'div',
							{
								class: 'desc desc-static',
								title: 'В архиве — только просмотр',
							},
							h('span', { class: 'desc-text' }, n.text),
						)
					: h(
							'button',
							{
								class: 'desc',
								type: 'button',
								title: 'Изменить заметку',
								onclick: () => openEditor(n.id),
							},
							h('span', { class: 'desc-text' }, n.text),
						),
				tagsRow(n, archived),
				archived &&
					h(
						'div',
						{ class: 'arch-actions' },
						h(
							'button',
							{
								class: 'btn-mini',
								type: 'button',
								onclick: () => restoreNote(n.id),
							},
							'Вернуть на доску',
						),
						confirmBtn('del:' + n.id, 'Удалить', () => deleteNote(n.id)),
					),
				wr.holes.map(o =>
					h('span', {
						class: 'punch',
						'aria-hidden': 'true',
						style: `left:${o.left};top:${o.top};width:${o.w}px;height:${o.h}px;transform:translate(-50%,-50%) rotate(${o.rot}deg)`,
					}),
				),
				wr.folds.map(o =>
					h(
						'span',
						{
							class: 'fold fold-' + o.c,
							'aria-hidden': 'true',
							style: `--f:${o.f}px`,
						},
						h('i'),
					),
				),
			),
		)
		return wrap
	}

	function renderList(view, archived) {
		const list = visible(),
			all = notesFor(state.route)
		if (!all.length) {
			view.append(
				h(
					'p',
					{ class: 'hint' },
					archived
						? 'Архив пуст. Сюда попадают заметки, которые вы открепили.'
						: 'Доска пуста. Нажмите на плюс и приклейте первую заметку.',
				),
			)
		} else if (!list.length) {
			view.append(
				h(
					'p',
					{ class: 'hint' },
					'Ничего не найдено. ',
					h(
						'button',
						{
							class: 'btn-mini',
							type: 'button',
							style: 'color:inherit;border-color:currentColor',
							onclick: () => {
								state.filter = []
								state.q = ''
								$('#q').value = ''
								renderHead()
								renderView()
							},
						},
						'Сбросить фильтры',
					),
				),
			)
		}
		const mini = archived && state.archiveView === 'mini'
		const grid = h('div', { class: 'grid' + (mini ? ' archive-grid' : '') })
		list.forEach(n => grid.append(noteCard(n, archived, mini)))
		if (!archived)
			grid.append(
				h(
					'button',
					{
						class: 'add-tile',
						type: 'button',
						onclick: () => openEditor(null, state.filter),
					},
					h('span', { class: 'plus', 'aria-hidden': 'true' }, '+'),
					h('span', { class: 'add-label' }, 'Новая заметка'),
				),
			)
		view.append(grid)
	}

	function commitNewTag() {
		const inp = $('#newTagInput')
		if (!inp) return
		const t = normTag(inp.value)
		inp.value = ''
		if (!t) return
		const known = new Set(state.data.extraTags)
		state.data.notes.forEach(n => n.tags.forEach(x => known.add(x)))
		if (!known.has(t) && state.data.extraTags.length < 200) {
			state.data.extraTags.push(t)
			save()
		}
		renderView()
		const again = $('#newTagInput')
		if (again) again.focus()
	}

	function renderTags(view) {
		const map = new Map()
		state.data.notes.forEach(n =>
			n.tags.forEach(t => {
				const o = map.get(t) || { b: 0, a: 0 }
				n.archivedAt ? o.a++ : o.b++
				map.set(t, o)
			}),
		)
		state.data.extraTags.forEach(t => {
			if (!map.has(t)) map.set(t, { b: 0, a: 0 })
		})

		view.append(
			h(
				'div',
				{ class: 'tag-add-row' },
				h('input', {
					id: 'newTagInput',
					class: 'tag-new-input',
					type: 'text',
					maxlength: '24',
					placeholder: 'Новый тег',
					autocomplete: 'off',
					onkeydown: e => {
						if (e.key === 'Enter') {
							e.preventDefault()
							commitNewTag()
						}
					},
				}),
				h(
					'button',
					{ class: 'btn primary', type: 'button', onclick: commitNewTag },
					'Добавить тег',
				),
			),
		)

		if (!map.size) {
			view.append(
				h(
					'p',
					{ class: 'hint' },
					'Тегов пока нет. Добавьте тег выше или прикрепите его к заметке, например «срочно» или «дом».',
				),
			)
			return
		}
		const ul = h('ul', { class: 'tag-list' })
		;[...map]
			.sort(
				(a, b) =>
					b[1].b + b[1].a - (a[1].b + a[1].a) || a[0].localeCompare(b[0], 'ru'),
			)
			.forEach(([t, c]) => {
				const total = c.b + c.a
				ul.append(
					h(
						'li',
						null,
						h('span', { class: 'tag', style: tagStyle(t) }, t),
						h('input', {
							type: 'color',
							class: 'tag-color',
							title: 'Цвет тега',
							value: state.data.tagColors[t] || '#6c63ff',
							onchange: e => {
								state.data.tagColors[t] = e.target.value
								save()
								renderView()
							},
						}),
						state.data.tagColors[t] &&
							h(
								'button',
								{
									class: 'btn-mini',
									type: 'button',
									title: 'Сбросить цвет',
									onclick: () => {
										delete state.data.tagColors[t]
										save()
										renderView()
									},
								},
								'Сброс',
							),
						h(
							'span',
							{ class: 'tag-count' },
							total
								? `на доске ${c.b}, в архиве ${c.a}`
								: 'ещё не используется',
						),
						total > 0 &&
							h(
								'button',
								{
									class: 'btn-mini',
									type: 'button',
									onclick: () => {
										state.filter = [t]
										go('board')
									},
								},
								'Показать на доске',
							),
						confirmBtn('tag:' + t, 'Удалить тег', () => {
							state.data.notes.forEach(n => {
								n.tags = n.tags.filter(x => x !== t)
							})
							state.data.extraTags = state.data.extraTags.filter(x => x !== t)
							delete state.data.tagColors[t]
							state.filter = state.filter.filter(x => x !== t)
							save()
							renderAll()
						}),
					),
				)
			})
		view.append(ul)
	}

	let downloads = null
	function renderData(view) {
		const box = h('div', { class: 'data-page' })
		box.append(
			h(
				'p',
				null,
				'Заметки хранятся в памяти этого браузера. Если очистить данные сайта или открыть страницу в другом браузере, их там не будет. Скачайте копию, чтобы ничего не потерять.',
			),
		)
		const file = h('input', {
			type: 'file',
			accept: '.json,application/json',
			class: 'sr',
			id: 'importFile',
		})
		file.addEventListener('change', () =>
			importFile(file.files && file.files[0]),
		)
		box.append(
			h(
				'div',
				{ class: 'data-actions' },
				h(
					'button',
					{ class: 'btn primary', type: 'button', onclick: exportData },
					'Скачать копию',
				),
				h(
					'label',
					{
						class: 'btn file-btn',
						for: 'importFile',
						tabindex: '0',
						onkeydown: e => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault()
								file.click()
							}
						},
					},
					'Загрузить копию',
				),
				file,
			),
		)
		box.append(h('p', { class: 'msg', role: 'status' }, state.dataMsg))
		if (state.exportText) {
			const ta = h('textarea', {
				class: 'export-box',
				readonly: true,
				'aria-label': 'Текст копии',
			})
			ta.value = state.exportText
			box.append(
				h(
					'p',
					null,
					'Скачивание здесь недоступно. Скопируйте текст ниже и сохраните его в файл .json.',
				),
				ta,
			)
		}
		view.append(box)
	}
	function exportData() {
		const json = JSON.stringify(
			{
				app: 'stena-del',
				version: 1,
				notes: state.data.notes,
				extraTags: state.data.extraTags,
			},
			null,
			2,
		)
		const name = `stena-del-${new Date().toISOString().slice(0, 10)}.json`
		if (!downloads) {
			state.exportText = json
			state.dataMsg = ''
			renderView()
			return
		}
		downloads.save({ filename: name, data: json }).then(
			() => {
				state.dataMsg = 'Копия сохранена.'
				renderView()
			},
			err => {
				if (err && err.code === 'declined') return
				state.exportText = json
				state.dataMsg = ''
				renderView()
			},
		)
	}
	function importFile(f) {
		if (!f) return
		const rd = new FileReader()
		rd.onload = () => {
			try {
				const d = JSON.parse(String(rd.result))
				const src = Array.isArray(d) ? d : d.notes
				if (!Array.isArray(src)) throw new Error('bad')
				const have = new Set(state.data.notes.map(n => n.id))
				const add = src.map(cleanNote).filter(n => n && !have.has(n.id))
				state.data.notes.push(...add)
				if (!Array.isArray(d) && Array.isArray(d.extraTags)) {
					const knownT = new Set(state.data.extraTags)
					d.extraTags
						.map(normTag)
						.filter(Boolean)
						.forEach(t => knownT.add(t))
					state.data.extraTags = [...knownT].slice(0, 200)
				}
				save()
				state.dataMsg = add.length
					? `Добавлено заметок: ${add.length}.`
					: 'Новых заметок в файле нет.'
			} catch (e) {
				state.dataMsg =
					'Не удалось прочитать файл. Нужна копия, скачанная отсюда.'
			}
			renderAll()
		}
		rd.readAsText(f)
	}

	function renderView() {
		const view = $('#view')
		view.replaceChildren()
		renderMeta()
		if (state.route === 'board') renderList(view, false)
		else if (state.route === 'archive') renderList(view, true)
		else if (state.route === 'tags') renderTags(view)
		else renderData(view)
		state.justAdded = null
		const ti = $('.tag-input')
		if (ti) ti.focus()
	}
	function renderAll() {
		renderNav()
		renderHead()
		renderView()
	}

	/* ============ routing ============ */
	function parseRoute() {
		const r = location.hash.slice(1)
		return NAV.some(n => n.id === r) ? r : 'board'
	}
	function go(r) {
		if (location.hash === '#' + r) {
			state.route = r
			renderAll()
		} else location.hash = '#' + r
	}
	window.addEventListener('hashchange', () => {
		state.route = parseRoute()
		state.tagEditing = null
		state.confirm = null
		state.dataMsg = ''
		state.exportText = ''
		if (state.route === 'archive')
			state.sort = state.sort === 'urgent' ? 'new' : state.sort
		$('#sort').value = state.sort
		renderAll()
		window.scrollTo(0, 0)
	})

	/* ============ editor ============ */
	const dlg = $('#editor')
	const ed = { id: null, tags: [] }
	let delArmed = false
	function renderEdTags() {
		$('#edTags').replaceChildren(
			...ed.tags.map(t =>
				h(
					'button',
					{
						class: 'tag',
						type: 'button',
						style: tagStyle(t),
						'aria-label': `Убрать тег ${t}`,
						title: 'Убрать тег',
						onclick: () => {
							ed.tags = ed.tags.filter(x => x !== t)
							renderEdTags()
							$('#edTag').focus()
						},
					},
					t + ' ×',
				),
			),
		)
		const all = new Set()
		state.data.notes.forEach(n => n.tags.forEach(t => all.add(t)))
		state.data.extraTags.forEach(t => all.add(t))
		const sug = [...all].filter(t => !ed.tags.includes(t)).slice(0, 8)
		$('#edSuggest').replaceChildren(
			...sug.map(t =>
				h(
					'button',
					{
						class: 'tag',
						type: 'button',
						title: 'Добавить тег',
						onclick: () => pushEdTag(t),
					},
					'+ ' + t,
				),
			),
		)
	}
	function pushEdTag(t) {
		t = normTag(t)
		if (t && !ed.tags.includes(t) && ed.tags.length < 8) ed.tags.push(t)
		$('#edTag').value = ''
		renderEdTags()
	}
	function resetDel() {
		delArmed = false
		$('#edDelete').textContent = 'Удалить'
	}
	function openEditor(id, prefill) {
		const n = id ? find(id) : null
		ed.id = n ? n.id : null
		ed.tags = n ? [...n.tags] : [...(prefill || [])]
		$('#edTitle').textContent = n ? 'Заметка' : 'Новая заметка'
		$('#edText').value = n ? n.text : ''
		$('#edTag').value = ''
		$('#edErr').hidden = true
		$('#edSave').textContent = n ? 'Сохранить' : 'Приклеить'
		$('#edDelete').hidden = !n
		resetDel()
		renderEdTags()
		if (dlg.showModal) dlg.showModal()
		else dlg.setAttribute('open', '')
		$('#edText').focus()
	}
	function closeEditor() {
		if (dlg.close) dlg.close()
		else dlg.removeAttribute('open')
	}
	function saveEditor() {
		const text = $('#edText').value.trim()
		if (!text) {
			const e = $('#edErr')
			e.textContent = 'Напишите, что нужно сделать.'
			e.hidden = false
			$('#edText').focus()
			return
		}
		const pending = normTag($('#edTag').value)
		if (pending && !ed.tags.includes(pending) && ed.tags.length < 8)
			ed.tags.push(pending)
		const tags = [...ed.tags]
		closeEditor()
		if (ed.id) updateNote(ed.id, { text, tags })
		else addNote(text, tags)
	}
	$('#edSave').addEventListener('click', saveEditor)
	$('#edCancel').addEventListener('click', closeEditor)
	$('#edDelete').addEventListener('click', () => {
		if (!delArmed) {
			delArmed = true
			$('#edDelete').textContent = 'Точно удалить?'
			return
		}
		const id = ed.id
		closeEditor()
		deleteNote(id)
	})
	$('#edText').addEventListener('keydown', e => {
		if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
			e.preventDefault()
			saveEditor()
		}
	})
	$('#edTag').addEventListener('keydown', e => {
		if (e.key === 'Enter' || e.key === ',') {
			e.preventDefault()
			pushEdTag(e.target.value)
		} else if (e.key === 'Backspace' && !e.target.value && ed.tags.length) {
			ed.tags.pop()
			renderEdTags()
		}
	})
	dlg.addEventListener('click', e => {
		if (e.target === dlg) closeEditor()
	})

	/* ============ tools ============ */
	$('#q').addEventListener('input', e => {
		state.q = e.target.value
		renderView()
	})
	$('#sort').addEventListener('change', e => {
		state.sort = e.target.value
		renderView()
	})
	$('#viewSeg').addEventListener('click', e => {
		const b = e.target.closest('button[data-v]')
		if (!b || b.dataset.v === state.archiveView) return
		state.archiveView = b.dataset.v
		try {
			localStorage.setItem('stena-del-archive-view', state.archiveView)
		} catch (err) {}
		renderHead()
		renderView()
	})

	/* ============ start ============ */
	setPinSprite()
	startSync()
	if (window.claude && typeof window.claude.use === 'function') {
		window.claude.use('downloads').then(
			d => {
				downloads = d
				if (state.route === 'data') renderView()
			},
			() => {},
		)
	}
})()
