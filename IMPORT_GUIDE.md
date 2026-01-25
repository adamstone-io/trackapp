# How to Import Prime Items

The priming tracker now supports bulk importing prime items from text files.

## Steps to Import

1. Open the Priming page (`html/priming.html`)
2. Click the "Import from File" button
3. Select a `.txt` or `.md` file
4. The app will create prime items for each line starting with `####`

## File Format

Lines starting with `####` (four hash symbols) will be imported as prime item titles:

```
#### Machine Learning Fundamentals
#### Neural Networks
#### Deep Learning
```

### Optional Category Declaration

You can optionally declare a category for all imported items by adding a category declaration on the first line:

```
Category: Machine Learning
#### Machine Learning Fundamentals
#### Neural Networks
#### Deep Learning
```

or (case-insensitive):

```
category: Machine Learning
#### Machine Learning Fundamentals
#### Neural Networks
#### Deep Learning
```

- The category declaration must be on the first line
- Format: `Category: <category name>` or `category: <category name>`
- All imported items will be assigned this category
- If no category is specified, items are imported without a category

### Format Rules

- Only the text after `####` is used as the title
- Lines without `####` are ignored (except for the optional first-line category)
- Empty lines and whitespace are handled automatically

## Example

See `sample-prime-import.txt` for a complete example of an import file.

## Notes

- Imported items are added to your existing prime items
- No duplicates are checked - the same title can be imported multiple times
- After import, you can edit or delete items as usual
- Imported items start with zero priming sessions (you can log primes immediately)
