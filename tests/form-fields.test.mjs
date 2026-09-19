import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeName, isValidName, limitText, NAME_LIMIT, COMMENT_LIMIT } from '../dist/form-fields.js';

test('names support Cyrillic, Tatar, Latin, accents, hyphens and apostrophes', () => {
  for (const name of ['', 'Анна-Мария', 'Әлфия', 'Шакир Алмазович', 'O’Connor', "O'Connor", 'José', 'Jose\u0301']) {
    assert.equal(sanitizeName(name), name);
    assert.equal(isValidName(name), true, name);
  }
});

test('name input removes numbers, emoji and markup characters', () => {
  assert.equal(sanitizeName('Иван123 🧊!@#$<>'), 'Иван ');
  for (const name of ['123', 'Иван123', 'Иван🧊', '<Иван>', '---', "''", '\u0301']) {
    assert.equal(isValidName(name), false, name);
  }
});

test('name length is limited to 60 characters', () => {
  assert.equal(sanitizeName('А'.repeat(100)).length, NAME_LIMIT);
  assert.equal(isValidName('А'.repeat(60)), true);
  assert.equal(isValidName('А'.repeat(61)), false);
});

test('comments keep free text and are limited without splitting emoji', () => {
  const comment = 'Комната 25 м², окна на юг.\nНужен кондиционер 🧊';
  assert.equal(limitText(comment, COMMENT_LIMIT), comment);
  assert.equal(limitText('я'.repeat(1001), COMMENT_LIMIT), 'я'.repeat(1000));
  assert.equal(limitText('я'.repeat(999) + '🧊', COMMENT_LIMIT), 'я'.repeat(999));
});
