import test from 'node:test';
import assert from 'node:assert/strict';
import { attachPhoneMask, normalizePhone } from '../dist/phone-mask.js';

class PhoneInput extends EventTarget {
  value = '';
  selectionStart = 0;
  selectionEnd = 0;
  setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
  selectAll() { this.setSelectionRange(0, this.value.length); }
  type(text) {
    for (const char of text) {
      const before = Object.assign(new Event('beforeinput', { cancelable: true }), { inputType: 'insertText', data: char });
      if (!this.dispatchEvent(before)) continue;
      const position = this.selectionStart;
      this.value = this.value.slice(0, position) + char + this.value.slice(this.selectionEnd);
      this.setSelectionRange(position + 1, position + 1);
      this.dispatchEvent(new Event('input'));
    }
  }
  paste(text) {
    this.dispatchEvent(Object.assign(new Event('paste', { cancelable: true }), { clipboardData: { getData: () => text } }));
  }
  delete(inputType = 'deleteContentBackward') {
    this.dispatchEvent(Object.assign(new Event('beforeinput', { cancelable: true }), { inputType }));
  }
}
const field = () => {
  const input = new PhoneInput();
  attachPhoneMask(input);
  input.dispatchEvent(new Event('focus'));
  return input;
};

test('typing a national number adds the country code and punctuation immediately', () => {
  const input = field();
  assert.equal(input.value, '+7 (');
  input.type('999');
  assert.equal(input.value, '+7 (999) ');
  input.type('1234567');
  assert.equal(input.value, '+7 (999) 123-45-67');
  assert.equal(normalizePhone(input.value), '+79991234567');
});

test('letters and excess digits cannot remain in the field', () => {
  const input = field();
  input.type('словаabc');
  assert.equal(input.value, '+7 (');
  input.type('999abc123!45-67' + '9'.repeat(30));
  assert.equal(input.value, '+7 (999) 123-45-67');
});

test('pasting numbers with +7, 8, or without a prefix produces the same result', () => {
  const input = field();
  for (const value of ['9991234567', '+7 (999) 123-45-67', '8 999 123 45 67', '+79991234567' + '9'.repeat(50)]) {
    input.selectAll();
    input.paste(value);
    assert.equal(input.value, '+7 (999) 123-45-67', value);
  }
});

test('backspace crosses punctuation and preserves the country code', () => {
  const input = field();
  input.type('99912345');
  input.delete();
  assert.equal(input.value, '+7 (999) 123-4');
  input.setSelectionRange(9, 9);
  input.delete();
  assert.equal(input.value, '+7 (991) 234-');
  input.selectAll();
  input.delete();
  assert.equal(input.value, '+7 (');
  input.delete();
  assert.equal(input.value, '+7 (');
  input.dispatchEvent(new Event('blur'));
  assert.equal(input.value, '');
});

test('middle selection replacement and forward delete keep the remaining digits', () => {
  const input = field();
  input.paste('9991234567');
  input.setSelectionRange(9, 12);
  input.paste('456');
  assert.equal(input.value, '+7 (999) 456-45-67');
  input.setSelectionRange(12, 12);
  input.delete('deleteContentForward');
  assert.equal(input.value, '+7 (999) 456-56-7');
});

test('autofill is formatted and partial numbers stay invalid', () => {
  const input = field();
  input.value = '89991234567';
  input.setSelectionRange(11, 11);
  input.dispatchEvent(new Event('input'));
  assert.equal(input.value, '+7 (999) 123-45-67');
  for (const value of ['', '+7 (', '+7 (999) 123-45-6', '+799912345678', 'abc79991234567', '+19991234567']) {
    assert.equal(normalizePhone(value), null, value);
  }
});

test('ten-digit landline numbers keep their area code', () => {
  const input = field();
  input.type('8431234567');
  assert.equal(input.value, '+7 (843) 123-45-67');
});

test('typing an explicit +7 does not duplicate the country code', () => {
  const input = field();
  input.type('+79991234567');
  assert.equal(input.value, '+7 (999) 123-45-67');
});
