# Ear Geometry

The ear is a visual progress meter that was retired from the main game screen but is reserved for a future third game mode that will need a placement field on each piece. Re-deriving these coordinates from scratch is real work, and the art is already correct.

## Piercing Points

Seven anatomical points down the helix to the lobe, one per 5 points:

```javascript
var pts = [[56, 13], [33, 22], [22, 45], [22, 70], [28, 94], [39, 114], [55, 127]];
```

## SVG Paths

Outer outline:

```svg
<path class="ear-outline" d="M64 14 C40 10 22 26 21 52 C20 78 26 102 38 118
                              C47 130 62 132 66 121 C69 111 59 107 54 100 C50 94 51 88 57 85"/>
```

Inner canal:

```svg
<path class="ear-inner" d="M56 36 C40 42 34 60 38 79 C41 93 48 101 53 105"/>
```
