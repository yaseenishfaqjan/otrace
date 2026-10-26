# theme-overrides

Files here are used INSTEAD of the theme file of the same name, so a vendor
file can be replaced without editing `theme/`.

Currently empty, deliberately. The first override put here stubbed
`snippets/popover-currencies.liquid`, which appeared to hang. It did not: the
engine's search path put `sections/` ahead of `snippets/`, and the theme ships
both `sections/popover-currencies.liquid` and
`snippets/popover-currencies.liquid` — the section's only line being
`{% render 'popover-currencies' %}`, meaning the snippet. The render resolved
back to the section and recursed forever.

Shopify never hits this because `{% render %}` looks only in `snippets/`. The
engine now does the same and the real snippet renders fine, so the stub was
deleted rather than left in place hiding a working file.
