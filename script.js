// Gallery lightbox
const lightbox = document.getElementById('lightbox');

if (lightbox) {
  const lightboxImg = lightbox.querySelector('img');

  document.querySelectorAll('.gallery-item').forEach(item => {
    item.addEventListener('click', () => {
      lightboxImg.src = item.getAttribute('data-full');
      lightboxImg.alt = item.querySelector('img')?.alt || 'Full-size photo';
      lightbox.hidden = false;
      document.body.style.overflow = 'hidden';
    });
  });

  const closeLightbox = () => {
    lightbox.hidden = true;
    lightboxImg.src = '';
    document.body.style.overflow = '';
  };

  lightbox.addEventListener('click', closeLightbox);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !lightbox.hidden) closeLightbox();
  });
}

// Respect reduced-motion: show the hero poster instead of playing the video
const heroVideo = document.querySelector('.hero-media');
if (heroVideo && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  heroVideo.removeAttribute('autoplay');
  heroVideo.pause();
}
