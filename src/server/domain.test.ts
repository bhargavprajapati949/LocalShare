import assert from 'node:assert/strict';
import test from 'node:test';
import { HostSessionState } from './domain/models/hostSession';
import { ok, err } from './domain/result';
import { DomainError } from './domain/errors';

test('HostSessionState tracks sharing state and history', () => {
  const session = new HostSessionState();
  assert.equal(session.isSharingActive(), true);
  
  const snap1 = session.stopSharing();
  assert.equal(session.isSharingActive(), false);
  assert.equal(snap1.sharingActive, false);
  assert.ok(snap1.lastStoppedAt);

  const snap2 = session.startSharing();
  assert.equal(session.isSharingActive(), true);
  assert.equal(snap2.sharingActive, true);
});

test('HostSessionState manages toggles and limits', () => {
  const session = new HostSessionState();
  
  session.setUploadEnabled(false);
  assert.equal(session.isUploadEnabled(), false);
  
  session.setMaxUploadSizeMb(500);
  assert.equal(session.getMaxUploadSizeMb(), 500);
  
  session.setDeleteEnabled(true);
  assert.equal(session.isDeleteEnabled(), true);
  
  session.setWebdavEnabled(true);
  assert.equal(session.isWebdavEnabled(), true);

  session.setDomainName('test.local');
  assert.equal(session.getDomainName(), 'test.local');
  
  session.setSessionPin('1234');
  assert.equal(session.getSessionPin(), '1234');
});

test('Result ok and err work correctly', () => {
  const r1 = ok('val');
  assert.equal(r1.ok, true);
  if (r1.ok) assert.equal(r1.value, 'val');

  const error = new DomainError('TEST', 'msg');
  const r2 = err(error);
  assert.equal(r2.ok, false);
  if (!r2.ok) assert.equal(r2.error, error);
});
import { isLoopbackAddress } from './domain/models/hostSession';

test('HostSessionState more toggles', () => {
  const session = new HostSessionState();
  session.setModifyEnabled(false);
  assert.equal(session.isModifyEnabled(), false);
  
  session.setReadEnabled(false);
  assert.equal(session.isReadEnabled(), false);
});

test('isLoopbackAddress utility', () => {
  assert.equal(isLoopbackAddress('127.0.0.1'), true);
  assert.equal(isLoopbackAddress('::1'), true);
  assert.equal(isLoopbackAddress('::ffff:127.0.0.1'), true);
  assert.equal(isLoopbackAddress('192.168.1.1'), false);
  assert.equal(isLoopbackAddress(null), false);
  assert.equal(isLoopbackAddress(undefined), false);
});
