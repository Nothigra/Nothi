# My Shop & Rewards Restructure Plan

## Phase 1 Report (Findings)

### PROMPT 1: My Shop (CreatorProfilePage)
1. **Button Location**: The "Edit Shop" and "Dashboard" buttons are currently floating at the `bottom-xl right-xl` of the screen in `CreatorProfilePage.jsx`.
2. **Current Sections**: Banner, Logo/Avatar, Bio, Stats (Products, Sales, Rating), and a Product Grid. External links and drag-and-drop product ordering do not exist yet, so they will be added as part of the Edit Mode.
3. **Ownership Check**: Confirmed. `const isOwner = !!(profile && creator && profile.id === creator.id)` already exists.

### PROMPT 2: Rewards Page
1. **Current Structure**: The page is a single scrollable view with hardcoded data (Level 24, 8450 XP, 14-day streak) featuring a Streak Strip, Level Card, Career Path, and Badges Grid.
2. **Nav Entry Point**: Currently, Rewards is just a text link in the `navLinks` array. I will migrate this to a dedicated icon (e.g., a Gift or Trophy) in the `navbar-right` actions row with a claimable indicator dot.
3. **Profile Picture Badges**: Not currently implemented. I will add a system to apply an unlocked badge/frame SVG around the user's avatar globally, along with a one-time unlock pulse animation.

---

## Proposed Changes

### PROMPT 1: My Shop (Inline Edit System)
- **Phase 2 (Single Entry)**: Remove the two floating buttons. Add a clean "Edit Shop" button at the top-right of the profile header. On mobile, this will be integrated into the sticky bottom of the viewport for easy access.
- **Phase 3 (Inline Editing)**: 
  - Create a local `isEditing` toggle (no route changes). 
  - Hovering over sections will display a pencil icon. Clicking it opens a focused contextual modal strictly for that section (e.g., just Bio, or just Banner upload).
  - Add lightweight drag-and-drop functionality for the Product Grid using native HTML5 Drag and Drop API.
  - Implement a new "External Links" section.
- **Phase 4 (Appearance Panel)**: 
  - Add a "Customize Appearance" button inside Edit Mode.
  - Opens a side panel restricted to Accent Color (using existing tokens) and Card Shape/Shadow options.

### PROMPT 2: Rewards Page Restructure
- **Phase 2 (Nav Indicator)**: Add a Gift/Trophy icon to the Navbar with a red indicator dot triggered by an "unclaimed daily reward" mock state.
- **Phase 3 (2-Tab Layout)**:
  - **Tab A (Daily)**: 7-day streak visual, a single prominent "Claim" button, and a mystery box for future days.
  - **Tab B (Progression)**: Single progress bar to the next level, a preview of the *next* unlockable badge only, and a "View all my badges" button.
- **Phase 4 (Badges Collection Modal)**: A dedicated modal grid view for earned/locked badges.
- **Phase 5 (Avatar Frames)**: Automatically wrap the user's avatar in `Navbar` (and other spots) with a glowing badge frame upon unlock, featuring a one-time CSS animation.
- **Phase 6**: Complete cleanup of old UI and rigorous 375px mobile regression testing.

> [!IMPORTANT]
> User Review Required: 
> 1. For the My Shop mobile button, I will make it a sticky floating button at the bottom of the screen (similar to iOS tab bars) for immediate reachability. 
> 2. For the Avatar Frames, I will implement a sleek, token-based SVG ring around the profile picture.
> Do you approve this plan to proceed with execution?
