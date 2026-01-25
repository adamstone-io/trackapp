// js/controllers/nav-controller.js

/**
 * Initializes the navigation menu functionality
 * Handles mobile menu toggle and accessibility
 */
export function initNavigation() {
  const nav = document.querySelector('.nav');
  const navLinks = document.querySelector('.nav__links');
  
  if (!nav || !navLinks) {
    console.warn('Navigation elements not found');
    return;
  }

  console.log('Navigation initialized');

  // Check if toggle button exists, if not create it
  let navToggle = document.querySelector('.nav__toggle');
  
  if (!navToggle) {
    console.log('Creating toggle button dynamically');
    // Create toggle button dynamically
    navToggle = document.createElement('button');
    navToggle.className = 'nav__toggle';
    navToggle.setAttribute('aria-label', 'Toggle navigation menu');
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="3" y1="6" x2="21" y2="6"></line>
        <line x1="3" y1="12" x2="21" y2="12"></line>
        <line x1="3" y1="18" x2="21" y2="18"></line>
      </svg>
    `;
    
    // Insert toggle button before nav links
    nav.insertBefore(navToggle, navLinks);
  } else {
    console.log('Toggle button already exists');
  }

  // Toggle menu function
  function toggleMenu(event) {
    event.stopPropagation(); // Prevent event from bubbling to document
    const isOpen = navLinks.classList.contains('nav__links--open');
    
    if (isOpen) {
      navLinks.classList.remove('nav__links--open');
      navToggle.setAttribute('aria-expanded', 'false');
      navToggle.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
      `;
    } else {
      navLinks.classList.add('nav__links--open');
      navToggle.setAttribute('aria-expanded', 'true');
      navToggle.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      `;
    }
  }

  // Close menu when clicking a link
  function closeMenu() {
    navLinks.classList.remove('nav__links--open');
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="3" y1="6" x2="21" y2="6"></line>
        <line x1="3" y1="12" x2="21" y2="12"></line>
        <line x1="3" y1="18" x2="21" y2="18"></line>
      </svg>
    `;
  }

  // Close menu when clicking outside
  function handleClickOutside(event) {
    if (!nav.contains(event.target) && navLinks.classList.contains('nav__links--open')) {
      closeMenu();
    }
  }

  // Close menu on window resize if it's open and we're above mobile breakpoint
  function handleResize() {
    if (window.innerWidth > 768 && navLinks.classList.contains('nav__links--open')) {
      closeMenu();
    }
  }

  // Event listeners
  navToggle.addEventListener('click', toggleMenu);
  
  // Close menu when clicking nav links
  navLinks.querySelectorAll('.nav__link').forEach(link => {
    link.addEventListener('click', closeMenu);
  });

  // Close menu when clicking outside
  document.addEventListener('click', handleClickOutside);

  // Handle window resize
  window.addEventListener('resize', handleResize);

  // Cleanup function (optional, for SPA scenarios)
  return () => {
    navToggle.removeEventListener('click', toggleMenu);
    document.removeEventListener('click', handleClickOutside);
    window.removeEventListener('resize', handleResize);
  };
}
