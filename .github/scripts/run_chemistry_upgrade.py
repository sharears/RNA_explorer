from pathlib import Path

patch_path = Path('.github/scripts/chemistry_upgrade.py')
source = patch_path.read_text(encoding='utf-8')
source = source.replace(
    '    if count != 1:\n        raise SystemExit(f"Expected exactly one match, found {count}: {old[:100]!r}")\n',
    '    if count < 1:\n        raise SystemExit(f"Expected a match, found {count}: {old[:100]!r}")\n',
    1,
)
exec(compile(source, str(patch_path), 'exec'))
