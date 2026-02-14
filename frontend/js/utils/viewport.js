/**
 * Check if viewport is mobile size
 * @param {number} breakpoint - Max width in pixels (default: 768)
 */
export function isMobile(breakpoint = 768) {
  return window.innerWidth <= breakpoint;
}

/**
 * Check if viewport is tablet size
 */
export function isTablet() {
  return window.innerWidth > 768 && window.innerWidth <= 1024;
}

/**
 * Check if viewport is desktop size
 */
export function isDesktop() {
  return window.innerWidth > 1024;
}
