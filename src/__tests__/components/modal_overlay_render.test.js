// Lớp phủ tối mờ của các modal tự dựng (công thức rating, sức mạnh thực, cài đặt mùa, sổ điểm mùa, nhập
// kết quả bằng giọng nói, hồ sơ thành viên ở BXH). Bấm ra ngoài = đóng, nên khung bên trong phải tự chặn click.
import test from 'node:test'
import assert from 'node:assert/strict'
import { html, load } from '../tournament/_render.js'
import { createElement } from 'react'

const { ModalOverlay } = await load('#ui')
const child = createElement('p', null, 'nội dung')

test('phủ kín màn, mờ nền, căn giữa, cách mép 16px', () => {
  const m = html(ModalOverlay, { onClose: () => {}, children: child })
  assert.match(m, /^<div style="position:fixed;inset:0;z-index:9999;background:rgba\(0,0,0,\.65\);backdrop-filter:blur\(4px\);display:flex;align-items:center;justify-content:center;padding:16px"><p>nội dung<\/p><\/div>$/)
})

test('mobile: dính đáy, không cách mép', () => {
  const m = html(ModalOverlay, { onClose: () => {}, align: 'flex-end', padding: 0, children: child })
  assert.match(m, /align-items:flex-end;justify-content:center;padding:0/)
})
