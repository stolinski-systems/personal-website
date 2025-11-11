// Mobile nav
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');
if (hamburger && navMenu) {
  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navMenu.classList.toggle('active');
  });
  document.querySelectorAll('.nav-link').forEach(n =>
    n.addEventListener('click', () => {
      hamburger.classList.remove('active');
      navMenu.classList.remove('active');
    })
  );
}

// Disable snap behavior on small screens (mobile/touch devices)
const isMobile = window.matchMedia("(max-width: 768px)").matches ||
  'ontouchstart' in window;

if (isMobile) {
  document.documentElement.style.scrollSnapType = "none"; // disable snapping
  document.body.classList.add("mobile-mode");
}


// Smooth anchor scroll
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    if (!id || id === '#') return;
    const target = document.querySelector(id);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// Navbar style on scroll
window.addEventListener('scroll', () => {
  const nav = document.querySelector('.navbar');
  if (!nav) return;
  if (window.scrollY > 50) {
    nav.style.background = 'rgba(255,255,255,0.98)';
    nav.style.boxShadow = '0 2px 20px rgba(0,0,0,0.1)';
  } else {
    nav.style.background = 'rgba(255,255,255,0.95)';
    nav.style.boxShadow = 'none';
  }
});

// Intersection animations
const io = new IntersectionObserver(
  entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add('animate');
    });
  },
  { threshold: 0.2 }
);

// Tell the observer what to watch
const ioTargets = document.querySelectorAll(
  '.scroll-title, .scroll-subtitle, .scroll-description, ' +
  '.floating-card, .journey-path, .skills-grid, .stats-display, .innovation-image'
);
ioTargets.forEach(el => io.observe(el));


// Apple-style cross-fade
const scrollContainer = document.querySelector('.scroll-container');
const sections = scrollContainer
  ? Array.from(scrollContainer.querySelectorAll('.scroll-section'))
  : [];

let rafId = null;

function updatePanels() {
  if (!sections.length) return;

  const vh = window.innerHeight;
  const scrollY = window.scrollY;

  sections.forEach((sec, i) => {
    const rect = sec.getBoundingClientRect();
    const center = rect.top + rect.height / 2;
    const dist = Math.abs(center - vh / 2);
    let ratio = 1 - dist / (vh * 0.8); // slightly slower fade (0.75 → 0.8)
    ratio = Math.max(0, Math.min(1, ratio));

    // --- keep first section visible until user scrolls halfway past it ---
    if (i === 0 && scrollY < vh * 0.9) ratio = 1;

    // --- keep final section visible when reaching bottom ---
    if (i === sections.length - 1 && scrollY + vh > scrollEnd - vh * 0.3) ratio = 1;

    // --- apply transforms ---
    const y = (1 - ratio) * 50; // slightly smaller vertical offset
    const s = 0.97 + ratio * 0.03; // subtle scale range

    sec.style.opacity = ratio.toFixed(3);
    sec.style.transform = `translateY(${y}px) scale(${s})`;
    sec.style.zIndex = String(100 + Math.round(ratio * 100) + i);
  });
}



function queueUpdate() {
  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    rafId = null;
    updatePanels();
  });
}

window.addEventListener('load', () => {
  setTimeout(updatePanels, 200);
});

window.addEventListener('DOMContentLoaded', () => {
  if (sections[0]) {
    sections[0].style.opacity = '1';
    sections[0].style.transform = 'none';
  }
});



window.addEventListener('resize', queueUpdate);
window.addEventListener('scroll', queueUpdate);

// ---------- Smooth Magnetic Snap-to-Center Logic (Apple-like Improved) ----------
let lastScrollY = window.scrollY;
let lastSnapY = window.scrollY;
let scrollVelocity = 0;
let lastTime = performance.now();
let snapTimer = null;
let animatingSnap = false;

// use the scrollContainer already declared above
const scrollEnd = scrollContainer
  ? scrollContainer.offsetTop + scrollContainer.offsetHeight
  : Infinity;

// reuse already-declared 'sections' from Apple cross-fade
const snapSections = sections;

const SNAP_GAP = window.innerHeight * 0.2; // must scroll 20% of viewport before snapping again

// ---- Smooth easing animation ----
function smoothScrollTo(targetY, duration = 1000, overshoot = 0) {
  const startY = window.scrollY;
  const distance = targetY - startY + overshoot;
  const startTime = performance.now();

  function step(now) {
    const t = Math.min((now - startTime) / duration, 1);
    const ease = t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2; // cubic easeInOut
    window.scrollTo(0, startY + distance * ease);
    if (t < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

// ---------- Intent-based Snap-to-Center ----------
let activeIndex = 0;
let isSnapping = false;
let scrollStartY = window.scrollY;
let lastScrollTime = performance.now();

const SNAP_THRESHOLD = window.innerHeight * 0.18; // how far user must scroll to trigger next
const SNAP_TIMEOUT = 120; // ms of no wheel/touch scroll before we consider gesture done

function lockToSection(index) {
  // --- stop snapping if we're outside the defined scroll container ---
  if (
    index < 0 ||
    index >= snapSections.length ||
    window.scrollY + window.innerHeight * 0.3 > scrollEnd
  ) {
    // allow normal scroll behavior beyond the last section
    isSnapping = false;
    cumulativeScroll = 0;
    return;
  }

  isSnapping = true;
  activeIndex = index;

  const target = snapSections[index];
  const rect = target.getBoundingClientRect();
  // Find "visual" center (account for extra top padding or floating elements)
  const sectionPadding = parseFloat(getComputedStyle(target).paddingTop) || 0;
  const visualCenterOffset = (rect.height / 2) - sectionPadding * 0.5;
  const offset = rect.top + visualCenterOffset - window.innerHeight / 2;

  const targetY = window.scrollY + offset;

  smoothScrollTo(targetY, 850, 0);

  setTimeout(() => {
    isSnapping = false;
    scrollStartY = window.scrollY;
  }, 900);
}

// Gesture-based intent detection
window.addEventListener("wheel", e => handleScrollIntent(e.deltaY));
window.addEventListener("touchmove", e => {
  const touchY = e.touches[0].clientY;
  const dy = lastTouchY !== null ? lastTouchY - touchY : 0;
  lastTouchY = touchY;
  handleScrollIntent(dy);
});
window.addEventListener("touchend", () => (lastTouchY = null));
let lastTouchY = null;

let intentTimer = null;
function handleScrollIntent(deltaY) {
  if (isSnapping) return;

  const now = performance.now();
  const deltaT = now - lastScrollTime;
  lastScrollTime = now;

  // Reset the timeout each time user keeps scrolling
  clearTimeout(intentTimer);
  intentTimer = setTimeout(() => evaluateIntent(), SNAP_TIMEOUT);

  // Track cumulative movement for this gesture
  cumulativeScroll += deltaY;
}
let cumulativeScroll = 0;

if (!isMobile) {
  // ---- all your snapping + wheel/touch intent code here ----


  function evaluateIntent() {
    if (Math.abs(cumulativeScroll) > SNAP_THRESHOLD) {
      const direction = cumulativeScroll > 0 ? 1 : -1;
      lockToSection(activeIndex + direction);
    } else {
      // If small gesture, return to current section
      lockToSection(activeIndex);
    }
    cumulativeScroll = 0;
  }
}

// Parallax + scroll indicator fade
let ticking = false;
function onScrollFx() {
  const scrolled = window.pageYOffset;
  const videoBg = document.querySelector('.video-background');
  const indicator = document.querySelector('.scroll-indicator');
  if (videoBg) videoBg.style.transform = `translateY(${scrolled * -0.25}px)`;
  if (indicator) indicator.style.opacity = Math.max(0, 1 - scrolled / 280);
  ticking = false;
}
window.addEventListener('scroll', () => {
  if (!ticking) {
    requestAnimationFrame(onScrollFx);
    ticking = true;
  }
});
const scrollIndicator = document.querySelector('.scroll-indicator');
if (scrollIndicator) {
  scrollIndicator.addEventListener('click', () => {
    document.querySelector('#about')?.scrollIntoView({ behavior: 'smooth' });
  });
}

// Contact form mock
const form = document.querySelector('.contact-form form');
if (form) {
  form.addEventListener('submit', e => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    const name = form.querySelector('input[type="text"]').value;
    const email = form.querySelector('input[type="email"]').value;
    const msg = form.querySelector('textarea').value;
    if (!name || !email || !msg) return alert('Please fill in all fields.');
    const orig = btn.textContent;
    btn.textContent = 'Sending...';
    btn.disabled = true;
    setTimeout(() => {
      alert('Thanks! I’ll get back to you soon.');
      form.reset();
      btn.textContent = orig;
      btn.disabled = false;
    }, 900);
  });
}

// Experience modal
const brandModal = document.getElementById('brand-modal');
const modalClose = brandModal.querySelector('.modal-close');
const brandData = {
  brand0: {
    title: 'President & Co-Founder',
    company: 'PROTO Robotics LLC',
    location: 'Lincoln, Nebraska',
    icon: 'fas fa-robot',
    image: 'img/proto_h.jpg', // create this image or use an existing one like 'img/proto.png'
    achievements: [
      'Founded and scaled a 40-member university robotics team',
      'Built outreach kits and cloud systems for K-8 STEM education',
      'Led multi-disciplinary engineering, design, and flight initiatives'
    ],
    skills: ['Leadership', 'STEM Outreach', 'System Design', 'Startup Development']
  },
  brand1: {
    title: 'Flight Technical Programs Intern',
    company: 'NetJets Aviation, Inc.',
    location: 'Columbus, Ohio',
    icon: 'fas fa-plane-departure',
    image: 'img/netjets_exp.jpeg',
    achievements: [
      'Validated instrument procedures in business jet simulators',
      'Developed digital ops tooling for flight technical teams',
      'Collaborated across departments to improve procedural testing workflows'
    ],
    skills: ['Business Aviation', 'Data Systems', 'Procedure Design', 'Team Collaboration']
  },
  brand2: {
    title: 'Airfield Design Intern',
    company: 'HDR Engineering, Inc.',
    location: 'Omaha, Nebraska',
    icon: 'fas fa-industry',
    image: 'img/hdr_exp.jpeg',
    achievements: [
      'Supported FAA/DOD airfield projects with CAD standards',
      'Coordinated across multi-disciplinary teams',
      'Contributed to design packages and QA workflows'
    ],
    skills: ['Airfields', 'FAA', 'CAD', 'Team Coordination']
  },
  brand3: {
    title: 'UAS / Survey Intern',
    company: 'Thompson, Dreessen & Dorner, Inc.',
    location: 'Omaha, Nebraska',
    icon: 'fas fa-up-right-and-down-left-from-center',
    image: 'img/td2_exp.jpg',
    achievements: [
      'Executed LiDAR & photogrammetry missions',
      'Produced survey-grade point clouds and orthos',
      'Streamlined field-to-office data processing'
    ],
    skills: ['UAS', 'LiDAR', 'Photogrammetry', 'GIS']
  }
};


function openBrandModal(key) {
  const b = brandData[key];
  if (!b) return;

  // Fill icon, titles, and company
  // Fill icon, titles, company, and location
  document.querySelector('.modal-brand-logo i').className = b.icon;
  document.querySelector('.modal-title').textContent = b.title;
  document.querySelector('.modal-company').textContent = b.company;
  document.querySelector('.modal-location').innerHTML =
    b.location ? `<i class="fas fa-location-dot"></i> ${b.location}` : '';


  // Achievements list
  document.querySelector('.modal-details ul').innerHTML = b.achievements
    .map(x => `<li>${x}</li>`)
    .join('');

  // Skills chips
  document.querySelector('.modal-skills').innerHTML = b.skills
    .map(s => `<span class="skill-chip">${s}</span>`)
    .join('');

  // Image section (dynamic load or fallback)
  const imageContainer = document.querySelector('.modal-image');
  if (b.image) {
    imageContainer.innerHTML = `
      <img src="${b.image}" alt="Experience Highlight for ${b.company}">
    `;
  } else {
    imageContainer.innerHTML = `
      <div class="image-placeholder">
        <i class="fas fa-plane"></i>
        <p>Experience Highlight</p>
      </div>
    `;
  }

  // Activate modal
  brandModal.classList.add('active');
  document.body.style.overflow = 'hidden';
}


function closeBrandModal() {
  brandModal.classList.remove('active');
  document.body.style.overflow = '';
}

document.querySelectorAll('.timeline-item.luxury-brand').forEach(item => {
  const key = item.getAttribute('data-brand');
  item.addEventListener('click', e => {
    if (!e.target.closest('.brand-learn-more')) openBrandModal(key);
  });
  item
    .querySelector('.brand-learn-more')
    ?.addEventListener('click', e => {
      e.stopPropagation();
      openBrandModal(key);
    });
});

modalClose?.addEventListener('click', closeBrandModal);

// ---------- Project Modal ----------
const projectModal = document.getElementById('project-modal');
const projectClose = projectModal.querySelector('.modal-close');

// PROJECT DATA (extended RFID + Carburetor)
const projectData = {
  teammanager: {
    title: 'TeamManager for PROTO',
    subtitle: 'Role-based Operations Suite',
    icon: 'fas fa-people-group',
    image: 'img/teammanager.jpg',
    description:
      'A Flask-based operations system that streamlines event management, user roles, and automated communications for PROTO Robotics.',
    features: [
      'Full single sign-on (SSO) integration',
      'Dynamic role assignment and director view management',
      'Queued and live email sending system with admin toggles',
      'Modular architecture supporting future analytics and reports'
    ],
    skills: ['Flask', 'SQLite', 'Email Automation', 'Responsive UI']
  },
  aircraftsales: {
    title: 'Aircraft Sales Website',
    subtitle: 'Digital Brokerage Platform',
    icon: 'fas fa-plane',
    image: 'img/aircraft-sales.jpg',
    description:
      'A custom WordPress system for business jet listings, with live comparison tools and ACF-driven database functionality.',
    features: [
      'Dynamic fields for detailed aircraft data',
      'AJAX filters and real-time sort logic',
      'Aircraft comparison and quick-view modals',
      'Mobile-first responsive Divi layout'
    ],
    skills: ['WordPress', 'Divi', 'ACF', 'JavaScript']
  },
  flightfitters: {
    title: 'FlightFitters (Part 107)',
    subtitle: 'Aerial Operations & Media',
    icon: 'fas fa-camera',
    image: 'img/atlanta.jpg',
    description:
      'Aerial media and inspection company providing Part 107-certified drone operations, 3D modeling, and industrial photogrammetry.',
    features: [
      'Aerial photogrammetry and orthomapping',
      '14 CFR Part 107 flight operations',
      'Assisting first responders with real-time situational awareness',
      'High-resolution aerial imagery for media'
    ],
    skills: ['Drone', '3D Modeling', 'Media', 'Part 107']
  },
  rfidaccess: {
    title: 'RFID Door Lock for PROTO',
    subtitle: 'Secure Access System',
    icon: 'fas fa-lock',
    image: 'img/prototeam.jpeg',
    description:
      'A Raspberry Pi–based smart lock system integrating RFID authentication and servo-driven mechanical locking. Designed for PROTO Robotics Lab access control.',
    features: [
      'RFID tag identification',
      'Python backend with GPIO control and servo actuation',
      'Encrypted user validation and access logging',
      'Modular hardware for multi-door scalability',
      'Future expansion for biometric and NFC authentication'
    ],
    skills: ['Python', 'Raspberry Pi', 'Hardware', 'Security', 'GPIO']
  },
  photogrammetry: {
    title: 'Drone Photogrammetry',
    subtitle: '3D Mapping & LiDAR',
    icon: 'fas fa-cubes',
    image: 'img/drone_data.png',
    description:
      'Drone-based high-resolution mapping for survey-grade modeling using advanced photogrammetry and LiDAR workflows.',
    features: [
      'Generated accurate 3D point clouds and terrain meshes',
      'Survey-grade accuracy within sub-inch precision',
      'GIS-compatible georeferencing outputs (GeoTIFF, LAS)',
      'Automated post-processing pipeline for modeling'
    ],
    skills: ['3D', 'Point Clouds', 'GIS', 'Mapping']
  },
  carburetor: {
    title: '3D-Printed Carburetor Prototype',
    subtitle: 'Mechanical R&D Teaching Model',
    icon: 'fas fa-screwdriver-wrench',
    image: 'img/carb.png',
    description:
      'A fully functional 3D-printed carburetor model designed to demonstrate fuel and airflow dynamics.',
    features: [
      'Venturi design for realistic airflow simulation',
      'Adjustable mixture needle to vary fuel flow rate',
      'Cross-sectional design for transparent operation observation',
      'Used as a teaching aid for pilot training'
    ],
    skills: ['3D Printing', 'Mechanical Design', 'CAD', 'Rapid Prototyping']
  }
};

// Open modal
function openProjectModal(key) {
  const p = projectData[key];
  if (!p) return;

  // Fill header
  projectModal.querySelector('.modal-project-logo i').className = p.icon;
  projectModal.querySelector('.modal-title').textContent = p.title;
  projectModal.querySelector('.modal-subtitle').textContent = p.subtitle;

  // Image
  projectModal.querySelector('.modal-image').innerHTML = `
    <img src="${p.image}" alt="${p.title}">
  `;

  // Description + lists
  projectModal.querySelector('.modal-description').textContent = p.description;
  projectModal.querySelector('.modal-features').innerHTML = p.features.map(f => `<li>${f}</li>`).join('');
  projectModal.querySelector('.modal-skills').innerHTML = p.skills
    .map(s => `<span class="skill-chip">${s}</span>`)
    .join('');

  projectModal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

// Close modal
function closeProjectModal() {
  projectModal.classList.remove('active');
  document.body.style.overflow = '';
}

// Bind click events (entire card now clickable)
document.querySelectorAll('.project-card').forEach(card => {
  card.addEventListener('click', e => {
    e.preventDefault();
    const key = card.getAttribute('data-project');
    openProjectModal(key);
  });
});


projectClose?.addEventListener('click', closeProjectModal);




document.addEventListener('DOMContentLoaded', () => {
  const counters = document.querySelectorAll('.stat-number');

  // Smooth easing function (easeOutCubic)
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function animateCount(el) {
    const target = parseFloat(el.getAttribute('data-target'));
    const decimals = (el.getAttribute('data-target').split('.')[1] || '').length;
    const duration = 1600; // total time in ms
    const start = performance.now();

    function update(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = easeOutCubic(progress);
      const value = target * eased;

      const display = value.toFixed(decimals);
      if (el.textContent !== display) el.textContent = display;

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        el.textContent = target.toFixed(decimals);
      }
    }

    requestAnimationFrame(update);
  }

  // Only trigger when visible
  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateCount(entry.target);
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.4 }
  );

  counters.forEach(counter => observer.observe(counter));
});

// Close buttons
modalClose?.addEventListener('click', closeBrandModal);
projectClose?.addEventListener('click', closeProjectModal);

// Click outside modal-content closes it
brandModal.addEventListener('click', e => {
  if (e.target === brandModal) closeBrandModal();
});
projectModal.addEventListener('click', e => {
  if (e.target === projectModal) closeProjectModal();
});

// Esc key closes whichever is open
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (brandModal.classList.contains('active')) closeBrandModal();
    if (projectModal.classList.contains('active')) closeProjectModal();
  }
});

window.addEventListener('DOMContentLoaded', () => {
  if (sections[0]) {
    sections[0].style.opacity = '1';
    sections[0].style.transform = 'none';
  }
});


document.querySelectorAll('.project-card').forEach(card => {
  card.addEventListener('click', e => {
    // If the click is on/inside an anchor or button (or anything marked data-nomodal), do nothing
    if (e.target.closest('a, button, [data-nomodal]')) return;

    const key = card.getAttribute('data-project');
    openProjectModal(key);
  });
});

// Keep this so the website button never bubbles up to the card
document.querySelectorAll('.website-btn').forEach(btn => {
  btn.addEventListener('click', e => {
    e.stopPropagation();   // don't bubble to the card
    // IMPORTANT: do NOT call preventDefault here—let the link navigate
  });
});
