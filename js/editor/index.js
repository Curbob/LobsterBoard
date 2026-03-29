/**
 * OpenClaw Dashboard Builder - Widget Index
 *
 * In the browser, this file should be loaded AFTER the shared modules
 * and BEFORE the category modules. It initializes the global WIDGETS object.
 *
 * The category modules (weather.js, system.js, etc.) add their widgets
 * to window.WIDGETS via their IIFE wrappers.
 *
 * After all category modules are loaded, window.WIDGETS contains all widget
 * definitions, and the WIDGETS variable below also references it.
 */

// Initialize the global WIDGETS object (browser)
if (typeof window !== 'undefined') {
  window.WIDGETS = window.WIDGETS || {};
}

// Make WIDGETS available as a local const for any code that expects it
const WIDGETS = (typeof window !== 'undefined') ? window.WIDGETS : {};
