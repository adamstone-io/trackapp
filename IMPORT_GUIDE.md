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

- Only the text after `####` is used as the title
- Lines without `####` are ignored
- Empty lines and whitespace are handled automatically

## Example

See `sample-prime-import.txt` for a complete example of an import file.

## Notes

- Imported items are added to your existing prime items
- No duplicates are checked - the same title can be imported multiple times
- After import, you can edit or delete items as usual
- Imported items start with zero priming sessions (you can log primes immediately)
