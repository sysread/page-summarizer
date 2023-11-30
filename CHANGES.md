# 1.9.2
- Minor feature: copy summary to clipboard
- Bugfix: fails to summarize from pop-out window

# 1.9.1
- Bugfix: fix bug in how we determine if we are running on a mobile device
- Bugfix: fix undeclared variable error when no instructions are set
- Bugfix: fix creation of "null" profile when user escapes out of prompt

# 1.9
- New feature: Summarize PDFs
- New feature: Open popup in a new tab
- New feature: Select instructions when clicked on to make replacing them easier
- Bugfix: eliminated the "received empty string" error

# 1.8
- New feature: profiles!
- Bugfix: mitigate port disconnctions while popup remains open
- Bugfix: handle port disconnections gracefully when popup is closed

# 1.7
- Fix stack craziness in form filler outer

# 1.6
- User can now override configured model from the popup

# 1.5
- Rendering of GPT responses is smoother and requires less CPU
- Fix bug introduced in 1.4 causing custom instructions to be lost when undesirable
- Add option to use new preview version of GPT-4

# 1.4
- No longer sends custom instructions from options page when overriding prompt to summarize page (increases likelihood of GPT3.5 obeying)
- UI improvements for popup on mobile
- Fix errors when attempting to summarize internal browser pages

# 1.3
- better feedback in options area
- UI improvements for config on mobile

# 1.2
- bugfix: certain uncommon API responses could cause the plugin to peg the CPU

# 1.1
- first official release

# 1.0
- developer release
