(() => {
  const SELECTOR = '.history-track';
  const DRAG_THRESHOLD = 4;
  const MAX_BOUNCE = 56;
  const FRICTION = 0.955;
  const MIN_VELOCITY = 0.09;
  const MOMENTUM_GAIN = 18;

  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  function animateTo(track, target, duration = 320) {
    const start = track.scrollLeft;
    const delta = target - start;
    const startedAt = performance.now();

    function frame(now) {
      const progress = Math.min(1, (now - startedAt) / duration);
      track.scrollLeft = start + delta * easeOut(progress);
      if (progress < 1) requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }

  function attach(track) {
    if (!track || track.dataset.inertiaReady === '1') return;
    track.dataset.inertiaReady = '1';

    let pointerId = null;
    let isPointerDown = false;
    let didDrag = false;
    let startX = 0;
    let startScroll = 0;
    let lastX = 0;
    let lastT = 0;
    let velocity = 0;
    let elasticOffset = 0;
    let raf = 0;
    let elasticTimer = 0;
    let elasticToken = 0;

    const maxScroll = () => Math.max(0, track.scrollWidth - track.clientWidth);
    const cancelMomentum = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    const setElastic = (value) => {
      if (elasticTimer) clearTimeout(elasticTimer);
      elasticTimer = 0;
      elasticToken += 1;
      elasticOffset = Math.max(-MAX_BOUNCE, Math.min(MAX_BOUNCE, value));
      track.style.transition = 'none';
      track.style.transform = elasticOffset ? `translate3d(${elasticOffset}px, 0, 0)` : '';
    };

    const clearElastic = () => {
      const matrix = getComputedStyle(track).transform;
      const fromStyle = matrix && matrix !== 'none' ? Number(matrix.split(',')[4]) || 0 : 0;
      const from = elasticOffset || fromStyle;
      elasticOffset = 0;
      if (elasticTimer) clearTimeout(elasticTimer);
      elasticTimer = 0;
      if (!from) {
        track.style.transition = '';
        track.style.transform = '';
        return;
      }
      const token = ++elasticToken;
      track.style.transition = 'none';
      track.style.transform = `translate3d(${from}px, 0, 0)`;
      track.getBoundingClientRect();
      track.style.transition = 'transform 320ms cubic-bezier(.2, .8, .2, 1)';
      track.style.transform = '';
      elasticTimer = setTimeout(() => {
        if (token !== elasticToken) return;
        track.style.transition = '';
        track.style.transform = '';
        elasticTimer = 0;
      }, 360);
    };

    const settle = () => {
      const max = maxScroll();
      if (track.scrollLeft < 0) animateTo(track, 0, 260);
      if (track.scrollLeft > max) animateTo(track, max, 260);
      clearElastic();
    };

    const momentum = () => {
      const max = maxScroll();
      track.scrollLeft -= velocity * MOMENTUM_GAIN;
      velocity *= FRICTION;

      if (track.scrollLeft < 0 || track.scrollLeft > max) {
        const target = track.scrollLeft < 0 ? 0 : max;
        animateTo(track, target, 280);
        clearElastic();
        raf = 0;
        return;
      }

      if (Math.abs(velocity) > MIN_VELOCITY) {
        raf = requestAnimationFrame(momentum);
      } else {
        raf = 0;
        settle();
      }
    };

    track.addEventListener('pointerdown', (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      cancelMomentum();
      clearElastic();
      pointerId = event.pointerId;
      isPointerDown = true;
      didDrag = false;
      startX = event.clientX;
      startScroll = track.scrollLeft;
      lastX = event.clientX;
      lastT = performance.now();
      velocity = 0;
      track.setPointerCapture?.(pointerId);
    }, { passive: true });

    track.addEventListener('pointermove', (event) => {
      if (!isPointerDown || event.pointerId !== pointerId) return;
      const now = performance.now();
      const dx = event.clientX - startX;
      if (!didDrag && Math.abs(dx) < DRAG_THRESHOLD) return;
      if (!didDrag) {
        didDrag = true;
        track.classList.add('is-dragging');
      }

      event.preventDefault();
      const max = maxScroll();
      let next = startScroll - dx;
      let overflow = 0;

      if (next < 0) {
        overflow = -next;
        next = 0;
        setElastic(Math.min(MAX_BOUNCE, overflow * 0.26));
      } else if (next > max) {
        overflow = next - max;
        next = max;
        setElastic(-Math.min(MAX_BOUNCE, overflow * 0.26));
      } else if (elasticOffset) {
        setElastic(0);
      }

      track.scrollLeft = next;
      const dt = Math.max(8, now - lastT);
      velocity = (event.clientX - lastX) / dt;
      lastX = event.clientX;
      lastT = now;
    }, { passive: false });

    const end = (event) => {
      if (!isPointerDown || event.pointerId !== pointerId) return;
      isPointerDown = false;
      track.classList.remove('is-dragging');
      track.releasePointerCapture?.(pointerId);
      pointerId = null;

      const max = maxScroll();
      if (track.scrollLeft < 0 || track.scrollLeft > max) {
        settle();
        return;
      }

      clearElastic();

      if (didDrag && Math.abs(velocity) > MIN_VELOCITY) {
        raf = requestAnimationFrame(momentum);
      }
    };

    track.addEventListener('pointerup', end, { passive: true });
    track.addEventListener('pointercancel', end, { passive: true });
    track.addEventListener('mouseleave', () => {
      if (!isPointerDown) return;
      isPointerDown = false;
      didDrag = false;
      track.classList.remove('is-dragging');
      settle();
    }, { passive: true });

    track.addEventListener('click', (event) => {
      if (!didDrag) return;
      event.preventDefault();
      event.stopPropagation();
      didDrag = false;
    }, true);
  }

  function scan() {
    document.querySelectorAll(SELECTOR).forEach(attach);
  }

  scan();
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
})();
