#!/usr/bin/env python3
"""Write the updated manual generator to generate_manual_pages.py"""
import sys
sys.path.insert(0, r'C:\Users\z1309\Desktop\work\speakGuild\docs\软件著作权')

# Read existing file to get the helper functions
with open(r'C:\Users\z1309\Desktop\work\speakGuild\docs\软件著作权\generate_manual_pages.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Find where main() starts - all helper functions are before it
main_idx = content.find('\ndef main():')
if main_idx < 0:
    print("ERROR: Cannot find main() function")
    sys.exit(1)

# Keep the helper functions and build new main()
header = content[:main_idx + 1]  # include newline before def main

# Read the new manual content
with open(r'C:\Users\z1309\Desktop\work\speakGuild\docs\软件著作权\_new_manual.py', 'r', encoding='utf-8') as f:
    new_main = f.read()

# Combine
new_content = header + '\n' + new_main + '\n'

with open(r'C:\Users\z1309\Desktop\work\speakGuild\docs\软件著作权\generate_manual_pages.py', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Done! generate_manual_pages.py updated.")
