const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const menuButton = document.querySelector('.menu-toggle');
const mobileNav = document.querySelector('#mobile-nav');
menuButton.addEventListener('click', () => { const open = menuButton.getAttribute('aria-expanded') !== 'true'; menuButton.setAttribute('aria-expanded', String(open)); menuButton.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню'); mobileNav.hidden = !open; });
mobileNav.addEventListener('click', e => { if (e.target.closest('a')) { mobileNav.hidden = true; menuButton.setAttribute('aria-expanded','false'); menuButton.setAttribute('aria-label','Открыть меню'); } });
document.querySelector('#motion-toggle').addEventListener('click', e => { const paused = document.body.classList.toggle('motion-paused'); e.currentTarget.setAttribute('aria-pressed',String(paused)); e.currentTarget.setAttribute('aria-label', paused ? 'Продолжить анимацию' : 'Приостановить анимацию'); e.currentTarget.textContent = paused ? '▷' : 'Ⅱ'; });
let scrollFrame;
window.addEventListener('scroll',()=>{if(reducedMotion.matches || scrollFrame) return;scrollFrame=requestAnimationFrame(()=>{document.documentElement.style.setProperty('--scroll',Math.min(window.scrollY/700,1));scrollFrame=null;});},{passive:true});

const form = document.querySelector('#lead-form');
const brandOptions = form.elements.brand;
const phone = document.querySelector('#phone');
const consent = document.querySelector('#consent');
const status = document.querySelector('#form-status');
const selectionStatus = document.querySelector('#selection-status');
const clearStatus = () => { status.hidden = true; status.textContent = ''; };
const setService = value => {
  for (const radio of form.elements.service) radio.checked = radio.value === value;
};
const updateBrandStatus = () => {
  selectionStatus.textContent = brandOptions.value === 'Пока не знаю' ? '' : `Вас интересует ${brandOptions.value}. Подберём подходящую модель при разговоре.`;
};
document.querySelectorAll('[data-brand]').forEach(button => button.addEventListener('click', () => {
  brandOptions.value = button.dataset.brand;
  setService('Кондиционер + установка');
  updateBrandStatus();
  clearStatus();
  document.querySelector('#contact').scrollIntoView({behavior: reducedMotion.matches ? 'instant' : 'smooth'});
  phone.focus({preventScroll:true});
}));
document.querySelectorAll('[data-service]').forEach(link => link.addEventListener('click', () => {setService(link.dataset.service);if(link.dataset.service === 'Помогите выбрать'){brandOptions.value='Пока не знаю';updateBrandStatus();}clearStatus();}));
form.elements.service.forEach(radio => radio.addEventListener('change', () => {setService(radio.value);clearStatus();}));
brandOptions.forEach(radio => radio.addEventListener('change', () => {updateBrandStatus();clearStatus();}));

function normalizePhone(value) {
  let digits = value.replace(/\D/g,'');
  if (digits.length === 10 && digits[0] === '9') digits = '7' + digits;
  if (digits.length === 11 && digits[0] === '8') digits = '7' + digits.slice(1);
  return /^7\d{10}$/.test(digits) ? '+' + digits : null;
}
phone.addEventListener('blur', () => {
  const normalized = normalizePhone(phone.value);
  if (normalized) phone.value = normalized.replace(/\+7(\d{3})(\d{3})(\d{2})(\d{2})/, '+7 ($1) $2-$3-$4');
});
phone.addEventListener('input',()=>{phone.removeAttribute('aria-invalid');document.querySelector('#phone-error').textContent='';clearStatus();});
consent.addEventListener('change',()=>{consent.removeAttribute('aria-invalid');document.querySelector('#consent-error').textContent='';clearStatus();});
form.addEventListener('input',clearStatus);
let submitting = false;
let pendingRequest = null;
form.addEventListener('submit',async event=>{
  event.preventDefault();clearStatus();
  if (submitting) return;
  let firstInvalid = null;
  if(!normalizePhone(phone.value)) {phone.setAttribute('aria-invalid','true');document.querySelector('#phone-error').textContent='Введите российский номер: +7 и ещё 10 цифр.';firstInvalid=phone;}
  if(!consent.checked) {consent.setAttribute('aria-invalid','true');document.querySelector('#consent-error').textContent='Для заявки нужно ваше согласие на обработку данных.';firstInvalid ??= consent;}
  if(firstInvalid) {firstInvalid.focus();return;}
  if(form.elements.website.value) return;
  const payload = {name:form.elements.name.value.trim(),phone:normalizePhone(phone.value),service:form.elements.service.value,brand:brandOptions.value,comment:form.elements.comment.value.trim(),consent:true,website:''};
  const signature = JSON.stringify(payload);
  if (!pendingRequest || pendingRequest.signature !== signature) pendingRequest = {signature,id:crypto.randomUUID()};
  const submit = form.querySelector('[type="submit"]');
  submitting=true;submit.disabled=true;form.setAttribute('aria-busy','true');
  submit.querySelector('.submit-text').textContent='Отправляем…';
  // Keep a timed-out request ID for a safe retry: the server will not duplicate it.
  try {
    const session = await fetch('/api/session.php', {credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(12000)});
    if (!session.ok) throw new Error('Не удалось соединиться. Попробуйте ещё раз или позвоните нам.');
    const {csrf} = await session.json();
    const response = await fetch('/api/lead.php', {method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({...payload,requestId:pendingRequest.id}),signal:AbortSignal.timeout(25000)});
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || 'Не удалось подтвердить приём заявки. Попробуйте ещё раз.');
    status.textContent='Заявка принята! Свяжемся с вами по указанному телефону и обсудим детали.';
    form.reset();updateBrandStatus();pendingRequest=null;
  } catch (error) {
    status.textContent=error.name === 'TimeoutError' || error.name === 'TypeError' || error.name === 'SyntaxError'
      ? 'Не удалось подтвердить приём заявки. Повторите отправку или позвоните: +7 993 419-99-54.' : error.message;
  } finally {
    submitting=false;submit.disabled=false;form.removeAttribute('aria-busy');
    submit.querySelector('.submit-text').textContent='Отправить заявку';
    status.hidden=false;status.focus({preventScroll:true});
  }
});

const gallery = document.querySelector('#work-gallery');
const prevGallery = document.querySelector('#gallery-prev');
const nextGallery = document.querySelector('#gallery-next');
const updateGallery = () => {prevGallery.disabled=gallery.scrollLeft<3;nextGallery.disabled=gallery.scrollLeft+gallery.clientWidth>=gallery.scrollWidth-3;};
const moveGallery = direction => gallery.scrollBy({left:direction*(gallery.querySelector('.work-card').getBoundingClientRect().width+22),behavior:reducedMotion.matches?'instant':'smooth'});
prevGallery.addEventListener('click',()=>moveGallery(-1));nextGallery.addEventListener('click',()=>moveGallery(1));
gallery.addEventListener('scroll',updateGallery,{passive:true});window.addEventListener('resize',updateGallery);updateGallery();
gallery.addEventListener('keydown',e=>{if(e.target!==gallery)return;if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();moveGallery(e.key==='ArrowRight'?1:-1);}});
const photos=[...document.querySelectorAll('[data-photo]')];
const dialog=document.querySelector('#photo-dialog');
const largePhoto=document.querySelector('#large-photo');
let photoIndex=0;
const showPhoto = index => {photoIndex=(index+photos.length)%photos.length;const source=photos[photoIndex].querySelector('img');largePhoto.src=source.src;largePhoto.alt=source.alt;document.querySelector('#photo-caption').textContent=`${photos[photoIndex].querySelector('strong').textContent} · ${photoIndex+1} / ${photos.length}`;};
photos.forEach((button,index)=>button.addEventListener('click',()=>{showPhoto(index);dialog.showModal();document.body.style.overflow='hidden';}));
dialog.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>{document.body.style.overflow='';});
dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}});
dialog.addEventListener('keydown',event=>{if(event.key==='ArrowRight'){event.preventDefault();showPhoto(photoIndex+1);}if(event.key==='ArrowLeft'){event.preventDefault();showPhoto(photoIndex-1);}});
document.querySelector('#photo-prev').addEventListener('click',()=>showPhoto(photoIndex-1));document.querySelector('#photo-next').addEventListener('click',()=>showPhoto(photoIndex+1));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!mobileNav.hidden){mobileNav.hidden=true;menuButton.setAttribute('aria-expanded','false');menuButton.setAttribute('aria-label','Открыть меню');menuButton.focus();}});

if ('IntersectionObserver' in window && !reducedMotion.matches) {
  document.documentElement.classList.add('js-reveal');
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target);}}),{threshold:.08,rootMargin:'0px 0px 30px 0px'});
  document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));
}
setTimeout(()=>document.querySelector('.loader')?.remove(),2200);
