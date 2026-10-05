import { createContext, useContext } from 'react';

/**
 * In the mobile app the main tabs stay mounted when you leave them (that is
 * what makes coming back instant). A screen can ask whether it is the one on
 * display, and how many times it has been shown:
 *
 *   const { active, visit } = useScreenFocus();
 *   useEffect(() => { reload(); }, [visit]);        // refresh on every return
 *   if (!active) close the sheet / pause the thing
 *
 * On the website (and for pushed screens) a screen is always active.
 */
export const ScreenFocus = createContext({ active: true, visit: 0 });
export const useScreenFocus = () => useContext(ScreenFocus);
