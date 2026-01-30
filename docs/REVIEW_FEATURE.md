# Review Feature Documentation

## Overview
The Review feature has been successfully added to TempoTrack. It is similar to the Priming feature but designed for tracking study reviews of topics/concepts.

## Features Implemented

### Core Functionality
- **Add Review Items**: Quick-add via textarea or full form modal
- **Log Reviews**: Track when items are reviewed with timestamps
- **Categories**: Organize review items with optional categories
- **Archive/Restore**: Soft delete items with ability to restore
- **Edit/Delete**: Full CRUD operations on review items
- **Import**: Import review items from text files (same format as priming)

### Statistics Tracked
For each review item, the following statistics are tracked:
- **First Studied**: When the item was first studied (automatically set on first review)
- **Last Review**: When the item was last reviewed
- **Total Reviews**: Total number of times reviewed
- **Today's Reviews**: Number of reviews logged today
- **This Week's Reviews**: Number of reviews logged this week
- **This Month's Reviews**: Number of reviews logged this month

### Files Created

#### Domain Layer
- `js/domain/review-item.js` - ReviewItem class with review tracking logic

#### Controller Layer
- `js/controllers/review-controller.js` - Business logic for review management

#### View Layer
- `js/views/review-view.js` - Rendering logic for review items and modal

#### UI Layer
- `js/ui/review-ids.js` - Element ID constants

#### Data Layer
- `js/data/storage.js` - Centralized storage functions for all data types (NEW)

#### Entry Point
- `js/reviews-main.js` - Application entry point for reviews page

#### Presentation Layer
- `html/reviews.html` - Review page HTML
- `css/components/reviews.css` - Review-specific styling

## Key Differences from Priming

1. **Statistics Focus**:
   - Priming: Tracks daily, weekly, monthly, yesterday, and last week counts
   - Reviews: Tracks today, this week, this month, first studied, and last review time

2. **Purpose**:
   - Priming: Opening loops and asking questions before studying
   - Reviews: Tracking review sessions of material already studied

3. **First Studied Date**:
   - Review items have a `firstStudiedAt` timestamp that is automatically set when the first review is logged
   - This allows tracking how long you've been studying a particular topic

## Navigation Updates

All HTML pages have been updated to include the Reviews link in the navigation:
- `html/habits.html`
- `html/timer.html`
- `html/stats.html`
- `html/priming.html`
- `html/reviews.html`

## Stats Integration

The stats page (`html/stats.html`) has been updated to display review statistics:
- Reviews Logged Today
- Reviews Logged This Week
- Reviews Logged This Month

## Storage Architecture

A new centralized storage module (`js/data/storage.js`) has been created to handle all data persistence:
- Prime Items
- Review Items
- Time Entries
- Tasks
- Moments

This provides a single source of truth for all localStorage operations.

## Usage

### Adding a Review Item
1. Navigate to the Reviews page
2. Enter the topic in the quick-add textarea
3. Optionally add a category
4. Click "Add" or press Ctrl/Cmd+Enter

### Logging a Review
1. Click the "Log Review" button on any review item
2. The item will be marked as reviewed with a green border animation
3. Statistics will update automatically

### Managing Review Items
1. Click the three-dot menu on any item
2. Choose from:
   - **Archive**: Soft delete the item (can be restored)
   - **Edit**: Modify title, category, or description
   - **Delete**: Permanently remove the item

### Viewing Archived Items
1. Click the three-dot menu in the header
2. Select "Show Archived"
3. Archived items can be restored from this view

### Importing Review Items
1. Click the three-dot menu in the header
2. Select "Import from File"
3. Choose a text file with items formatted as:
   ```
   Category: Math
   #### Topic 1
   #### Topic 2
   #### Topic 3
   ```

## Technical Notes

- Uses localStorage for data persistence
- Follows the same MVC pattern as Priming feature
- Includes dropdown menu component for actions
- Category autocomplete with usage counts
- Sound feedback when logging reviews (same as priming)
- Responsive design for mobile devices
- Items are sorted by least recently reviewed first

## Future Enhancements (Not Implemented)

Potential improvements:
- Spaced repetition algorithm integration
- Review reminders based on forgetting curve
- Difficulty ratings for review items
- Custom review intervals
- Visual analytics and charts
- Review history timeline
