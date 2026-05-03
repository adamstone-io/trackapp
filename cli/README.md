# Track App CLI

A thin client for controlling Track App timers from the terminal or Raycast.

Requires Node.js 18+.

## Setup

```bash
# From the project root
npm link
```

This registers the `track` command globally.

## Configuration

Config files live in `~/.trackapp/`:

| File | Purpose |
|---|---|
| `config.json` | API URL |
| `credentials.json` | JWT tokens (created on login) |
| `presets.json` | Saved timer presets |

Set your API URL:

```bash
mkdir -p ~/.trackapp
echo '{ "api_url": "https://your-api-url.com" }' > ~/.trackapp/config.json
```

If no config is set, defaults to `http://127.0.0.1:8000`.

## Authentication

```bash
track login     # prompts for username and password
track logout    # clears stored tokens
```

Sessions last up to 24 hours (refresh token lifetime). The CLI auto-refreshes the access token on expiry.

## Commands

```bash
track start "Task name"              # start a stopwatch
track start "Task name" -cd 30       # start a 30 minute countdown
track stop                           # stop timer and save time entry
track pause                          # pause the active timer
track resume                         # resume the active timer
track status                         # show current timer state
track help                           # show all commands
```

If no task name is given, it defaults to "Untitled".

## Presets

Save timer configurations you use often:

```bash
track preset add prog50 "Programming" -cd 50
track preset add break15 "Break" -cd 15
track preset list
track preset remove prog50
```

Run a preset by name:

```bash
track prog50        # starts "Programming" 50m countdown
track break15       # starts "Break" 15m countdown
```

## Raycast Integration

Create shell scripts in a Raycast Script Directory:

```bash
#!/bin/bash

# @raycast.schemaVersion 1
# @raycast.title Programming 50m
# @raycast.mode silent
# @raycast.icon :stopwatch:
# @raycast.packageName Track App

/opt/homebrew/bin/track prog50
```

For scripts that prompt for a task name:

```bash
#!/bin/bash

# @raycast.schemaVersion 1
# @raycast.title 30m Timer
# @raycast.mode silent
# @raycast.icon :stopwatch:
# @raycast.packageName Track App
# @raycast.argument1 { "type": "text", "placeholder": "Task name", "optional": true }

/opt/homebrew/bin/track start "${1:-}" -cd 30
```

Use the full path to `track` (`/opt/homebrew/bin/track`) in Raycast scripts since Raycast may not load your shell profile.
