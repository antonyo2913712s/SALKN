const PREFIX = '+7 (';
const digitsOnly = value => value.replace(/\D/g, '');

function nationalNumber(value) {
  const digits = digitsOnly(value);
  const prefixLength = /^\s*\+7/.test(value) || (digits.length > 10 && /^[78]/.test(digits)) ? 1 : 0;
  return { digits: digits.slice(prefixLength, prefixLength + 10), prefixLength };
}

export function formatPhone(digits) {
  digits = digitsOnly(digits).slice(0, 10);
  let value = PREFIX + digits.slice(0, 3);
  if (digits.length >= 3) value += ') ' + digits.slice(3, 6);
  if (digits.length >= 6) value += '-' + digits.slice(6, 8);
  if (digits.length >= 8) value += '-' + digits.slice(8, 10);
  return value;
}

export function normalizePhone(value) {
  if (!/^\s*\+?[\d()\s-]*$/.test(value)) return null;
  let digits = digitsOnly(value);
  if (digits.length === 10 && !value.includes('+')) digits = '7' + digits;
  if (digits.length === 11 && digits[0] === '8') digits = '7' + digits.slice(1);
  return /^7\d{10}$/.test(digits) ? '+' + digits : null;
}

function digitPosition(value, caret) {
  return digitsOnly(value.slice(PREFIX.length, Math.max(PREFIX.length, caret))).length;
}

function caretPosition(value, count) {
  let position = PREFIX.length;
  while (count > 0 && position < value.length) {
    if (/\d/.test(value[position])) count--;
    position++;
  }
  while (position < value.length && /\D/.test(value[position])) position++;
  return position;
}

export function attachPhoneMask(input) {
  const render = (digits, caret) => {
    input.value = formatPhone(digits);
    if (caret !== undefined) {
      const position = caretPosition(input.value, caret);
      input.setSelectionRange(position, position);
    }
  };
  const selection = () => ({
    start: digitPosition(input.value, input.selectionStart ?? 0),
    end: digitPosition(input.value, input.selectionEnd ?? 0),
  });
  const notify = () => input.dispatchEvent(new Event('input', { bubbles: true }));

  input.addEventListener('focus', () => {
    if (!input.value) render('', 0);
  });
  input.addEventListener('blur', () => {
    if (!nationalNumber(input.value).digits) input.value = '';
  });
  // Also handles mobile keyboards, autofill, drag/drop and non-cancelable edits.
  input.addEventListener('input', () => {
    const raw = input.value;
    const { digits, prefixLength } = nationalNumber(raw);
    const caret = Math.max(0, digitsOnly(raw.slice(0, input.selectionStart ?? raw.length)).length - prefixLength);
    render(digits, Math.min(caret, digits.length));
  });
  input.addEventListener('paste', event => {
    if (!event.clipboardData) return;
    event.preventDefault();
    const pasted = nationalNumber(event.clipboardData.getData('text')).digits;
    if (!pasted) return;
    const digits = nationalNumber(input.value).digits;
    const { start, end } = selection();
    const inserted = pasted.slice(0, 10 - digits.length + end - start);
    render(digits.slice(0, start) + inserted + digits.slice(end), start + inserted.length);
    notify();
  });
  input.addEventListener('beforeinput', event => {
    if (!event.cancelable) return;
    const digits = nationalNumber(input.value).digits;
    if (event.inputType === 'insertText' && event.data === '+' && !digits) {
      event.preventDefault();
      render('', 0);
      input.setSelectionRange(1, 2);
      return;
    }
    if (!event.inputType.startsWith('delete')) return;
    let { start, end } = selection();
    if (start === end) {
      if (event.inputType.endsWith('Backward')) start = Math.max(0, start - 1);
      else if (event.inputType.endsWith('Forward')) end = Math.min(digits.length, end + 1);
    }
    // Delete digits instead of getting stuck on a parenthesis, space or hyphen.
    event.preventDefault();
    render(digits.slice(0, start) + digits.slice(end), start);
    notify();
  });
  if (input.value) input.value = formatPhone(nationalNumber(input.value).digits);
}
