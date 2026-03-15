#!/usr/bin/env python3
"""
Tivra SecureAuth — Version Bump Script
Copyright (c) 2026 Deepak Kalyani. All rights reserved.

Usage:
  python bump_version.py patch    # 1.0.0 → 1.0.1  (bug fix)
  python bump_version.py minor    # 1.0.0 → 1.1.0  (new feature)
  python bump_version.py major    # 1.0.0 → 2.0.0  (breaking change)
  python bump_version.py 1.2.3    # set exact version
"""

import json, sys, re
from datetime import date

MANIFEST = 'manifest.json'
CHANGELOG = 'CHANGELOG.md'

def get_version():
    with open(MANIFEST) as f:
        return json.load(f)['version']

def set_version(new_ver):
    # Update manifest.json
    with open(MANIFEST) as f:
        m = json.load(f)
    m['version'] = new_ver
    with open(MANIFEST, 'w') as f:
        json.dump(m, f, indent=2)
    print(f"  manifest.json → {new_ver}")

    # Update CHANGELOG.md — insert new entry after the first "---"
    with open(CHANGELOG) as f:
        content = f.read()

    today = date.today().strftime('%Y-%m-%d')
    new_entry = f"""
## [{new_ver}] - {today}

### Added
- 

### Changed
- 

### Fixed
- 

---
"""
    # Insert after the first "---\n"
    content = content.replace('---\n\n## [1.0', f'---\n{new_entry}\n## [1.0', 1)
    # If that didn't match (first entry), just insert after first ---
    if new_entry not in content:
        content = content.replace('---\n', f'---\n{new_entry}', 1)

    with open(CHANGELOG, 'w') as f:
        f.write(content)
    print(f"  CHANGELOG.md  → entry for {new_ver} added")

def bump(current, part):
    major, minor, patch = map(int, current.split('.'))
    if part == 'major': return f"{major+1}.0.0"
    if part == 'minor': return f"{major}.{minor+1}.0"
    if part == 'patch': return f"{major}.{minor}.{patch+1}"
    # exact version
    if re.match(r'^\d+\.\d+\.\d+$', part): return part
    raise ValueError(f"Unknown bump type: {part}")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    current = get_version()
    arg = sys.argv[1]
    new_ver = bump(current, arg)

    print(f"\nBumping version: {current} → {new_ver}")
    set_version(new_ver)
    print(f"\nDone! Next steps:")
    print(f"  1. Fill in CHANGELOG.md with what changed")
    print(f"  2. git add .")
    print(f'  3. git commit -m "Release v{new_ver}"')
    print(f"  4. git tag v{new_ver}")
    print(f"  5. git push && git push --tags")
    print(f"  6. Re-upload zip to Edge Add-ons store\n")
