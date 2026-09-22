import { createPortal } from 'react-dom';

/**
 * Renders its children in place normally, or portals them straight to
 * <body> when `active` is true.
 *
 * Layout.jsx wraps every public page in a Framer Motion div that animates
 * transform + filter for page transitions. That creates a CSS stacking
 * context — anything rendered inside it (i.e. all page content) is trapped
 * within that context and can never visually rise above a sibling
 * rendered outside it (like the floating mobile bottom nav), no matter how
 * high its z-index is set. z-index only resolves within the nearest
 * stacking context, and position:fixed does not escape one created by an
 * ancestor's transform/filter.
 *
 * Use this for any page-level fixed-position overlay, sheet, or modal that
 * needs to visually sit above the persistent chrome (bottom nav, etc.) —
 * typically only needed on mobile, where that chrome exists.
 */
export default function PortalWhen({ active, children }) {
  if (active && typeof document !== 'undefined') {
    return createPortal(children, document.body);
  }
  return children;
}
