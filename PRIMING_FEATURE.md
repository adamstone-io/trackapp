# Priming Feature

## Overview
The Priming feature allows you to track how many times you "prime" your brain before studying a topic. Priming is the practice of opening mental loops and asking yourself questions about material **before** actually studying it, which enhances learning effectiveness.

## How It Works

### Key Concepts
- **Prime Items**: Topics or concepts you want to prime before studying
- **Priming Session**: Each time you engage in priming for a topic (asking questions, opening loops)
- **Tracking**: Count total primes, today's primes, and this week's primes
- **Smart Sorting**: Recently primed items automatically move to the end of the list, keeping unprimed items visible at the top
- **Archive**: Hide items you no longer need to prime while preserving their data

### Usage Flow
1. **Add Prime Item**: Create a new topic with optional description/questions
2. **Log Prime**: Click "Log Prime" each time you prime that topic
   - Item automatically moves to the end of the list after logging
3. **Track Progress**: View statistics for each item (Total, Today, This Week, Last primed)
4. **Import from File**: Click "Import from File" to bulk import prime items from a text file
   - File format: Lines starting with `####` will be imported as prime item titles
   - Example: `#### Topic Name` becomes a prime item titled "Topic Name"
5. **Archive**: Click the archive icon to hide completed items
6. **View Archived**: Click "Show Archived" to view/restore archived items
7. **Edit/Delete**: Update or remove prime items as needed

## Files Structure

### Domain
- `js/domain/prime-item.js` - PrimeItem class with priming logic and statistics

### Controllers
- `js/controllers/prime-controller.js` - Handles CRUD operations and priming sessions

### Views
- `js/views/prime-view.js` - Renders prime items list and modal form

### UI
- `js/ui/prime-ids.js` - Element ID constants
- `css/components/priming.css` - Styling for priming components

### Storage
- `js/data/storage.js` - Includes savePrimeItems, loadPrimeItems, updatePrimeItem, deletePrimeItem

### Page
- `html/priming.html` - Main priming page
- `js/priming-main.js` - Entry point for priming page

## Data Model

```javascript
{
  id: string,
  title: string,
  description: string,
  primeTimestamps: number[], // Array of millisecond timestamps
  archived: boolean, // Whether item is archived
  createdAt: string // ISO date string
}
```

## Features

### Smart Sorting
Items are sorted by **least recently primed first**. This means:
- Unprimed items (or items not primed in a while) appear at the top
- When you log a prime, that item automatically moves to the bottom
- Keeps your attention on items that need priming

### Archive System
- **Archive**: Soft-delete items you no longer need to prime
- **Toggle View**: Switch between active and archived items
- **Restore**: Bring archived items back to active list
- **Data Preserved**: All priming history is kept when archiving

## Statistics Calculated
- **Total**: Total count of all priming sessions
- **Today**: Count of sessions today (since midnight)
- **This Week**: Count of sessions this week (week starts Sunday)
- **Last**: Human-readable time since last prime ("2h ago", "3d ago", etc.)

## Why "Priming" vs "Review"?
Priming occurs **before** studying material. It's about opening mental loops and creating curiosity. "Review" typically implies going over material you've already studied, so "priming" is a more accurate term for this pre-study technique.

## Import File Format

You can bulk import prime items from a text file (`.txt` or `.md`). The import feature looks for lines starting with `####` and creates a prime item for each one.

### Example Import File

```
#### Neural Networks
#### Backpropagation Algorithm
#### Gradient Descent
#### Loss Functions
#### Activation Functions
```

Each line starting with `####` will create a new prime item with that title. Lines without `####` are ignored, so you can include other content in the file if needed.
