import assert from 'node:assert/strict';
import test from 'node:test';
import { blendOpacity, sequenceFromManifest } from './turntable.ts';

test('adjacent photographs share the scrub', () => {
  assert.equal(blendOpacity(0.25, 0, false), 0.75);
  assert.equal(blendOpacity(0.25, 1, false), 0.25);
  assert.equal(blendOpacity(0.25, 2, false), 0);
});

test('reduced motion shows one frame', () => {
  assert.equal(blendOpacity(0.4, 0, true), 1);
  assert.equal(blendOpacity(0.4, 1, true), 0);
});

test('an empty manifest keeps the existing photographs', () => {
  assert.equal(sequenceFromManifest({ sequences: {} }, 'oversized-hoodie', 'Onyx Black'), null);
});

test('a listed sequence builds padded frame paths', () => {
  const seq = sequenceFromManifest({
    sequences: {
      'oversized-hoodie': {
        'onyx-black': { frames: 24, width: 800, height: 1000, ext: 'jpg' },
      },
    },
  }, 'oversized-hoodie', 'Onyx Black');
  assert.equal(seq?.urls.length, 24);
  assert.equal(seq?.urls[0], '/turntable/oversized-hoodie/onyx-black/01.jpg');
  assert.equal(seq?.urls[23], '/turntable/oversized-hoodie/onyx-black/24.jpg');
  assert.equal(seq?.width, 800);
});

test('too many frames, a bad extension, or a path are ignored', () => {
  assert.equal(sequenceFromManifest({
    sequences: { 'oversized-hoodie': { 'onyx-black': { frames: 40, width: 8, height: 8, ext: 'jpg' } } },
  }, 'oversized-hoodie', 'Onyx Black'), null);
  assert.equal(sequenceFromManifest({
    sequences: { 'oversized-hoodie': { 'onyx-black': { frames: 12, width: 8, height: 8, ext: 'png' } } },
  }, 'oversized-hoodie', 'Onyx Black'), null);
  assert.equal(sequenceFromManifest({
    sequences: { '../x': { y: { frames: 4, width: 8, height: 8, ext: 'jpg' } } },
  }, '../x', 'y'), null);
});
