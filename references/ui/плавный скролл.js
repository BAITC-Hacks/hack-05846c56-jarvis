/*
  Плавный «невесомый» скролл (Lenis)
  ----------------------------------
  Как подключить в любой проект:

  1) Перед этим файлом подключите библиотеку Lenis (и, если используете
     анимации по скроллу, GSAP + ScrollTrigger — они не обязательны):

     <script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js"></script>
     <script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/ScrollTrigger.min.js"></script>
     <script src="https://cdn.jsdelivr.net/npm/lenis@1.3.17/dist/lenis.min.js"></script>
     <script src="smooth-scroll.js"></script>

  2) Готово — обычный скролл страницы станет плавным сам по себе,
     ничего больше делать не нужно.

  3) Если на странице есть ссылки-якоря (<a href="#section">), используйте
     window.__lenis.scrollTo(...) вместо scrollIntoView, чтобы прокрутка
     была такой же плавной:

     document.querySelector('a[href="#section"]').addEventListener('click', (e) => {
       e.preventDefault();
       window.__lenis.scrollTo('#section', { duration: 1.4 });
     });

  Настройки, которые чаще всего меняют:
  - duration — сколько секунд «доезжает» скролл после остановки колёсика
  - easing   — кривая замедления (чем сильнее степень, тем более «плывущий» финал)
  - touchMultiplier — чувствительность на тачскринах
*/

(function () {
  if (typeof Lenis === 'undefined') {
    console.warn('Lenis не найден: подключите https://cdn.jsdelivr.net/npm/lenis@1.3.17/dist/lenis.min.js перед этим файлом');
    return;
  }

  const lenis = new Lenis({
    duration: 1.35,
    easing: (t) => 1 - Math.pow(1 - t, 4), // мягкое, «плывущее» замедление без резких рывков
    smoothWheel: true,
    syncTouch: true,
    touchMultiplier: 1.15,
  });

  // Если на странице подключены GSAP + ScrollTrigger — синхронизируем их с Lenis,
  // чтобы анимации по скроллу не отставали от плавной прокрутки.
  if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  } else {
    requestAnimationFrame(function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    });
  }

  // Даёт доступ к экземпляру из любого места страницы, например для
  // window.__lenis.scrollTo('#section') по клику на ссылку-якорь.
  window.__lenis = lenis;
})();
