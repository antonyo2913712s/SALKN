export const NAME_LIMIT = 60;
export const COMMENT_LIMIT = 1000;

export const limitText = (value, limit) => value.slice(0, limit).replace(/[\uD800-\uDBFF]$/u, '');

export function sanitizeName(value) {
  return limitText(value.replace(/[^\p{L}\p{M} '’ʼ-]/gu, ''), NAME_LIMIT);
}

export function isValidName(value) {
  return value.length <= NAME_LIMIT && (value.trim() === '' ||
    (/^[\p{L}\p{M} '’ʼ-]+$/u.test(value) && /\p{L}/u.test(value)));
}

export function attachTextFields(form) {
  const name = form.elements.name;
  const comment = form.elements.comment;
  const clearError = input => {
    input.removeAttribute('aria-invalid');
    document.querySelector(`#${input.name}-error`).textContent = '';
  };
  const refresh = () => {
    document.querySelector('#name-limit').textContent = `${name.value.length} / ${NAME_LIMIT} символов`;
    document.querySelector('#comment-limit').textContent = `${comment.value.length} / ${COMMENT_LIMIT} символов`;
  };
  name.addEventListener('input', () => {
    const value = sanitizeName(name.value);
    if (value !== name.value) {
      const caret = sanitizeName(name.value.slice(0, name.selectionStart ?? name.value.length)).length;
      name.value = value;
      name.setSelectionRange(caret, caret);
    }
    clearError(name);
    refresh();
  });
  comment.addEventListener('input', () => {
    const value = limitText(comment.value, COMMENT_LIMIT);
    if (value !== comment.value) comment.value = value;
    clearError(comment);
    refresh();
  });
  const validate = () => {
    let firstInvalid = null;
    for (const [input, valid, message] of [
      [name, isValidName(name.value), 'Укажите имя буквами — до 60 символов. Можно использовать пробел, дефис и апостроф.'],
      [comment, comment.value.length <= COMMENT_LIMIT, 'Сократите комментарий до 1000 символов.'],
    ]) {
      clearError(input);
      if (!valid) {
        input.setAttribute('aria-invalid', 'true');
        document.querySelector(`#${input.name}-error`).textContent = message;
        firstInvalid ??= input;
      }
    }
    return firstInvalid;
  };
  form.addEventListener('reset', () => queueMicrotask(() => {
    clearError(name);
    clearError(comment);
    refresh();
  }));
  refresh();
  return { validate };
}
